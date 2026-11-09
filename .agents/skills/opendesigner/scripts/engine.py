#!/usr/bin/env python3
"""OpenDesigner engine: turns interview answers into a validated, exported design system.

Standard library only, Python 3.10+, no network. Every number it produces comes from
`references/levers.json` (the machine-readable twin of synthesis/LEVERS.md) or from a rule
cited inline with a Decision Card (DC-Lxx-nn) or source id (S-Lxx-nnn). `[inferred]` marks
choices this engine makes where the research gives a range or a direction but not a value.

Commands (run from the user's project; state lives in ./opendesigner/ unless --dir is given):
    engine.py init [--name "Acme"] [--from path/to/state.json]
    engine.py sketch [--brand HEX] [--audience dense|regular|large] [--platforms web,ios] [--stack react] [--feel playful,...]
                     [--theme ...]        Level 0: a complete, coarse system from about five answers
                     [--logo PNG|SVG]     without --brand: the logo's colors and the command that confirms one; writes nothing
    engine.py set <dotted.path> <json-value> [--why "reason"] [--set-by S] [--lock] [--source-ref R]
                                          also: set path=value; set Q-shape-01 '"soft"'; a status word may start --why
    engine.py pick <question-id> <option-value> [--why "reason"]
    engine.py lock <dotted.path> | unlock <dotted.path>
    engine.py resolve                     effective dials, zoom per area and every derived parameter (JSON)
    engine.py generate                    state.json + levers.json -> tokens/ (DTCG 2025.10 + resolver)
    engine.py validate [--json]           contrast, targets, lint; exit 1 on errors, 0 with warnings
    engine.py export --format css|tailwind|figma|paper|swift|compose|dtcg|artifact|brand|all
    engine.py design-md [--out DIR]       DESIGN.md and PRODUCT.md (project root when the state is ./opendesigner)
    engine.py preview [--open]            preview.html (every token plus a few components, light and dark)
    engine.py overview [--open]           overview.html (the whole system on one page, what is chosen, what is missing)
    engine.py intake <measurements.json> [--accept] [--json]   reference values -> proposed dials (LEVERS E)
    engine.py review [--project P] [--strict] [--json]         hard-coded values that bypass tokens; stale DESIGN.md
    engine.py feedback "text" --kind gap|bug|confusing|idea [--from-journey]   local note + a pre-filled issue link (never posts)
    engine.py build                       generate + validate + the exports for the chosen platforms + design-md + preview
    engine.py show <template> [--open]    a visual template filled with real values (palette, radius, option-gallery, ...)
    engine.py feel [words...]             how plain feel words (fun, calm, techy) map to the feel settings
    engine.py standards [--json] [--update] [--all]   project standards and overrides, then the standards followed (by
                                          theme; --all adds the ones for other platforms), not mapped, house updates;
                                          --update applies new and changed house standards (overridden ones stay the person's),
                                          unlocks retired ones and ones for other platforms, and retries values not mapped
    engine.py standard override <id> --why "<their words>" [--path P [--value <json>]]... [--all-holders]
                                          the person explicitly changes a house standard: the whole of it, or only the values
                                          named with --path (--all-holders: also from the other standards that set them)
    engine.py standard restore <id> [--why "<their words>"] [--all-holders]   follow a standard again (re-applied, locked)
    engine.py standard add --rule "..." --why "..." --source <url, file or "person, 2026-09-27"> [--authority non-negotiable|good-to-have]
                           [--area A] [--values '{...}'] [--path P --value <json>]... [--beats STD-a,STD-b]
                           [--review-pattern RE --review-message M] [--title T]
    engine.py standard remove PRJ-<nn> --why "..."   remove a project standard (house standards are only overridden)
    engine.py version                     this copy's OpenDesigner release, and whether the system here is up to date with it

Version stamps: every write of state.json records `opendesigner` = {version: the newest release that has written it, created: the
release that first made it (null: made before version stamps), built: the release whose `build` last wrote the files}.
When a system was last built or saved with an older release, or made before stamps, each command (except init, feel,
resolve and --json output) says so once and points to `build` and CHANGELOG.md; a system saved with a newer release
gets the opposite note. The engine compares the system with this copy only: it never checks online for newer releases.

Standards (docs/KNOWLEDGE.md): house standards ship as references/standards.json (OD_STANDARDS_FILE points elsewhere). init
applies every one that maps to a token or setting, locked, with set_by "standard", as one grouped decision; a standard
applies when one of its applies_to tags is a project tag (its platforms, mapped, plus raw.stack read from package.json).
They are re-scoped whenever the platforms or the stack change. `set --force` never passes a standard. The copy of each
standard a system follows lives in standards-state.json next to state.json. Without the house file every command behaves
exactly as before.

When the person said yes to the private journey log (profile.tracking "on", see journey.py), the engine logs its own
steps there: answers and changed answers from set/pick/sketch, the finished sketch, validation errors, exports, reviews
and feedback. It never logs values, and it logs nothing without that yes.

Output layout inside the state directory (spec 7.1):
    state.json, decisions.md, feedback.md, preview.html,
    tokens/ primitives, semantic, semantic.color.<theme>, semantic.density.<mode>, motion.<standard|reduced> (.tokens.json),
            opendesigner.resolver.json, opendesigner.meta.json
    build/  css/tokens.css, tailwind/theme.css, figma/variables.json + figma/import/*.tokens.json, paper/tokens.json,
            swift/DesignTokens.swift, compose/DesignTokens.kt, dtcg/<name>.resolver.json
            (build writes the code files for the chosen platforms, build_formats; export --format all writes every one)
"""
from __future__ import annotations

import argparse
import copy
import datetime as _dt
import fnmatch
import json
import math
import os
import re
import shlex
import shutil
import sys
import webbrowser

ENGINE_VERSION = "1.0.0"
# The OpenDesigner release this copy belongs to, stamped into each system's state.json. tools/build_dist.py fails when it
# differs from the version in plugin.json and .claude-plugin/plugin.json.
OPENDESIGNER_VERSION = "0.2.0"
CHANGELOG_URL = "https://github.com/ckryptickunal/OpenDesigner/blob/main/CHANGELOG.md"
HERE = os.path.dirname(os.path.abspath(__file__))
SKILL_ROOT = os.path.dirname(HERE)
REFERENCES = os.path.join(SKILL_ROOT, "references")
NS = "opendesigner"  # $extensions key fixed by the spec (7.4, 5.6); DTCG recommends, not requires, reverse-domain keys
STATE_SCHEMA = "opendesigner-state/1"
DEFAULT_DIR = "opendesigner"

try:
    import journey  # scripts/journey.py: the private journey log (BRIEF requirement 18); optional
except ImportError:
    journey = None
try:
    import taste as taste_py  # scripts/taste.py: the taste poll and the project's taste index; optional
except ImportError:
    taste_py = None
try:
    import research as research_py  # scripts/research.py: user research, its checks and what it recommends; optional
except ImportError:
    research_py = None


def track(d, event, **kw):
    """Log a step to the journey log if the person said yes. Silent, and never stops design work."""
    if journey:
        journey.record(d, event, **kw)


# Paths that answer a sketch question without being answers.<Q-id> (zoom.md, level 0), and how a chosen value was given
ANSWER_PATHS = {"context.product": ("Q-scope-01", "free"), "raw.brandColor": ("Q-color-01", "free"), "macros": ("Q-brand-01", "option"),
                "hooks.H-logo.status": ("Q-brand-03", "option")}


# =============================================================================================
# Small utilities
# =============================================================================================

def clamp(x, lo, hi):
    return lo if x < lo else hi if x > hi else x


def rnd(x, nd=4):
    """Deterministic rounding for output (avoids -0.0)."""
    v = round(float(x), nd)
    return 0.0 if v == 0 else v


def round_half_up(x):
    return int(math.floor(x + 0.5))


def snap_to(value, steps):
    return min(steps, key=lambda s: (abs(s - value), s))


STATE_FILE = "state.json"
STD_SIDECAR = "standards-state.json"  # the copies of the standards a system follows, kept out of state.json (R29)


def _split_snapshots(path, state):
    """state.json without the standards' kept copies, which go to standards-state.json next to it (state.json points to
    it). The caller's state is not changed."""
    st = state.get("standards")
    recs = st.get("records") if isinstance(st, dict) else None
    side = os.path.join(os.path.dirname(path) or ".", STD_SIDECAR)
    snaps = {sid: r["std"] for sid, r in recs.items() if isinstance(r, dict) and isinstance(r.get("std"), dict)} \
        if isinstance(recs, dict) else {}
    if not snaps:
        if isinstance(st, dict) and st.get("snapshots") == STD_SIDECAR:
            if os.path.exists(side):
                os.remove(side)
            return dict(state, standards={k: v for k, v in st.items() if k != "snapshots"})
        return state
    dump_json(side, {"$comment": "Generated by engine.py: the copy of each standard this system follows, as it follows it. "
                                 "state.json points here (standards.snapshots). Keep it next to state.json.", "snapshots": snaps},
              compact=True)
    lean = {sid: ({k: v for k, v in r.items() if k != "std"} if isinstance(r, dict) else r) for sid, r in recs.items()}
    return dict(state, standards=dict(st, records=lean, snapshots=STD_SIDECAR))


def _join_snapshots(path, state):
    """The other half of _split_snapshots: each record gets its kept copy back from standards-state.json."""
    st = state.get("standards") if isinstance(state, dict) else None
    if not (isinstance(st, dict) and st.get("snapshots") == STD_SIDECAR):
        return state
    st.pop("snapshots")
    try:
        with open(os.path.join(os.path.dirname(path) or ".", STD_SIDECAR), encoding="utf-8") as f:
            snaps = json.load(f).get("snapshots")
    except (OSError, ValueError, AttributeError):  # a missing copy falls back to the house file, never a crash
        return state
    recs = st.get("records")
    if isinstance(snaps, dict) and isinstance(recs, dict):
        for sid, r in recs.items():
            if isinstance(r, dict) and "std" not in r and isinstance(snaps.get(sid), dict):
                r["std"] = snaps[sid]
    return state


def dump_json(path, data, compact=False):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    if os.path.basename(path) == STATE_FILE and isinstance(data, dict):
        data = _split_snapshots(path, stamp_version(data))
    text = (json.dumps(data, separators=(",", ":"), ensure_ascii=False) if compact else json.dumps(data, indent=2, ensure_ascii=False)) + "\n"
    write_text(path, text)


def write_text(path, text):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def read_json(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return _join_snapshots(path, data) if os.path.basename(path) == STATE_FILE else data


# Version stamps: which OpenDesigner release made, last saved and last built a system. The engine compares a system with
# this copy only; it never checks online for newer releases.

def version_key(v):
    """A release number that sorts the way semver does ('0.10.0' > '0.9.0'; '0.2.0-beta' < '0.2.0';
    '0.2.0-beta.10' > '0.2.0-beta.2'); None if it is not one."""
    m = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(\+[0-9A-Za-z.-]+)?", str(v or "").strip())
    if not m:
        return None
    pre = (1,) if not m[4] else (0, tuple((0, int(x)) if x.isdigit() else (1, x) for x in m[4].split(".")))
    return (int(m[1]), int(m[2]), int(m[3]), pre)


def stamp_version(state, built=False):
    """The state as state.json is written: opendesigner.version is the newest release that has written it (an older copy
    never lowers it, so the "newer system" note survives), created the release that first made the system (None: made
    before version stamps), built the release whose build last wrote the files (None: not built since version stamps;
    absent: never built). The caller's state is not changed."""
    od = state.get("opendesigner")
    od = dict(od) if isinstance(od, dict) else {"created": None, "built": None}  # a system made before version stamps
    seen = [v for v in (od.get("version"), od.get("created")) if version_key(v)]
    od["version"] = max(seen + [OPENDESIGNER_VERSION], key=version_key)
    if built:
        od["built"] = OPENDESIGNER_VERSION
    return dict(state, opendesigner={k: od[k] for k in ("version", "created", "built") if k in od})


def version_status(state):
    """(kind, release) for a system against this copy. kind: 'current'; 'newer' (saved or built with a newer release);
    'built' (last built with an older release); 'saved' (never built, last saved with an older release); 'unstamped'
    (made before version stamps and not built since)."""
    od = state.get("opendesigner") if isinstance(state, dict) else None
    if not isinstance(od, dict):
        return "unstamped", None
    here = version_key(OPENDESIGNER_VERSION)
    newest = max((v for v in (od.get("version"), od.get("built"), od.get("created")) if version_key(v)), key=version_key, default=None)
    if newest and version_key(newest) > here:
        return "newer", newest
    kind = "built" if "built" in od else "saved"
    ref = od.get("built") if kind == "built" else od.get("version")
    if not version_key(ref):
        return "unstamped", None
    return ("current" if version_key(ref) >= here else kind), ref


def _made_with(kind, v):
    return {"unstamped": "was made before OpenDesigner recorded its version", "built": f"was last built with OpenDesigner {v}",
            "saved": f"was last saved with OpenDesigner {v}"}[kind]


def version_notice(state):
    """What to tell the person when their system is not current with this copy, in one or two plain sentences; else None."""
    kind, v = version_status(state)
    if kind == "current":
        return None
    if kind == "newer":
        return (f"This system was last saved with OpenDesigner {v}, which is newer than this copy ({OPENDESIGNER_VERSION}). "
                "Update OpenDesigner before you change it: this copy may miss some of its features.")
    return (f"This system {_made_with(kind, v)}; you have {OPENDESIGNER_VERSION}. Run `engine.py build` to bring the files up "
            f"to date. What changed: CHANGELOG.md ({CHANGELOG_URL}).")


def state_or_none(d):
    """state.json as written, or None when there is none or it cannot be read (the command then says why)."""
    try:
        with open(os.path.join(d, STATE_FILE), encoding="utf-8") as f:
            st = json.load(f)
    except (OSError, ValueError):
        return None
    return st if isinstance(st, dict) else None


def cmd_version(d):
    """`engine.py version`: this copy's release, and how the system in d compares with it. It never checks online."""
    st = state_or_none(d)
    head = f"OpenDesigner {OPENDESIGNER_VERSION}."
    if st is None:
        sp = os.path.join(d, STATE_FILE)
        print(f"{head} {sp} could not be read as JSON." if os.path.exists(sp) else f"{head} There is no system in {d} yet.")
    else:
        print(f"{head} {version_notice(st) or 'This system is up to date with it.'}")
    print("This compares the system with this copy of OpenDesigner only. It never checks online for newer releases.")
    return 0


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-") or "x"


def camel(parts):
    out = []
    for i, p in enumerate(parts):
        p = re.sub(r"[^A-Za-z0-9]+", " ", str(p)).strip()
        words = p.split()
        for j, w in enumerate(words):
            out.append(w.lower() if (i == 0 and j == 0) else w[:1].upper() + w[1:])
    s = "".join(out)
    return ("n" + s) if s[:1].isdigit() else s


def A(path):
    """DTCG curly-brace alias."""
    return "{" + path + "}"


def dim(v, unit="px"):
    return {"value": rnd(v, 3) if isinstance(v, float) else v, "unit": unit}


def ms(v):
    return {"value": int(v), "unit": "ms"}


# =============================================================================================
# Color math: OKLab/OKLCH (Ottosson), sRGB and Display P3, WCAG 2.2, APCA (advisory), CAM16 chroma
# =============================================================================================

def oklch_to_oklab(L, C, H):
    h = math.radians(H or 0.0)
    return L, C * math.cos(h), C * math.sin(h)


def oklab_to_lms_(L, a, b):
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    return l_ ** 3, m_ ** 3, s_ ** 3


def oklch_to_linear_srgb(L, C, H):
    l, m, s = oklab_to_lms_(*oklch_to_oklab(L, C, H))
    return (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)


def linear_srgb_to_oklch(r, g, b):
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (math.copysign(abs(v) ** (1 / 3), v) for v in (l, m, s))
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    C = math.hypot(a, bb)
    H = math.degrees(math.atan2(bb, a)) % 360
    return L, C, H


# linear sRGB -> linear Display P3 (both D65)
_SRGB_TO_XYZ = ((0.4123907993, 0.3575843394, 0.1804807884),
                (0.2126390059, 0.7151686788, 0.0721923154),
                (0.0193308187, 0.1191947798, 0.9505321522))
_XYZ_TO_P3 = ((2.4934969119, -0.9313836179, -0.4027107845),
              (-0.8294889696, 1.7626640603, 0.0236246858),
              (0.0358458302, -0.0761723893, 0.9568845240))
_P3_TO_XYZ = ((0.4865709486, 0.2656676932, 0.1982172852),
              (0.2289745641, 0.6917385218, 0.0792869141),
              (0.0000000000, 0.0451133819, 1.0439443689))


def _mat(m, v):
    return tuple(m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2] for i in range(3))


def linear_srgb_to_linear_p3(rgb):
    return _mat(_XYZ_TO_P3, _mat(_SRGB_TO_XYZ, rgb))


def in_gamut(rgb, eps=1e-7):
    return all(-eps <= c <= 1 + eps for c in rgb)


def encode(c):
    c = clamp(c, 0.0, 1.0)
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def decode(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def hex_of_linear(rgb):
    return "#" + "".join(f"{round_half_up(encode(c) * 255):02x}" for c in rgb)


def hex_to_rgb8(hx):
    hx = hx.strip().lstrip("#")
    if len(hx) == 3:
        hx = "".join(ch * 2 for ch in hx)
    return tuple(int(hx[i:i + 2], 16) for i in (0, 2, 4))


def hex_to_linear(hx):
    return tuple(decode(v / 255) for v in hex_to_rgb8(hx))


def hex_to_oklch(hx):
    return linear_srgb_to_oklch(*hex_to_linear(hx))


def oklch_to_hex(L, C, H):
    return hex_of_linear(oklch_to_linear_srgb(L, C, H))


def luminance(hx):
    """WCAG 2.2 relative luminance of an sRGB hex color (the values browsers and Figma display)."""
    r, g, b = (decode(v / 255) for v in hex_to_rgb8(hx))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_y(y1, y2):
    hi, lo = max(y1, y2), min(y1, y2)
    return (hi + 0.05) / (lo + 0.05)


def contrast(a, b):
    """WCAG 2.2 contrast ratio between two hex colors. No rounding: 4.499 fails 4.5 (DC-L01-22)."""
    return contrast_y(luminance(a), luminance(b))


def composite(fg_hex, alpha, bg_hex):
    """Alpha-composite in gamma-encoded sRGB, as browsers do."""
    f, b = hex_to_rgb8(fg_hex), hex_to_rgb8(bg_hex)
    return "#" + "".join(f"{round_half_up(alpha * x + (1 - alpha) * y):02x}" for x, y in zip(f, b))


def apca_lc(text_hex, bg_hex):
    """APCA-W3 0.0.98G-4g lightness contrast. Advisory only: WCAG 3 is a Working Draft (S-L01-021)."""
    def y(hx):
        r, g, b = (v / 255 for v in hex_to_rgb8(hx))
        yy = 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.0721750 * b ** 2.4
        return yy + (0.022 - yy) ** 1.414 if yy < 0.022 else yy
    yt, yb = y(text_hex), y(bg_hex)
    if abs(yb - yt) < 0.0005:
        return 0.0
    if yb > yt:
        sapc = (yb ** 0.56 - yt ** 0.57) * 1.14
        out = 0.0 if sapc < 0.1 else sapc - 0.027
    else:
        sapc = (yb ** 0.65 - yt ** 0.62) * 1.14
        out = 0.0 if sapc > -0.1 else sapc + 0.027
    return out * 100


# ---- CAM16 chroma (the "C" of Material's HCT), used to read the Colorfulness dial's HCT anchors.
# Viewing conditions follow Material Color Utilities' defaults (D65, L_A = 200/pi * Y(L*50)/100,
# background L* 50, average surround) so HCT chroma values from S-L01-010 mean the same thing here.
def _cam16_setup():
    wp = (95.047, 100.0, 108.883)
    y_l50 = 100 * ((50 + 16) / 116) ** 3
    la = (200 / math.pi) * y_l50 / 100
    yb = y_l50
    f, c, nc = 1.0, 0.69, 1.0
    m16 = ((0.401288, 0.650173, -0.051461), (-0.250268, 1.204414, 0.045854), (-0.002079, 0.048952, 0.953127))
    rgb_w = _mat(m16, wp)
    d = clamp(f * (1 - (1 / 3.6) * math.exp((-la - 42) / 92)), 0, 1)
    rgb_d = tuple(d * (100 / x) + 1 - d for x in rgb_w)
    k = 1 / (5 * la + 1)
    k4 = k ** 4
    fl = k4 * la + 0.1 * (1 - k4) ** 2 * (5 * la) ** (1 / 3)
    n = yb / wp[1]
    z = 1.48 + math.sqrt(n)
    nbb = 0.725 / n ** 0.2

    def adapt(x):
        p = (fl * abs(x) / 100) ** 0.42
        return math.copysign(400 * p / (p + 27.13), x)
    rgb_aw = [adapt(rgb_d[i] * rgb_w[i]) for i in range(3)]
    aw = (2 * rgb_aw[0] + rgb_aw[1] + 0.05 * rgb_aw[2]) * nbb
    return dict(m16=m16, rgb_d=rgb_d, adapt=adapt, nbb=nbb, ncb=nbb, aw=aw, c=c, z=z, nc=nc, n=n)


_CAM = _cam16_setup()


def cam16_hue_chroma(lin_rgb):
    """(hue, chroma) of a linear-sRGB color in CAM16 under Material's default viewing conditions."""
    xyz = tuple(100 * v for v in _mat(_SRGB_TO_XYZ, lin_rgb))
    rc = _mat(_CAM["m16"], xyz)
    ra, ga, ba = (_CAM["adapt"](rc[i] * _CAM["rgb_d"][i]) for i in range(3))
    a = (11 * ra - 12 * ga + ba) / 11
    b = (ra + ga - 2 * ba) / 9
    u = (20 * ra + 20 * ga + 21 * ba) / 20
    p2 = (40 * ra + 20 * ga + ba) / 20
    hue = math.degrees(math.atan2(b, a)) % 360
    ac = p2 * _CAM["nbb"]
    if ac <= 0:
        return hue, 0.0
    j = 100 * (ac / _CAM["aw"]) ** (_CAM["c"] * _CAM["z"])
    et = 0.25 * (math.cos(math.radians(hue) + 2) + 3.8)
    p1 = 50000 / 13 * et * _CAM["nc"] * _CAM["ncb"]
    if u + 0.305 <= 0:
        return hue, float("inf")  # far outside any display gamut; callers only need "too chromatic"
    t = p1 * math.hypot(a, b) / (u + 0.305)
    alpha = (t ** 0.9) * (1.64 - 0.29 ** _CAM["n"]) ** 0.73
    return hue, alpha * math.sqrt(j / 100)


def hct_chroma_of_hex(hx):
    return cam16_hue_chroma(hex_to_linear(hx))[1]


_MAXC_CACHE = {}


def max_chroma(L, H, gamut="srgb"):
    key = (round(L, 5), round(H, 3), gamut)
    if key in _MAXC_CACHE:
        return _MAXC_CACHE[key]
    lo, hi = 0.0, 0.45
    for _ in range(28):
        mid = (lo + hi) / 2
        rgb = oklch_to_linear_srgb(L, mid, H)
        if gamut == "p3":
            rgb = linear_srgb_to_linear_p3(rgb)
        if in_gamut(rgb):
            lo = mid
        else:
            hi = mid
    _MAXC_CACHE[key] = lo
    return lo


def oklch_chroma_for_hct(hct_c, L, H):
    """OKLCH chroma that has the given CAM16 (HCT) chroma at this OKLCH lightness and hue."""
    if hct_c <= 0:
        return 0.0
    lo, hi = 0.0, 0.45
    for _ in range(18):
        mid = (lo + hi) / 2
        if cam16_hue_chroma(oklch_to_linear_srgb(L, mid, H))[1] < hct_c:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def y_of_oklch(L, C, H):
    r, g, b = (clamp(v, 0, 1) for v in oklch_to_linear_srgb(L, C, H))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


# =============================================================================================
# Levers: load and evaluate the dial maps in levers.json
# =============================================================================================

_LEVERS = None


def levers():
    global _LEVERS
    if _LEVERS is None:
        path = os.path.join(REFERENCES, "levers.json")
        if not os.path.exists(path):  # running from the research repo before the skill copy exists
            alt = os.path.join(SKILL_ROOT, "..", "..", "synthesis", "levers.json")
            path = alt if os.path.exists(alt) else path
        _LEVERS = read_json(path)
    return _LEVERS


def lever_index():
    idx = {}
    for d in levers()["dials"]:
        for drv in d["drives"]:
            idx[drv["param"]] = dict(drv, dial=d["id"])
    return idx


def eval_map(m, x):
    """Evaluate a levers.json map at dial value x (0-100). Bands are inclusive; anchors interpolate."""
    if m["kind"] == "bands":
        xi = int(round(x))
        for lo, hi, val in m["bands"]:
            if lo <= xi <= hi:
                return copy.deepcopy(val)
        return copy.deepcopy(m["bands"][-1][2])
    pts = m["points"]
    if x <= pts[0][0]:
        return copy.deepcopy(pts[0][1])
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            if isinstance(y0, (int, float)) and isinstance(y1, (int, float)):
                t = 0 if x1 == x0 else (x - x0) / (x1 - x0)
                return y0 + t * (y1 - y0)
            if isinstance(y0, dict) or isinstance(y1, dict):
                return _interp_tint(x, x0, y0, x1, y1)
            # "max" anchor (gamut maximum): numeric stand-in large enough to always clamp to gamut
            y0n = 120.0 if y0 == "max" else y0
            y1n = 120.0 if y1 == "max" else y1
            t = 0 if x1 == x0 else (x - x0) / (x1 - x0)
            return y0n + t * (y1n - y0n)
    return copy.deepcopy(pts[-1][1])


def _interp_tint(x, x0, y0, x1, y1):
    """Warmth anchors: linear on chroma between neighbouring anchors; hue from the non-zero side."""
    t = 0 if x1 == x0 else (x - x0) / (x1 - x0)
    c = y0["c"] + t * (y1["c"] - y0["c"])
    h = y0["h"] if y0.get("h") is not None and (y1.get("h") is None or t < 0.5) else y1.get("h")
    if h is None:
        h = y0.get("h")
    return {"c": c, "h": h}


# =============================================================================================
# State: defaults, dial resolution (presets, coupling, macros), derived parameters
# =============================================================================================

POSTURE = ("expression", "brandPresence", "density")
CHARACTER = ("energy", "roundness", "depth", "colorfulness", "warmth")
DIALS = POSTURE + CHARACTER

HOOK_STATUSES = ["pending", "have", "commissioning", "tool", "open-library", "placeholder", "not-needed"]
SET_BY = ["chosen", "confirmed_default", "auto_default", "assumed", "delegated", "reference", "asset", "standard", "research"]
# spec 7.9; standard: KNOWLEDGE.md 1; research: a recommendation from the user research (research.py) the person said yes to
# state["standards"] (docs/KNOWLEDGE.md): house_version, applied ids, overridden {id: {why, decision, date}}, project standards,
# retired ids already handled, and records {id: {paths: {state path: value}, decision, locked, kept}} so each value points at its decision
STD_STATE = {"house_version": None, "applied": [], "overridden": {}, "project": [], "retired_seen": [], "records": {}}
SET_BY_ALIASES = {"confirmed": "chosen", "default": "confirmed_default", "pending": "assumed"}
FALLBACK_HOOKS = [
    ("H-logo", "Logo, wordmark, symbol, lockups", "Q-brand-03"), ("H-appicon", "App icon", "Q-icon-06"),
    ("H-favicon", "Favicon set", "Q-brand-03"), ("H-icons", "Custom icons, pictograms, spot icons", "Q-icon-01"),
    ("H-illus", "Illustration, characters, empty-state art", "Q-img-04"),
    ("H-photo", "Photography and art direction", "Q-img-01"), ("H-type", "Brand typeface files", "Q-type-02"),
    ("H-color", "Fixed brand colors", "Q-color-01"), ("H-motion", "Motion signature and rich media", "Q-img-06"),
    ("H-motif", "Graphic devices, patterns, textures, brand gradients", "Q-img-07"),
    ("H-sound", "UI sounds and sonic logo", "Q-motion-08"), ("H-haptic", "Custom haptic patterns", "Q-motion-09"),
    ("H-voice", "Voice and tone guide", "Q-voice-01"), ("H-brandbook", "Brand guidelines PDF", "Q-ref-01"),
]


def hook_catalog():
    path = os.path.join(REFERENCES, "hooks.json")
    if os.path.exists(path):
        try:
            data = read_json(path)
            out = [(h["id"], h.get("name", h["id"]), (h.get("questions") or [None])[0])
                   for h in data.get("hooks", []) if h.get("kind") == "asset"]
            if out:
                return out
        except (ValueError, KeyError):
            pass
    return FALLBACK_HOOKS


DEFAULT_COMPONENTS = [  # Q-comp-02 default "core-25": the 25 components in 8-10 of the 10 benchmark systems (DC-L08-01)
    "button", "text-field", "textarea", "select", "checkbox", "radio", "switch", "slider", "tabs", "tooltip",
    "popover", "dialog", "menu", "progress-bar", "spinner", "banner", "badge", "avatar", "card", "list",
    "table", "link", "breadcrumbs", "side-navigation", "accordion",
]


def default_state(name="Untitled design system"):
    raw = {r["id"]: copy.deepcopy(r["default"]) for r in levers()["raw"]}
    raw.update({
        "brandColor": None, "primaryActionColor": None, "focusColor": None, "neutralBase": None,
        "secondaryColors": [], "contrastTarget": "AA", "textFace": "system", "displayFace": "=textFace",
        "monoFace": "ui-monospace", "baseSize": None, "spaceUnit": 4, "platforms": ["web"],
        "inputs": ["pointer", "touch"], "productType": "work-tool", "marketingSurfaces": False,
        "scripts": ["Latn"], "domain": None, "defaultTheme": "system",
        # Q-pattern-07: how data tables separate rows, whether the header stays in view, how numbers align
        "tableRows": "lines", "tableHeader": "sticky", "tableNumbers": "right",
    })
    # brandExact on by default: a person's own brand hex that passes the contrast target stays exact (U5 F10, F3)
    raw["flags"] = {"brandExact": True, "tintTowardBrand": False, "motionOff": False, "darkMode": True, "p3": True}
    return {
        "$schema": STATE_SCHEMA,
        "schema_version": 1,
        "engine_version": ENGINE_VERSION,
        "levers_version": f"{levers().get('schema')} {levers().get('date')}",
        "opendesigner": {"version": OPENDESIGNER_VERSION, "created": OPENDESIGNER_VERSION},  # dump_json keeps it current
        "mode": "standard",
        "name": name,
        "summary": "",
        "context": {"product": "", "audience": "", "surfaces": [], "entryPath": "", "memorable": "", "scope": {"in": [], "out": []},
                    "constraints": [], "team": "",
                    # the alignment record (PRODUCT.md, Purpose and goals): from their words and README, never invented
                    "mission": "", "vision": "", "purpose": "", "goals": [],
                    # PRODUCT.md, Market: from the user research or their words
                    "market": {"analogous": "", "competitors": [], "pattern": "", "gap": "", "conventions": []}},
        "dials": {d: None for d in DIALS},
        "preset": None,
        "style": None,  # the named look from references/styles.md (Q-dir-01), shown in DESIGN.md
        "customStyles": {},  # the person's own and experimental styles (engine.py style define), on the same 12 trait axes
        "macros": [],
        "raw": raw,
        "overrides": {},
        "answers": {},
        "principles": [],
        "components": {"base": None, "inventory": list(DEFAULT_COMPONENTS), "notes": {}},
        "hooks": {hid: {"status": "pending", "name": n, "question": q, "files": [], "note": ""} for hid, n, q in hook_catalog()},
        "zoom": {},
        "profile": {"voice": "plain"},
        "blocks": {},
        "references": {},
        "taste": {},
        "research": {},  # user research summary (research.py): status, brief, counts, highlights, proposals
        "hashes": {},
        "exports": {"prefix": "ds", "figmaPlan": "professional", "tailwindReset": True},
        "locks": [],
        "standards": copy.deepcopy(STD_STATE),
    }


def merge_defaults(state):
    """Fill any keys missing from an older or hand-written state with defaults (never overwrites)."""
    base = default_state(state.get("name", "Untitled design system"))
    base.pop("opendesigner")  # a state without a version stamp was made before stamps; a filled-in stamp would hide that

    def fill(dst, src):
        for k, v in src.items():
            if k not in dst:
                dst[k] = copy.deepcopy(v)
            elif isinstance(v, dict) and isinstance(dst[k], dict) and k not in ("overrides", "answers", "notes"):
                fill(dst[k], v)
    fill(state, base)
    return state


def dial_value(v):
    """Dials are stored as {value, set_by, detached} (spec 7.10); plain numbers are accepted too."""
    if isinstance(v, dict):
        return v.get("value")
    return v


def answer_value(v):
    if isinstance(v, dict) and "value" in v:
        return v["value"]
    return v


def _macro_list(state):
    out = []
    for m in state.get("macros") or []:
        if isinstance(m, str):
            out.append((m, 1.0))
        elif isinstance(m, dict) and m.get("id"):
            out.append((m["id"], float(m.get("strength", 1.0))))
    return out


DEFAULT_PRESET = "flat2"  # Q-dir-01's default_value (references/questions.json); applies until Q-dir-01 is answered


def effective_preset(state):
    """(preset id, is_default). An unanswered Q-dir-01 takes its default like any other question (spec 7.9)."""
    if state.get("preset"):
        return state["preset"], False
    if "Q-dir-01" in (state.get("answers") or {}):
        return None, False
    return DEFAULT_PRESET, True


_STYLES = None


def styles_doc():
    """references/styles.json: the style catalogue, its 12 trait axes, look words and trait words (synthesis/styles.json)."""
    global _STYLES
    if _STYLES is None:
        path = os.path.join(REFERENCES, "styles.json")
        if not os.path.exists(path):  # running from the research repo before the skill copy exists
            alt = os.path.join(SKILL_ROOT, "..", "..", "synthesis", "styles.json")
            path = alt if os.path.exists(alt) else path
        _STYLES = read_json(path) if os.path.exists(path) else {"axes": {}, "list": []}
    return _STYLES


STYLE_AXES = ("surface", "edge", "depth", "shape", "color", "contrast", "type", "scale", "texture", "imagery", "ornament", "layout",
              "density", "motion", "theme")
# How a trait value moves the dials and the build, for styles that carry only traits (new, experimental, custom) [inferred:
# each value sits in the band levers.json gives that look; depth 90 is the glass band, 5 keeps a hard-offset style flat]
TRAIT_DIALS = {
    "shape": ("roundness", {"sharp": 0, "subtle": 30, "rounded": 70, "pill": 97, "blob": 90, "geometric": 8, "irregular": 55, "pixel": 0}),
    "color": ("colorfulness", {"monochrome": 5, "muted": 22, "neutral-accent": 38, "tonal": 55, "vivid": 82, "neon": 95, "pastel": 50,
                               "earthy": 45, "duotone": 70, "spot-inks": 75, "metallic": 28, "rainbow": 95}),
    "depth": ("depth", {"flat": 8, "ring": 25, "tonal": 45, "soft-shadow": 68, "hard-offset": 5, "extruded": 68, "inner": 72, "glass": 90,
                        "glow": 40, "long-shadow": 10, "layered": 72}),
    "motion": ("energy", {"still": 8, "subtle": 30, "springy": 68, "bouncy": 85, "stepped": 40, "glitchy": 65}),
    "density": ("density", {"airy": 25, "dense": 75}),
}
ORNAMENT_EXPRESSION = {"none": 35, "geometric-shapes": 80, "squiggles": 85, "stickers": 85, "ascii": 50, "ornamental": 78}
IMAGERY_EXPRESSION = {"none": 35, "photo": 55, "illustration": 60, "3d": 70, "icon-led": 40, "type-only": 45}
SCALE_RATIO = {"even": 1.2, "moderate": 1.25, "dramatic": 1.333}  # the Q-dir-03 ratios (subtle, balanced, dramatic)
DEPTH_MODELS = {"hard-offset": "offset", "extruded": "extruded", "inner": "clay", "glow": "glow"}  # the rest follow the Depth band
TEXTURE_BUILT = {"grain": "grain", "paper": "grain", "halftone": "halftone", "scanlines": "scanlines"}  # dither, pattern, glitch: assets
LOUD = {"surface": {"translucent", "gradient", "metallic", "glossy", "luminous"}, "edge": {"thick-outline", "beveled", "rough"},
        "depth": {"glass", "glow", "hard-offset", "extruded", "inner", "long-shadow"}, "color": {"neon", "rainbow"}, "imagery": {"3d"},
        "ornament": {"squiggles", "stickers", "geometric-shapes", "ornamental"}, "motion": {"bouncy", "glitchy"}}
SURFACE_EFFECTS = {("surface", v) for v in ("translucent", "gradient", "metallic", "glossy", "luminous")} | \
    {("depth", v) for v in ("glass", "glow", "hard-offset", "extruded", "inner", "long-shadow")}  # one per surface (DC-L19-67)


def style_from_traits(traits, ui_fit="core-ui"):
    """(preset, dials, build) for a style described only by its traits."""
    t = {k: v for k, v in (traits or {}).items() if k in STYLE_AXES}
    dials = {dial: table[t[ax]] for ax, (dial, table) in TRAIT_DIALS.items() if t.get(ax) in table}
    expr = max(ORNAMENT_EXPRESSION.get(t.get("ornament"), 35), IMAGERY_EXPRESSION.get(t.get("imagery"), 35)) \
        + (10 if t.get("layout") in ("collage", "asymmetric") else 0) + (5 if t.get("scale") == "dramatic" else 0) + (5 if ui_fit == "marketing" else 0)
    dials["expression"] = int(clamp(expr, 0, 100))
    if t.get("color") == "earthy":
        dials["warmth"] = 45  # warmth above 45 turns the greys beige (synthesis/styles.json about)
    build = {"elevationModel": DEPTH_MODELS.get(t.get("depth")), "borderDefault": {"thick-outline": 3, "outline": 2}.get(t.get("edge"), 1),
             "texture": TEXTURE_BUILT.get(t.get("texture")), "typeRatio": SCALE_RATIO.get(t.get("scale"))}
    if t.get("surface") in ("gradient", "luminous"):
        build["gradient"] = "brand"
    if t.get("depth") == "glass" or t.get("surface") == "translucent":
        preset = "glass"
    elif t.get("depth") == "hard-offset" or t.get("edge") == "thick-outline":
        preset = "neobrutal"
    elif t.get("depth") in ("extruded", "inner"):
        preset = "soft"
    elif t.get("color") in ("neon", "rainbow") and ui_fit == "marketing" and t.get("ornament") in LOUD["ornament"]:
        preset = "maximal"
    elif t.get("shape") in ("pill", "blob") and t.get("depth") in ("tonal", "soft-shadow"):
        preset = "tonal"
    else:
        preset = "flat2"
    return preset, dials, build


def complete_style(s):
    """A catalogue or custom entry with preset, dials and build filled in. An entry with its own dials is tuned: it keeps
    exactly what it says (the first 28 styles). Otherwise its traits give them, and anything it states wins."""
    s = dict(s)
    s.setdefault("kind", "look")
    if "dials" in s:
        s.setdefault("build", {})
        return s
    preset, dials, build = style_from_traits(s.get("traits"), s.get("ui_fit", "core-ui"))
    s.setdefault("preset", preset if s["kind"] == "look" else None)
    s["dials"], s["build"] = dict(dials, **(s.get("dialOverrides") or {})), dict(build, **(s.get("build") or {}))
    s["derived"] = True
    return s


def style_list(state=None):
    """{style id: entry}: the catalogue (references/styles.json), then the person's own and experimental styles (state customStyles)."""
    out = {s["id"]: complete_style(s) for s in styles_doc().get("list", [])}
    for sid, s in ((state or {}).get("customStyles") or {}).items():
        if isinstance(s, dict):
            out[sid] = complete_style(dict(s, id=sid, custom=True))
    return out


def effective_style(state):
    """The named look the system follows (Q-dir-01), or None. Layout, texture, image and drawing styles are never the look."""
    s = style_list(state).get(state.get("style")) if isinstance(state.get("style"), str) else None
    return s if s and s.get("kind") == "look" else None


def look_build(state):
    """What the engine builds beyond the dials: the preset's build, then the style's, then the person's raw inputs."""
    pid, _default = effective_preset(state)
    preset = next((p for p in levers()["presets"] if p["id"] == pid), None) if pid else None
    out = {k: v for k, v in ((preset or {}).get("build") or {}).items() if k not in ("evidence", "note")}
    out.update((effective_style(state) or {}).get("build") or {})
    raw = state.get("raw") or {}
    for key in ("borderDefault", "texture"):
        if raw.get(key) is not None:
            out[key] = raw[key]
    return out


def resolve_dials(state):
    """Effective dial values. Order: explicit value > style > preset > coupling/default; then macro offsets on
    untouched dials (not set and not a style's); clamp 0-100. Touching a dial detaches it from coupling and macros (LEVERS A0, A9)."""
    L = levers()
    explicit = {k: dial_value(v) for k, v in (state.get("dials") or {}).items() if dial_value(v) is not None}
    pid, _default = effective_preset(state)
    preset = next((p for p in L["presets"] if p["id"] == pid), None) if pid else None
    style = effective_style(state)
    sdials = (style or {}).get("dials") or {}
    macros = {m["id"]: m for m in L["macros"]}
    offsets, pushes = {}, {}
    for mid, strength in _macro_list(state):
        m = macros.get(mid)
        if not m:
            continue
        for dial, off in m["offsets"].items():
            offsets[dial] = offsets.get(dial, 0) + off * strength
            pushes.setdefault(dial, []).append((mid, off * strength))
    conflicts = []
    for dial, lst in pushes.items():  # a dial the person or the style holds takes no macro offset, so it has no conflict to show
        if dial not in explicit and dial not in sdials and any(o > 0 for _, o in lst) and any(o < 0 for _, o in lst):
            conflicts.append({"dial": dial, "macros": [m for m, _ in lst],
                              "rule": "macroRules.conflict: show the conflict, do not average silently (L06 4.2)"})
    src, out = {}, {}

    def base(d, fallback):
        if d in explicit:
            src[d] = "set"
            return float(explicit[d])
        if d in sdials:
            src[d] = f"style:{style['id']}"
            return float(sdials[d])
        if preset and d in preset["dials"]:
            src[d] = f"preset:{preset['id']}"
            return float(preset["dials"][d])
        src[d] = "coupled" if d in ("energy", "roundness", "colorfulness", "depth") else "default"
        return float(fallback)

    def fin(d, v):  # a style's dial holds like a set one: its tested value is not moved by feel words (warmth 80 turns greys beige)
        if d not in explicit and d not in sdials and d in offsets:
            v += offsets[d]
            src[d] += "+macros"
        out[d] = int(round(clamp(v, 0, 100)))

    for d in POSTURE:
        fin(d, base(d, 50))
    e, dn = out["expression"], out["density"]
    fin("energy", base("energy", 50 + 0.5 * (e - 50)))
    fin("roundness", base("roundness", 50 + 0.5 * (e - 50) - 0.2 * max(0, dn - 50)))
    fin("colorfulness", base("colorfulness", 50 + 0.5 * (e - 50) + 0.3 * (out["energy"] - 50)))
    floor = int((L.get("macroRules") or {}).get("brandFloor", {}).get("colorfulness", 36))
    if state["raw"].get("brandColor") and "colorfulness" not in explicit and out["colorfulness"] < floor:
        out["colorfulness"] = floor  # a brand color never disappears behind feel words or presets (levers macroRules.brandFloor)
        src["colorfulness"] += "+brand floor"
    prof = default_profile(state)
    for item in (prof or {}).get("items", {}).values():  # a default profile lifts the dials nobody set (levers profiles)
        for dial, lo in (item.get("dialFloor") or {}).items():
            if out[dial] < lo and not src[dial].startswith(("set", "style:")):  # a set dial or a named style's dial is a choice
                out[dial] = lo
                src[dial] += f"+{prof['id']} floor"
    dep = base("depth", 40 + 0.5 * (e - 50))
    fin("depth", dep)
    materials_ok = e > 60 and any(p in ("ios", "ipados", "macos", "visionos", "windows")
                                  for p in state["raw"].get("platforms", []))
    if src["depth"].startswith("coupled") and out["depth"] > 80 and not materials_ok:
        out["depth"] = 80  # coupling rule: materials band only if expression > 60 and platform supports it
    fin("warmth", base("warmth", 50))
    return out, src, conflicts


def main_surface(state):
    """The main surface's mode (Persuade, Operate, Read, Experience) from Q-scope-06, else from raw.productType marketing."""
    v = answer_value((state.get("answers") or {}).get("Q-scope-06"))
    surfaces = surface_list(v) if v else []
    if surfaces:
        return surfaces[0]["mode"]
    return "Persuade" if (state.get("raw") or {}).get("productType") == "marketing" else None


def _profile_trigger(state, trig):
    """The trigger's words when it holds ("Q-aud-01 = dense", "main surface: Persuade"), else None."""
    if not trig:
        return None
    if "surface" in trig:
        mode = main_surface(state)
        return f"main surface: {mode}" if mode in trig["surface"] else None
    v = answer_value((state.get("answers") or {}).get(trig["question"]))
    return f"{trig['question']} = {v}" if str(v) in [str(x) for x in trig["values"]] else None


def default_profile(state):
    """The default profile whose trigger holds (levers.json profiles), or None: {id, name, why, evidence, trigger, items
    it applies, skipped: {item: reason}}. A profile fills only what the person left open: an item is skipped when its
    question is answered, its dial or value was set, overridden or locked, or a brand color decides it. Applied items
    are recorded as auto_default (spec 7.9)."""
    for pid, prof in (levers().get("profiles") or {}).items():
        trig = prof.get("trigger") if isinstance(prof, dict) else None
        said = _profile_trigger(state, trig)
        if not said:
            continue
        items, skipped = {}, {}
        for iid, it in prof["items"].items():
            why = _profile_skip(state, it.get("skipIf") or {})
            if why:
                skipped[iid] = why
            else:
                items[iid] = it
        return {"id": pid, "name": prof.get("name", pid), "why": prof.get("why", ""), "evidence": prof.get("evidence", []),
                "trigger": said, "items": items, "skipped": skipped}
    return None


def _profile_skip(state, rule):
    """Why a profile item stays out, in plain words, or '' when nothing the person did decides it."""
    answers, dials, overrides = state.get("answers") or {}, state.get("dials") or {}, state.get("overrides") or {}
    for q in rule.get("answered") or []:
        if q in answers:
            return f"you answered {q}"
        if q == "Q-dir-01" and (state.get("preset") or state.get("style")):  # a preset or named style set directly is a choice too
            return "you chose a style direction (Q-dir-01)"
    for q, vals in (rule.get("answerIn") or {}).items():
        if str(answer_value(answers.get(q))) in [str(x) for x in vals]:
            return f"you answered {q} {answer_value(answers.get(q))}"
    for dial in rule.get("dials") or []:
        if dial_value(dials.get(dial)) is not None:
            return f"the {dial} dial is set"
        if is_locked(state, "dials." + dial):
            return f"the {dial} dial is locked"
    for p in rule.get("params") or []:
        if p in overrides or is_locked(state, "overrides." + p):
            return f"{p} is {'set' if p in overrides else 'locked'}"
    for r in rule.get("raw") or []:
        if (state.get("raw") or {}).get(r):
            return "your brand color decides it" if r == "brandColor" else f"raw.{r} decides it"
    return ""


def profile_record(prof):
    """The profile as opendesigner.meta.json records it: each applied item auto_default, with its reason and evidence."""
    if not prof:
        return None
    why = f"{prof['name']} default ({prof['trigger']}); nothing you answered, set or locked decides it"
    return {"id": prof["id"], "name": prof["name"], "trigger": prof["trigger"], "why": prof["why"], "evidence": prof["evidence"],
            "applied": [{"item": iid, "what": it["what"], "set_by": "auto_default", "reason": why,
                         "evidence": it.get("evidence", []), "inferred": it.get("inferred", False)} for iid, it in prof["items"].items()],
            "skipped": prof["skipped"]}


def log_profile_change(d, old_state, state, write=True):
    """One auto_default entry in decisions.md when a default profile starts, stops, or hands an item over to the person's
    own answer. Returns a one-line summary for the terminal, or None when nothing changed. write=False (a dry run) only
    returns the line."""
    before, after = default_profile(old_state), default_profile(state)
    b, a = list((before or {}).get("items") or {}), list((after or {}).get("items") or {})
    if b == a and (before or {}).get("id") == (after or {}).get("id"):
        return None
    prof = after or before
    if after and a:
        why = (f"{after['name']} defaults for what you have not answered, set or locked ({after['trigger']}). "
               "Confirm or change any of them like any other answer.")
        extra = [f"{i}: {after['items'][i]['what']} [{', '.join(after['items'][i].get('evidence', []))}]" for i in a]
        extra += [f"no longer a default: {i} ({after['skipped'].get(i, 'changed')})" for i in b if i not in a]
        line = f"{after['name'].lower()} defaults ({after['trigger']}): " + ", ".join(a) + " (auto_default; see decisions.md)"
    else:
        why = (f"{prof['name']} defaults off: " + (f"{after['trigger']}, but you decided each of them yourself"
                                                   if after else "its trigger no longer holds") + ".")
        extra = [f"no longer a default: {i} ({(after or {}).get('skipped', {}).get(i, 'trigger gone')})" for i in b]
        line = f"{prof['name'].lower()} defaults off"
    if write:
        log_decision(d, f"defaults.{prof['id']}", a, why, "auto_default", source_ref=", ".join(prof["evidence"]), extra=extra)
    return line


def body_branch(state):
    """Which body size the middle density band uses (levers type.baseSize.web 34-66: content 16, work-tool 14). The
    person's page type decides first (Q-layout-03, Q-scope-06, or a product type other than the default); then Q-aud-02
    (work tools 14, everyday and play apps 16); then Q-aud-01, whose regular option promises 16px body."""
    raw, answers = state.get("raw") or {}, state.get("answers") or {}
    kind = raw.get("productType") or "work-tool"
    if kind != "work-tool" or "Q-layout-03" in answers or "Q-scope-06" in answers:
        return kind
    stakes = answer_value(answers.get("Q-aud-02"))
    if stakes in ("work", "consumer", "play"):
        return "work-tool" if stakes == "work" else "content"
    return "content" if answer_value(answers.get("Q-aud-01")) in ("regular", "large") else kind


def derive_params(state, dials):
    """Evaluate every levers.json drive at the effective dials, then apply overrides (DC-L16-14)."""
    params, meta = {}, {}
    for pid, drv in lever_index().items():
        v = eval_map(drv["map"], dials[drv["dial"]])
        params[pid] = v
        meta[pid] = {"dial": drv["dial"], "evidence": drv.get("evidence", []), "inferred": drv.get("inferred", False)}
    raw = state["raw"]
    # density band value may depend on product type
    bs = params["type.baseSize.web"]
    if isinstance(bs, dict):
        params["type.baseSize.web"] = bs.get(body_branch(state), bs.get("content", 16))
    # ratio capped by density (LEVERS B6)
    cap = params.get("type.ratioCap")
    if cap:
        params["type.ratio"] = min(params["type.ratio"], cap)
    prof = default_profile(state)
    for item in (prof or {}).get("items", {}).values():  # floors from a default profile; the person's overrides still win below
        for k, lo in (item.get("paramFloor") or {}).items():
            if isinstance(params.get(k), (int, float)) and params[k] < lo:
                params[k] = lo
                meta[k]["profile"] = prof["id"]
        for k, v in (item.get("paramSet") or {}).items():  # a value that is not a number (a density mode, a hero rule)
            if params.get(k) != v:
                params[k] = v
                meta.setdefault(k, {})["profile"] = prof["id"]
    for k, v in (state.get("overrides") or {}).items():
        params[k] = v
        meta.setdefault(k, {})["override"] = True
    return params, meta


# =============================================================================================
# Color: contrast-indexed 12-step ramps in OKLCH, separate light and dark ramps (LEVERS B1-B5)
# =============================================================================================

STEP_JOBS = {1: "app background", 2: "subtle background", 3: "component background", 4: "component hover",
             5: "component pressed or selected", 6: "subtle border", 7: "interactive border (decorative)",
             8: "strong border, focus, 3:1 boundary", 9: "solid fill (peak chroma)", 10: "solid hover, tertiary text",
             11: "low-contrast text", 12: "high-contrast text"}
# Chroma curve as a fraction of the peak (peak at step 9, falling toward both ends; Radix pattern S-L01-002).
ACCENT_CURVE_LIGHT = [0.04, 0.08, 0.17, 0.27, 0.37, 0.47, 0.57, 0.75, 1.0, 0.95, 0.85, 0.45]
ACCENT_CURVE_DARK = [0.08, 0.12, 0.23, 0.33, 0.43, 0.53, 0.67, 0.87, 1.0, 1.0, 0.93, 0.33]
NEUTRAL_CURVE = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.0, 0.9, 0.6]
MARGIN = 1.02         # solve 2% above each WCAG floor so 8-bit hex rounding never drops below it [inferred]
LIGHT_STEP1 = 1.02    # contrast of step 1 against white (build_tokens.py starter set) [inferred]
LIGHT_STEP7 = 1.65    # decorative border anchor (Radix gray7 #cecece is 1.6:1) [inferred]
DARK_STEP1_Y = 0.0075  # dark base luminance, inside the #121212-#1a1a1a band (DC-L01-19)
DARK_STEP7 = 2.0      # vs dark step 1 (Radix dark gray7 is 2.06:1 against gray1) [inferred]
DARK_ACCENT_CHROMA = 26 / 32  # Material 2025 TonalSpot primary chroma 32 light -> 26 dark (DC-L01-19)
# Status seeds: hue and whether the solid carries dark text (warning), as in Atlassian and Radix [inferred]
STATUS = {"success": (150, 0.55, "light"), "warning": (80, 0.80, "dark"), "danger": (27, 0.55, "light"),
          "info": (240, 0.55, "light")}


def target_y(ratio, y_ref, darker):
    """Luminance a foreground needs to reach `ratio` against y_ref (darker or lighter than it)."""
    y = (y_ref + 0.05) / ratio - 0.05 if darker else ratio * (y_ref + 0.05) - 0.05
    return clamp(y, 0.0, 1.0)


class Ramp:
    """One 12-step ramp for one mode. Steps are dicts with L, C, H, hex, y (WCAG luminance)."""

    def __init__(self, name, mode, hue, chroma_fn, text_on_solid="light", seed=None):
        self.name, self.mode, self.hue = name, mode, hue
        self.chroma_fn = chroma_fn  # (step, L) -> OKLCH chroma before gamut clamp
        self.text_on_solid = text_on_solid
        self.seed = seed
        self.steps = {}
        self.pinned = None
        self.p3 = {}

    def color_at(self, step, L):
        want = self.chroma_fn(step, L)
        C = min(want, max_chroma(L, self.hue))
        return C, want

    def set_L(self, step, L):
        C, want = self.color_at(step, L)
        hx = oklch_to_hex(L, C, self.hue)
        self.steps[step] = {"L": L, "C": C, "H": self.hue, "hex": hx, "y": luminance(hx), "want": want}

    def solve_y(self, step, y_target):
        lo, hi = 0.0, 1.0
        for _ in range(34):
            mid = (lo + hi) / 2
            C, _w = self.color_at(step, mid)
            if y_of_oklch(mid, C, self.hue) < y_target:
                lo = mid
            else:
                hi = mid
        self.set_L(step, (lo + hi) / 2)

    def y(self, step):
        return self.steps[step]["y"]

    def hexes(self):
        return [self.steps[i]["hex"] for i in range(1, 13)]


def build_ramp(name, mode, hue, chroma_fn, text_on_solid, cfg, neutral=None, seed=None):
    """Solve a ramp. cfg: text_min (4.5 or 7), c12 (primary text target), light/dark references.
    neutral: the already-solved neutral Ramp of this mode (None when building the neutral itself)."""
    r = Ramp(name, mode, hue, chroma_fn, text_on_solid, seed)
    light = mode == "light"
    tmin = cfg["text_min"] * MARGIN
    ref = neutral or r

    if light:
        r.solve_y(1, target_y(LIGHT_STEP1, 1.0, True))
        r.solve_y(7, target_y(LIGHT_STEP7, 1.0, True))
    else:
        if neutral is None:
            r.solve_y(1, cfg.get("dark_base_y", DARK_STEP1_Y))
        else:
            r.solve_y(1, target_y(1.03, neutral.y(1), False))
        r.solve_y(7, target_y(DARK_STEP7, ref.y(1), False))
    L1, L7 = r.steps[1]["L"], r.steps[7]["L"]
    for i in range(2, 7):  # steps 2-6 evenly spaced in lightness between step 1 and step 7 (see NOTES)
        r.set_L(i, L1 + (L7 - L1) * (i - 1) / 6)

    def refs(upto):
        ys = [r.y(i) for i in range(1, upto + 1)]
        if neutral is not None:
            ys += [neutral.y(i) for i in range(1, upto + 1)]
        if light:
            ys.append(1.0)  # white raised and overlay surfaces
            return min(ys)  # darkest background is the worst case for dark text
        return max(ys)      # lightest background is the worst case for light text

    # step 8 carries 3:1 boundaries on surfaces and on the neutral subtle fill (light: steps 1-3, dark: 1-5)
    r.solve_y(8, target_y(3.0 * MARGIN, refs(3 if light else 5), light))
    # step 9: solid fill. Light text (white) or dark text on it, chosen per hue (on-color-auto, S-L06-094)
    if light:
        if text_on_solid == "light":
            r.solve_y(9, target_y(tmin, 1.0, True))  # white text on the solid meets the text minimum (AA or AAA)
        else:
            dark_text_y = neutral.y(12) if neutral else 0.012
            y_min = target_y(tmin, dark_text_y, False)
            seed_L = seed[0] if seed else 0.8
            r.set_L(9, seed_L)
            if r.y(9) < y_min:
                r.solve_y(9, y_min)
        c9 = contrast_y(r.y(9), 1.0)
        y10 = target_y(c9 * 1.15, 1.0, True)
        if text_on_solid == "light":
            y10 = min(y10, target_y(tmin, refs(4), True))  # step 10 doubles as tertiary text
        else:
            y10 = max(y10, y_min)
        r.solve_y(10, y10)
        c10 = contrast_y(r.y(10), 1.0)
        if text_on_solid == "dark":  # pressed for a light solid: darker again, still carrying dark text (step "13")
            r.solve_y(13, max(target_y(c10 * 1.15, 1.0, True), y_min))
        r.solve_y(11, min(target_y(max(c10, contrast_y(r.y(9), 1.0)) * 1.22, 1.0, True),
                          target_y(tmin, refs(4), True)))
        r.solve_y(12, min(target_y(cfg["c12"], 1.0, True), target_y(7.0 * MARGIN, refs(5), True)))
    else:
        n1 = ref.y(1)
        y9 = max(target_y(tmin, n1, False), r.y(8) * 1.04)  # dark solids are lighter and carry dark text (Material 80/20)
        r.solve_y(9, y9)
        if seed is not None:
            seed_L = min(seed[0], 0.82)
            if seed_L > r.steps[9]["L"]:
                r.set_L(9, seed_L)
        c9 = contrast_y(r.y(9), n1)
        y10 = max(target_y(c9 * 1.15, n1, False), target_y(tmin, refs(4), False))
        r.solve_y(10, y10)
        c10 = contrast_y(r.y(10), n1)
        # dark neutral fills sit on steps 5-7, so secondary text must clear step 6 and primary text step 7
        y11 = target_y(tmin, refs(6), False)
        if text_on_solid == "light":
            y11 = max(y11, target_y(c10 * 1.2, n1, False))
        r.solve_y(11, y11)
        y12 = max(target_y(cfg["c12"], n1, False), target_y(7.0 * MARGIN, refs(5), False), target_y(tmin, refs(7), False))
        r.solve_y(12, min(1.0, max(y12, r.y(11) + 0.05)))  # step 12 always lighter than step 11
    return r


def neutral_alpha(hx, bg_hex, mode):
    """Radix-style alpha twin: the most transparent color that composites over bg to hx."""
    c, b = hex_to_rgb8(hx), hex_to_rgb8(bg_hex)
    if mode == "light":
        a = max((bb - cc) / bb if bb else 0 for cc, bb in zip(c, b))
    else:
        a = max((cc - bb) / (255 - bb) if bb < 255 else 0 for cc, bb in zip(c, b))
    a = clamp(math.ceil(a * 1000) / 1000, 0.001, 1.0)
    f = [clamp(round_half_up((cc - (1 - a) * bb) / a), 0, 255) for cc, bb in zip(c, b)]
    return "#" + "".join(f"{v:02x}" for v in f), a


def p3_variant(step):
    """Display P3 version of a step when sRGB clipped its chroma and P3 can hold more. Kept only when its
    luminance stays within 1.5% of the sRGB value, so every contrast pair still holds [inferred]."""
    L, H, want, C = step["L"], step["H"], step["want"], step["C"]
    if want - C < 0.01:
        return None
    cp3 = min(want, max_chroma(L, H, "p3"))
    if cp3 - C < 0.01:
        return None
    lin = oklch_to_linear_srgb(L, cp3, H)
    y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    if step["y"] <= 0 or abs(y - step["y"]) / step["y"] > 0.015:
        return None
    p3 = linear_srgb_to_linear_p3(lin)
    comps = [rnd(encode(clamp(v, 0, 1)), 4) for v in p3]
    return {"colorSpace": "display-p3", "components": comps, "oklch": [rnd(L, 4), rnd(cp3, 4), rnd(H, 2)]}


# Visible states (U5 F24): hover and pressed differ from their solid by at least these WCAG contrast ratios, and still
# carry the on-color text at the text minimum. Radix steps 9 to 10 are about 1.1:1; 1.15 and 1.3 keep them visible [inferred].
STATE_MIN = {"hover": 1.15, "pressed": 1.3}
NEUTRAL_TINTS = {"pure": (0.0, 0.0), "cool": (0.012, 255.0), "warm": (0.010, 70.0)}  # [inferred] mid-step tints near Warmth 25 / 75
DARK_BASES = {"black": 0.0, "near-black": DARK_STEP1_Y, "charcoal": 0.0194, "dimmed": 0.026}  # #000, #121212-#1a1a1a, #262626, dimmed
HARMONY = {"triadic": (60, -60), "analogous": (30, -30), "complementary": (180, 120)}  # accent2 / accent3 hue offsets [inferred]


def _state_y(y_base, ratio, darker):
    return (y_base + 0.05) / ratio - 0.05 if darker else ratio * (y_base + 0.05) - 0.05


def fit_states(r, on_y, tmin):
    """Re-solve hover (step 10) and pressed (step 13, 'solid-pressed') from the solid (step 9): each at least STATE_MIN apart
    from it, in the ramp's usual direction when that keeps the on-color text at tmin, else the other way. Steps 11 and 12
    (text) are then kept in order past the hover, which only raises their contrast."""
    light = r.mode == "light"
    y9 = r.y(9)
    prefer_darker = light
    chosen = {}
    for step, key in ((10, "hover"), (13, "pressed")):
        k = STATE_MIN[key] * 1.03  # solve 3% above the minimum so 8-bit rounding never lands under it
        pick = None
        for darker in (prefer_darker, not prefer_darker):
            y = _state_y(y9, k, darker)
            if 0.0 <= y <= 1.0 and contrast_y(y, on_y) >= tmin:
                pick = y
                break
        if pick is None:  # neither way keeps both: keep the text readable and move as far as that allows
            cands = [(_state_y(y9, k, d), d) for d in (True, False)]
            cands = [(clamp(y, 0.0, 1.0), d) for y, d in cands]
            pick = max(cands, key=lambda c: (contrast_y(c[0], on_y) >= tmin, contrast_y(c[0], y9)))[0]
        r.solve_y(step, pick)
        chosen[step] = pick
    if r.text_on_solid == "light" and light:
        if r.y(11) >= r.y(10):
            r.solve_y(11, _state_y(r.y(10), 1.1, True))
        if r.y(12) >= r.y(11):
            r.solve_y(12, _state_y(r.y(11), 1.1, True))
    elif not light and r.y(11) <= r.y(10):
        r.solve_y(11, min(1.0, _state_y(r.y(10), 1.1, False)))
        if r.y(12) <= r.y(11):
            r.solve_y(12, min(1.0, r.y(11) + 0.05))
    return chosen


def solve_L(hue, chroma, y_target):
    """OKLCH lightness with the given luminance at this hue, chroma clamped to the sRGB gamut."""
    lo, hi = 0.0, 1.0
    for _ in range(34):
        mid = (lo + hi) / 2
        if y_of_oklch(mid, min(chroma, max_chroma(mid, hue)), hue) < y_target:
            lo = mid
        else:
            hi = mid
    L = (lo + hi) / 2
    C = min(chroma, max_chroma(L, hue))
    return L, C


def chart_colors(n, start_hue, chroma, bg_y, light):
    """n categorical chart colors (Q-color-19): hues spread from the brand hue in an order that keeps neighbours apart,
    each at least 3:1 against the page (WCAG 1.4.11), alternating two lightness levels so they differ without hue too
    (color-vision safety) [inferred ordering; Atlassian and Carbon keep a fixed order, S-L01-030, S-L01-056]."""
    order = [0, 180, 90, 270, 45, 225, 135, 315, 22.5, 202.5, 112.5, 292.5, 67.5, 247.5][:n]
    out = []
    for i, off in enumerate(order):
        h = (start_hue + off) % 360
        ratio = (3.2 if i % 2 == 0 else 4.8) * MARGIN
        L, C = solve_L(h, chroma, target_y(ratio, bg_y, light))
        out.append({"L": L, "C": C, "H": h, "hex": oklch_to_hex(L, C, h)})
    return out


DIVERGING_RATIOS = (9.0, 6.0, 4.0, 3.2, 4.0, 6.0, 9.0)  # contrast with the page, step 1 to 7: both ends strongest, the middle a
# mid neutral that still reaches 3:1, so every step is a visible mark (WCAG 1.4.11) [inferred: Carbon and ColorBrewer use a light
# middle that fails 3:1, S-L05-075, S-L05-088]
DIVERGING_CHROMA = (1.0, 0.8, 0.6, None, 0.6, 0.8, 1.0)  # share of the chart chroma; None: the neutral's own tint


def diverging_colors(low_hue, high_hue, chroma, mid, bg_y, light):
    """Seven chart colors for values below and above a midpoint (Q-color-19, DC-L05-23): steps 1-3 one hue, 4 a neutral at
    the midpoint, 5-7 a second hue. The two hues sit 180 degrees apart, which never pairs red with green (S-L05-086)."""
    out = []
    for i, (ratio, share) in enumerate(zip(DIVERGING_RATIOS, DIVERGING_CHROMA)):
        h, c = (mid if share is None else ((low_hue if i < 3 else high_hue) % 360, chroma * share))
        L, C = solve_L(h, c, target_y(ratio * MARGIN, bg_y, light))
        out.append({"L": L, "C": C, "H": h, "hex": oklch_to_hex(L, C, h)})
    return out


def exact_text_on(hx, text_min):
    """'light' or 'dark': the text that reaches text_min on this exact color in light mode (white, or the dark text neutral
    light 12 is solved to; white wins ties), or None when neither does (U5 F10, DC-L01-09)."""
    if contrast(hx, "#ffffff") >= text_min:
        return "light"
    if contrast_y(luminance(hx), target_y(17.5 if text_min >= 7 else 15.5, 1.0, True)) >= text_min:
        return "dark"
    return None


TYPED_RAMPS = ("accent", "accent2", "accent3", "action")  # ramps that hold a color the person gave: the brand, raw.secondaryColors
# and raw.primaryActionColor
INK_HCT = 22  # HCT chroma at the top of the Colorfulness dial's neutral band (levers: schemeVariant neutral 11-35, accentChroma 22
# at 35): a seed below it is an ink or a gray (near-black, slate-900, gray-900), not a color


def build_palette(state, params):
    raw = state["raw"]
    flags = raw.get("flags", {}) or {}
    aaa = raw.get("contrastTarget") == "AAA"
    text_min = 7.0 if aaa else 4.5
    peak = float(params["color.accentChroma.hct"])
    scheme = params["color.schemeVariant"]
    brand = raw.get("brandColor")
    placeholder = brand is None
    if brand:
        bL, bC, bH = hex_to_oklch(brand)
    else:
        bL, bC, bH = 0.55, 0.15, float(params.get("color.placeholderHue", 255))  # blue reads competent (S-L06-072)
    brand_hct = hct_chroma_of_hex(brand) if brand else 0.0
    exact = flags.get("brandExact") is not False  # on unless the person chose seed (Q-color-01)
    if exact and brand and scheme != "monochrome":
        peak = max(peak, min(brand_hct, 120.0))  # Material Fidelity: the ramp peaks at the brand's own chroma (S-L06-083)
    tint = params["color.neutral.tint.oklch"]
    n_c, n_h = float(tint.get("c") or 0.0), tint.get("h")
    nt = raw.get("neutralTint") or ("brand" if flags.get("tintTowardBrand") else None)
    if nt == "brand":
        n_h = bH
        n_c = max(n_c, 0.012)  # [inferred] minimum visible tint toward the brand hue (DC-L01-06: 0.01-0.03 at mid steps)
    elif nt in NEUTRAL_TINTS:
        n_c, n_h = NEUTRAL_TINTS[nt]
    if raw.get("neutralBase"):
        nL, nC, nH = hex_to_oklch(raw["neutralBase"])
        n_h, n_c = nH, min(max(nC, 0.0), 0.05)
    n_h = float(n_h if n_h is not None else 0.0)
    if n_c < 0.0005:
        n_c = 0.0

    def neutral_chroma(step, L):
        c = n_c * NEUTRAL_CURVE[(10 if step > 12 else step) - 1]
        return min(c, 0.008) if step in (1, 12) else c  # ramp ends keep c <= 0.008 (DC-L01-06)

    def accent_chroma_fn(peak_hct, hue, mode, typed=False):
        # The dial's anchor is HCT chroma (S-L01-010). It is converted to OKLCH once, at the solid step's
        # typical lightness (L 0.55), and the step curve is applied in OKLCH. Applying the curve in HCT
        # would grey out steps 1-3: CAM16 gives even pure white a chroma of about 2.9 [inferred].
        # typed: a color the person gave, kept exact. Material Fidelity keeps the source chroma in dark mode too; the
        # TonalSpot cut to 26/32 is for generated colors (S-L06-083, DC-L01-19).
        curve = ACCENT_CURVE_LIGHT if mode == "light" else ACCENT_CURVE_DARK
        k = 1.0 if mode == "light" or typed else DARK_ACCENT_CHROMA
        c_peak = oklch_chroma_for_hct(peak_hct, 0.55, hue) if peak_hct > 0 else 0.0

        def fn(step, L):
            return c_peak * k * curve[(10 if step > 12 else step) - 1]
        return fn

    dark_text_y = target_y(17.5 if aaa else 15.5, 1.0, True)  # neutral light 12, solved below to this target

    def solid_text_for(seed_hex, seed_L, pinned=False):
        """On-color auto (S-L06-094) with the brandAnchor rule (DC-L01-09): keep the seed's own lightness when some text
        color passes on it; white wins ties; below 3:1 with white the solid always carries dark text."""
        if seed_hex is None:
            return "light"
        cw = contrast(seed_hex, "#ffffff")
        if cw >= text_min * MARGIN:
            return "light"
        if cw < 3.0 or contrast_y(luminance(seed_hex), dark_text_y) >= text_min * MARGIN:
            return "dark"
        return "light"  # neither passes at the seed's lightness: darken the solid until white text passes

    def exact_on(hx):  # the text a typed color keeps exactly with in light mode, or None (then a readable shade carries text)
        return exact_text_on(hx, text_min) if hx and exact else None

    pin_ok = bool(exact_on(brand))

    # status hues stay recognizable at any colorfulness; Material's fixed error palette uses chroma 84 [inferred]
    status_peak = clamp(peak + 16, 48.0, 84.0)
    specs = []  # (name, hue, peak, text_on_solid, seed(L,C,H) or None, seed_hex)
    brand_tos = exact_on(brand) or solid_text_for(brand, bL)
    specs.append(("accent", bH, peak, brand_tos, (bL, bC, bH) if brand else None, brand))
    pac = raw.get("primaryActionColor")
    action_ink = False
    if pac:
        pL, pC, pH = hex_to_oklch(pac)
        own = hct_chroma_of_hex(pac)
        action_ink = own < INK_HCT
        # the button keeps the color typed: its ramp has the seed's own chroma, so hover and pressed stay in its family and an
        # ink stays ink, as Vercel's black primary beside one colored accent (DC-L23-04). Unlike the brand ramp, which also
        # feeds tints and accent text, this ramp draws one button. In seed mode (Q-color-01) a color follows the dial.
        pk = own if (exact or action_ink) else peak
        specs.append(("action", pH, pk, exact_on(pac) or solid_text_for(pac, pL), (pL, pC, pH), pac))
    count = raw.get("accentCount")
    count = int(count) if isinstance(count, (int, float)) else int(params["color.accentCount"])
    off2, off3 = HARMONY.get(raw.get("accentHarmony") or "triadic", HARMONY["triadic"])
    sec = raw.get("secondaryColors") or []
    if count >= 2:
        if len(sec) >= 1:
            s1 = hex_to_oklch(sec[0])
            specs.append(("accent2", s1[2], max(peak, hct_chroma_of_hex(sec[0])) if exact else peak,
                          exact_on(sec[0]) or solid_text_for(sec[0], s1[0]), s1, sec[0]))
        else:  # Material TonalSpot: tertiary hue +60, chroma 24/36 of primary [inferred mapping S-L01-010]
            specs.append(("accent2", (bH + off2) % 360, peak * 24 / 36, "light", None, None))
    if count >= 3:
        if len(sec) >= 2:
            s2 = hex_to_oklch(sec[1])
            specs.append(("accent3", s2[2], max(peak, hct_chroma_of_hex(sec[1])) if exact else peak,
                          exact_on(sec[1]) or solid_text_for(sec[1], s2[0]), s2, sec[1]))
        else:
            specs.append(("accent3", (bH + off3) % 360, peak * 24 / 36, "light", None, None))
    status = dict(STATUS)
    if raw.get("statusSet") in ("discovery", "workflow"):
        status["discovery"] = (300, 0.55, "light")  # Atlassian discovery purple (S-L01-030)
    for sname, (h, sl, tos) in status.items():
        specs.append((sname, float(h), status_peak, tos, (sl, 0.15, float(h)), None))

    dark_base = DARK_BASES.get(raw.get("darkBase") or "", params.get("color.dark.baseY", DARK_STEP1_Y))
    ramps = {}
    for mode in ("light", "dark"):
        cfg = {"text_min": text_min, "c12": 17.5 if aaa else 15.5, "dark_base_y": dark_base}
        if mode == "dark":
            cfg["c12"] = 17.0 if aaa else 15.0
        neutral = build_ramp("neutral", mode, n_h, neutral_chroma, "light", cfg)
        ramps[("neutral", mode)] = neutral
        acfg = dict(cfg, c12=14.0 if aaa else 12.5)
        for name, hue, pk, tos, seed, seed_hex in specs:
            typed = bool(exact and seed_hex and name in TYPED_RAMPS)
            r = build_ramp(name, mode, hue, accent_chroma_fn(pk, hue, mode, typed), tos, acfg, neutral=neutral, seed=seed)
            ramps[(name, mode)] = r
    # exact colors: each color the person gave (brand, secondaries) becomes the solid, step 9, in every mode where the
    # mode's on-color text reads on it: white or dark text in light mode, the dark text dark solids carry in dark mode.
    # Elsewhere step 9 stays a readable shade, and the exact color stays in its seed token (container role, Material Fidelity).
    typed_info = {}
    for name, _h, _p, tos, _s, seed_hex in specs:
        if not (exact and seed_hex and name in TYPED_RAMPS):
            continue
        sL, sC, sH = hex_to_oklch(seed_hex)
        on_dark_y = ramps[("neutral", "dark")].y(1)
        ok = {"light": bool(exact_on(seed_hex)), "dark": contrast_y(luminance(seed_hex), on_dark_y) >= text_min}
        for mode in ("light", "dark"):
            if ok[mode]:
                r = ramps[(name, mode)]
                r.steps[9] = {"L": sL, "C": sC, "H": sH, "hex": seed_hex.lower(), "y": luminance(seed_hex), "want": sC}
                r.pinned = 9
        typed_info[name] = {"hex": seed_hex.lower(), "pinnedLight": ok["light"], "pinnedDark": ok["dark"],
                            "textOn": tos if ok["light"] else None,
                            "contrastWhite": rnd(contrast(seed_hex, "#ffffff"), 2),
                            "contrastDark": rnd(contrast_y(luminance(seed_hex), dark_text_y), 2),
                            "contrastDarkMode": rnd(contrast_y(luminance(seed_hex), on_dark_y), 2)}
    if action_ink and not (typed_info.get("action") or {}).get("pinnedDark"):
        # an ink primary inverts in dark mode: near-white with dark text, as the monochrome scheme's ink does (shadcn)
        ramps[("action", "dark")].solve_y(9, ramps[("neutral", "dark")].y(12))
    pinned = 9 if (typed_info.get("accent") or {}).get("pinnedLight") else None
    tmin_m = text_min * MARGIN
    for (name, mode), r in ramps.items():
        if name == "neutral":
            continue
        n = ramps[("neutral", mode)]
        on_y = (1.0 if r.text_on_solid == "light" else n.y(12)) if mode == "light" else n.y(1)
        fit_states(r, on_y, tmin_m)
    # nearest step to the brand color (documented anchor; bg.brand uses a step that carries its on-color)
    anchor = None
    if brand:
        acc = ramps[("accent", "light")]
        anchor = min(range(1, 13), key=lambda i: (abs(acc.steps[i]["L"] - bL), i))
    if flags.get("p3", True):
        for r in ramps.values():
            for i in list(r.steps):
                v = p3_variant(r.steps[i]) if r.name != "neutral" and not (r.pinned == i) and i <= 12 else None
                if v:
                    r.p3[i] = v
    charts, diverging = {}, {}
    cp = raw.get("chartPalette")
    if cp and cp != "none":
        cc = clamp(oklch_chroma_for_hct(max(peak, 40.0), 0.6, bH), 0.08, 0.2)
        for mode in ("light", "dark"):
            n = ramps[("neutral", mode)]
            bg_y = n.y(1) if mode == "light" else n.y(2)
            if cp in ("categorical-8", "categorical-14"):
                charts[mode] = chart_colors(8 if cp == "categorical-8" else 14, bH, cc, bg_y, mode == "light")
            # below the midpoint: the hue opposite the brand; above it: the brand hue
            diverging[mode] = diverging_colors(bH + 180, bH, cc, (n_h or 0.0, n_c), bg_y, mode == "light")
    adjusted = None
    if brand and not pin_ok:
        acc = ramps[("accent", "light")]
        adjusted = acc.steps[9]["hex"]
    info = {"scheme": scheme, "peakHct": rnd(peak, 2), "brandHct": rnd(brand_hct, 2), "placeholderBrand": placeholder,
            "brandOklch": [rnd(bL, 4), rnd(bC, 4), rnd(bH, 2)], "neutralTint": {"c": rnd(n_c, 4), "h": rnd(n_h, 2)},
            "pinnedStep": pinned, "brandAnchorStep": anchor, "brandExact": exact,
            "brandPinFailed": bool(brand and exact and not pin_ok), "brandAdjustedTo": adjusted,
            "brandContrastWhite": rnd(contrast(brand, "#ffffff"), 2) if brand else None,
            "brandContrastDark": (typed_info.get("accent") or {}).get("contrastDark"),
            "brandPinnedDark": bool((typed_info.get("accent") or {}).get("pinnedDark")),
            "brandContrastDarkMode": (typed_info.get("accent") or {}).get("contrastDarkMode"),
            "brandDark": ramps[("accent", "dark")].steps[9]["hex"] if brand else None,
            "secondary": [dict(typed_info[nm], ramp=nm, light=ramps[(nm, "light")].steps[9]["hex"], dark=ramps[(nm, "dark")].steps[9]["hex"])
                          for nm in ("accent2", "accent3") if nm in typed_info],
            "statusPeakHct": rnd(status_peak, 2), "textMin": text_min, "ramps": [s[0] for s in specs],
            "accentCount": count, "chart": {m: [c["hex"] for c in v] for m, v in charts.items()},
            "chartDiverging": {m: [c["hex"] for c in v] for m, v in diverging.items()}}
    info["_chart"] = charts
    info["_diverging"] = diverging
    return ramps, info


# =============================================================================================
# Token assembly
# =============================================================================================

DENSITIES = ("spacious", "comfortable", "compact")
def space_multipliers(raw=None):
    """LEVERS B8 multiplier list parsed from levers.json; x24 (the 96 step) added per the spec (6.2, section 11).
    Q-space-02 swaps the curve (linear: even steps; geometric: doubling) and Q-space-07 adds a hairline or nudge steps."""
    m = re.search(r"\[([0-9.,\s]+)\]", levers()["formulas"]["space"]["ladder"])
    mult = [float(x) for x in m.group(1).split(",")] if m else [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20]
    if 24 not in mult:
        mult.append(24.0)
    raw = raw or {}
    if raw.get("spaceLadder") == "linear":
        mult = [0, 0.5] + [float(x) for x in range(1, 17)]  # even steps (Tailwind, Fluent to 56, Primer to 48; S-L03-015)
    elif raw.get("spaceLadder") == "geometric":
        mult = [0, 0.5, 1, 2, 4, 8, 16, 24]
    extras = raw.get("spaceExtras") or []
    if "hairline" in extras:
        mult.append(0.25)
    if "nudges" in extras:
        mult += [1.5, 2.5]
    return sorted(set(float(x) for x in mult))
SNAP_RADII = [0, 2, 4, 6, 8, 12, 16, 20, 24, 28, 32]
FULL = 9999
SYSTEM_SANS = ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"]
SYSTEM_MONO = ["ui-monospace", "SF Mono", "Menlo", "Consolas", "Liberation Mono", "monospace"]
SYSTEM_SERIF = ["ui-serif", "Georgia", "Cambria", "Times New Roman", "serif"]
SYSTEM_ROUNDED = ["ui-rounded", "SF Pro Rounded", "system-ui", "sans-serif"]
# Q-type-03 font style -> an open (SIL OFL, Google Fonts) face of that class, used when Q-type-01 is open-custom [inferred picks]
OPEN_FACES = {"neo-grotesque": "Inter", "geometric": "Plus Jakarta Sans", "humanist": "Source Sans 3", "serif": "Source Serif 4",
              "slab": "Roboto Slab", "rounded": "Nunito"}
# Open-licence faces (SIL OFL or Apache 2.0): usable on the web, in apps and self-hosted, so no licence scope is needed
OPEN_FONT_NAMES = list(OPEN_FACES.values()) + [
    "Roboto", "Roboto Mono", "Roboto Flex", "Atkinson Hyperlegible", "JetBrains Mono", "IBM Plex Sans", "IBM Plex Serif", "IBM Plex Mono",
    "Noto Sans", "Noto Serif", "Open Sans", "Lato", "Montserrat", "Poppins", "Work Sans", "DM Sans", "DM Serif Display", "Manrope",
    "Figtree", "Geist", "Geist Mono", "Fira Sans", "Fira Code", "Public Sans", "Lexend", "Outfit", "Space Grotesk", "Sora", "Karla",
    "Rubik", "Merriweather", "Lora", "Playfair Display", "Source Code Pro", "Recursive", "Instrument Sans", "Onest", "Hanken Grotesk"]
OPEN_FONTS = {f.lower() for f in OPEN_FONT_NAMES}


def _generic_face(name):
    return (not name or name in ("system", "=serif", "=rounded") or str(name).lower() in GENERIC_FONTS
            or str(name).lower().startswith(("ui-", "sf ", "sf pro")))


def sf_tracking_on(state):
    """Q-type-13 size-table: Apple's SF Pro table. raw.tracking sf-pro, or a state from before 2026-10-21 whose answer was size-table
    (raw.tracking was size-table then for every state, as the default, so only the answer says the person chose it)."""
    return (state.get("raw") or {}).get("tracking") == "sf-pro" or (state.get("answers") or {}).get("Q-type-13") == "size-table"


def sf_pro_tracking(size):
    """Apple's SF Pro tracking for a size in points, in em: the HIG table (levers formulas.type.tracking.sfPro), straight-line
    between its rows, and its end values beyond 6 and 96 pt."""
    rows = levers()["formulas"]["type"]["tracking"]["sfPro"]["table"]
    if size <= rows[0][0]:
        return rows[0][1] / 1000
    for (s0, t0), (s1, t1) in zip(rows, rows[1:]):
        if size <= s1:
            return round((t0 + (t1 - t0) * (size - s0) / (s1 - s0)) / 1000, 4)
    return rows[-1][1] / 1000


def font_faces(raw):
    """Which face each role uses and where its licence allows it (U5 F21). A brand face whose licence does not cover a
    platform falls back to the system font there: web in the tokens, apps in the Swift and Compose exports."""
    lic = raw.get("fontLicence") or {}
    cls = raw.get("fontClass")

    def resolve(v):
        if v == "=brandFace":
            return raw.get("brandFace") or "system"
        if v == "=openClass":
            return OPEN_FACES.get(cls or "neo-grotesque", "Inter")
        return v
    text = resolve(raw.get("textFace")) or "system"
    disp = raw.get("displayFace")
    disp = "=textFace" if disp in (None, "=textFace") else resolve(disp)
    if disp == "=textFace" and text == "system" and cls in ("serif", "slab", "rounded"):
        disp = "=rounded" if cls == "rounded" else "=serif"  # Q-type-03 with the device font: headings in the system serif or rounded

    def info(name):
        stack = [x for x in name if isinstance(x, str) and x] if isinstance(name, list) else []
        if isinstance(name, list):  # a face with its own fallbacks, e.g. an exact face then its free substitute (Taste Index)
            name = name[0] if name else "system"
        if name == "=textFace":
            return None
        if _generic_face(name) or str(name).lower() in OPEN_FONTS:
            return dict({"face": name, "web": True, "app": True, "selfHost": True, "open": True}, **({"stack": stack} if len(stack) > 1 else {}))
        rec = {"face": name, "web": lic.get("web"), "app": lic.get("app"), "selfHost": lic.get("selfHost"), "open": False}
        cut = [k for k in ("web", "app") if rec[k] is False]
        if cut:
            rec["note"] = f"{name} is not licensed for {' or '.join('apps' if k == 'app' else k for k in cut)}, so the system font is used there"
        if len(stack) > 1:
            rec["stack"] = stack
        return rec
    t = info(text)
    d = info(disp) or dict(t, face="=textFace")
    return {"text": t, "display": d}
TARGETS = {"pointer": 24, "touch": 44, "touch-android": 48, "remote": 66, "gaze": 60, "vehicle": 76}
TARGET_GAPS = {"pointer": 8, "touch": 12, "gaze": 16, "vehicle": 23, "remote": 16}
BREAKPOINTS = {"material": {"sm": 600, "md": 840, "lg": 1200, "xl": 1600},            # Material width classes (S-L03-025)
               "tailwind": {"sm": 640, "md": 768, "lg": 1024, "xl": 1280, "2xl": 1536},  # Tailwind (S-L03-016)
               "bootstrap": {"sm": 576, "md": 768, "lg": 992, "xl": 1200, "2xl": 1400}}  # Bootstrap (S-L03-018)
DEVICE_INPUTS = {"phone": "touch", "tablet-foldable": "touch", "watch": "touch", "wrist": "touch", "desktop-web": "pointer",
                 "tv": "remote", "car": "vehicle", "driving": "vehicle", "spatial": "gaze", "headset": "gaze"}


class Ctx:
    def __init__(self, state):
        self.state = merge_defaults(copy.deepcopy(state))
        self.raw = self.state["raw"]
        self.flags = self.raw.get("flags", {})
        self.dials, self.dial_src, self.conflicts = resolve_dials(self.state)
        self.params, self.pmeta = derive_params(self.state, self.dials)
        self.profile = default_profile(self.state)
        self.look = look_build(self.state)
        if self.look.get("typeRatio") and "type.ratio" not in (self.state.get("overrides") or {}):  # a style's scale; Q-dir-03 wins
            self.params["type.ratio"] = min(self.look["typeRatio"], self.params.get("type.ratioCap") or self.look["typeRatio"])
        self.ramps, self.cinfo = build_palette(self.state, self.params)
        self.charts = self.cinfo.pop("_chart", {})
        self.diverging = self.cinfo.pop("_diverging", {})
        self.modes = ["light", "dark"] if self.flags.get("darkMode", True) else ["light"]
        if self.raw.get("defaultTheme") == "dark" and "dark" not in self.modes:
            self.modes = ["dark"]
        self.notes = []
        self.used = {}  # param -> value actually used by a generator (recorded in meta)

    def P(self, name, computed):
        v = self.params[name] if name in (self.state.get("overrides") or {}) else computed
        self.used[name] = v
        return v

    def elevation_model(self):
        """The person's override, else the style's or preset's build (offset, extruded, clay), else the Depth band."""
        return self.P("elevation.model", self.look.get("elevationModel") or self.params["elevation.model"])

    def gradients(self):
        """None, or 'brand' or 'mesh': the style asks for gradients, or Q-color-25 allows them (DC-L01-25); 'none' always wins."""
        allowed = self.raw.get("gradients")
        if allowed == "none":
            return None
        want = self.look.get("gradient")
        return want or ("brand" if allowed in ("brand-only", "components") else None)

    def ramp(self, name, mode):
        return self.ramps[(name, mode)]


def color_value(step):
    L, C, H = step["L"], step["C"], step["H"]
    v = {"colorSpace": "oklch", "components": [rnd(L, 4), rnd(C, 4), rnd(H if C > 1e-4 else 0, 2)], "hex": step["hex"]}
    return v


def srgb_value(hx, alpha=None):
    v = {"colorSpace": "srgb", "components": [rnd(c / 255, 4) for c in hex_to_rgb8(hx)], "hex": hx.lower()}
    if alpha is not None and alpha < 1:
        v["alpha"] = rnd(alpha, 3)
    return v


def tok(value, desc=None, ext=None, type_=None):
    t = {"$value": value}
    if type_:
        t["$type"] = type_
    if desc:
        t["$description"] = desc
    if ext:
        t["$extensions"] = {NS: ext}
    return t


def build_color_primitives(ctx):
    color = {
        "$type": "color",
        "$description": "Primitive color ramps. Private tier: components use the semantic roles, never these (DC-L01-26).",
        "$extensions": {NS: {
            "method": "OKLCH, contrast-indexed, 12 steps, separate light and dark ramps, sRGB gamut-mapped by lowering chroma",
            "evidence": ["DC-L01-01", "DC-L01-02", "DC-L01-03", "DC-L01-05", "DC-L01-06", "DC-L01-18", "S-L01-002"],
            "stepJobs": {str(k): v for k, v in STEP_JOBS.items()},
            "scheme": ctx.cinfo["scheme"], "accentPeakHct": ctx.cinfo["peakHct"]}},
        "white": tok(srgb_value("#ffffff"), "Pure white: light raised and overlay surfaces, on-color text."),
        "black": tok(srgb_value("#000000"), "Pure black: dark-mode shadow base (DC-L04-12)."),
    }
    if ctx.raw.get("brandColor"):
        color["brand"] = {"seed": tok(srgb_value(ctx.raw["brandColor"]),
                                      "The brand color exactly as given: logos, marketing, large color areas and other uses that "
                                      "carry no text. Fills that carry text use color.bg.brand.")}
    if ctx.raw.get("focusColor"):
        color["focus"] = {"custom": tok(srgb_value(ctx.raw["focusColor"]), "Focus color given as a raw input (L09 M12).")}
    descs = {"neutral": "Neutral ramp; tint from the Warmth dial (DC-L01-06, S-L01-062).",
             "accent": "Accent ramp from the brand color's hue; chroma from the Colorfulness dial (S-L01-010).",
             "action": "Primary-action ramp from its own raw input (Primer pattern, S-L09-331).",
             "accent2": "Second accent (Colorfulness 60+ allows three accents, DC-L01-08).",
             "accent3": "Third accent (Colorfulness 60+ allows three accents, DC-L01-08).",
             "success": "Status: success. Always paired with an icon or label (DC-L01-15).",
             "warning": "Status: warning. The solid carries dark text (on-color-auto, S-L06-094).",
             "danger": "Status: danger. Always paired with an icon or label (DC-L01-15).",
             "info": "Status: info. Always paired with an icon or label (DC-L01-15).",
             "discovery": "Status: discovery, for new things (Atlassian purple, S-L01-030; Q-color-15)."}
    names = ["neutral"] + [n for n in ctx.cinfo["ramps"]]
    for name in names:
        group = {"$description": descs.get(name, name)}
        for mode in ("light", "dark"):
            r = ctx.ramp(name, mode)
            sub = {}
            for i in range(1, 13):
                ext = {}
                if r.pinned == i:
                    ext["pinned"] = ("brand color" if name == "accent" else "your secondary color") + \
                        " kept exactly (flags.brandExact, S-L06-083)"
                if i in r.p3:
                    ext["p3"] = r.p3[i]
                sub[str(i)] = tok(color_value(r.steps[i]), STEP_JOBS[i], ext or None)
            if 13 in r.steps:
                sub["solid-pressed"] = tok(color_value(r.steps[13]), f"Pressed solid: at least {STATE_MIN['pressed']}:1 from step 9, "
                                                                     "still carrying its text (visible states, U5).")
            group[mode] = sub
        given = next((x["hex"] for x in ctx.cinfo.get("secondary") or [] if x["ramp"] == name), None)
        if given:
            group["seed"] = tok(srgb_value(given), "Your secondary color exactly as given (raw.secondaryColors): art, marketing, large "
                                                   f"color areas and other uses that carry no text. Fills that carry text use color.bg.{name}.bold.")
        group["$extensions"] = {NS: {"textOnSolid": {m: ctx.ramp(name, m).text_on_solid for m in ("light", "dark")}}}
        color[name] = group
    alpha = {"$description": "Alpha twins of the neutral ramp over the page background (Radix and Atlassian pattern, DC-L01-07)."}
    for mode in ("light", "dark"):
        r = ctx.ramp("neutral", mode)
        bg = "#ffffff" if mode == "light" else r.steps[1]["hex"]
        sub = {}
        for i in range(2, 13):
            fx, a = neutral_alpha(r.steps[i]["hex"], bg, mode)
            sub[str(i)] = tok(srgb_value(fx, a), f"Composites to neutral {mode} {i} over {'white' if mode == 'light' else 'neutral dark 1'}.")
        alpha[mode] = sub
    color["neutral-alpha"] = alpha
    so = {"hover": 0.16, "focus": 0.16, "pressed": 0.32, "drag": 0.32} if ctx.raw.get("stateOpacity") == "atlassian" else \
        {"hover": 0.08, "focus": 0.10, "pressed": 0.10, "drag": 0.16}  # Atlassian 16/32% (S-L04-070) or Material (S-L04-003)
    opacity = {
        "$type": "number",
        "$description": "State and disabled opacities for colors unknown at design time (Material state layers, DC-L01-17).",
        "state": {k: tok(v) for k, v in so.items()},
        "disabled": {"container": tok(0.12), "content": tok(0.38)},
        "$extensions": {NS: {"evidence": ["DC-L01-17", "S-L01-005", "S-L01-064"]}},
    }
    if ctx.raw.get("chartPalette") not in (None, "none"):
        opacity["chart"] = {"dimmed": tok(0.3, "Other series fade to this while one is hovered or picked in the legend (Carbon, "
                                                "S-L05-091; DC-L05-24).")}
    return {"color": color}, {"opacity": opacity}


def _state_layer(base_hex, on_hex, ratio, start, tmin=4.5 * MARGIN):
    """Smallest see-through layer over a fill that moves it at least `ratio` away and keeps the on-color text readable
    (Q-color-20 overlay). The on-color layer comes first (Material state layers, DC-L01-17); when it would wash out the text,
    the opposite (black under white text, white under dark text) is used."""
    other = "#000000" if luminance(on_hex) > 0.5 else "#ffffff"
    for layer in (on_hex, other):
        a = start
        while a <= 0.6:
            hx = composite(layer, a, base_hex)
            if contrast(hx, base_hex) >= ratio * 1.01 and contrast(hx, on_hex) >= tmin:
                return hx, rnd(a, 2), layer
            a += 0.01
    return composite(other, 0.3, base_hex), 0.3, other


def alias_hex(ctx, alias):
    """The hex an alias to a primitive names: '{color.neutral.light.1}' or '{color.white}'."""
    path = alias.strip("{}")
    if path in ("color.white", "color.black"):
        return "#ffffff" if path == "color.white" else "#000000"
    _c, name, mode, step = path.split(".")
    return ctx.ramp(name, mode).steps[int(step)]["hex"]


OFF_BLACK, OFF_WHITE = "#111111", "#f5f5f5"  # what text and icons use when a ramp step would be pure black or pure white


def build_color_semantic(ctx, mode):
    L = mode == "light"
    p = ctx.params
    raw = ctx.raw
    has = set(ctx.cinfo["ramps"])
    n = lambda s: A(f"color.neutral.{mode}.{s}")
    r = lambda name, s: A(f"color.{name}.{mode}.{s}")
    white = A("color.white")
    model = ctx.elevation_model()
    # surfaces: dark raises surfaces by lightness (DC-L04-13); tonal light steps the page down one step
    if L:
        if model == "tonal" or raw.get("surfaceLayers") == "alternating":
            surf = {"sunken": n(3), "base": n(2), "raised": n(1), "overlay": white}
        else:
            surf = {"sunken": n(2), "base": n(1), "raised": white, "overlay": white}
    elif raw.get("darkBase") == "black":
        surf = {"sunken": n(1), "base": n(1), "raised": n(2), "overlay": n(3)}  # pure black page (OLED), Q-color-21
    else:
        surf = {"sunken": n(1), "base": n(2), "raised": n(3), "overlay": n(4)}
    nav = p["chrome.navTreatment"]
    brand_chrome = p["color.brandRole"] == "brand-chrome-allowed"
    if nav == "colored-if-expression-allows" and brand_chrome:
        surf_nav, nav_desc = r("accent", 9), "Colored navigation (Energy 67+ with brand chrome allowed by Expression 67+)."
    elif nav == "recessive":
        surf_nav, nav_desc = (n(2) if L else n(1)), "Recessive navigation, dimmer than content (Linear 2026, S-L06-067)."
    else:
        surf_nav, nav_desc = surf["base"], "Navigation on the page background."
    lt = lambda name: ctx.ramp(name, mode).text_on_solid
    on = lambda name: (white if lt(name) == "light" else n(12)) if L else n(1)
    on_hex = lambda name: ("#ffffff" if lt(name) == "light" else ctx.ramp("neutral", mode).steps[12]["hex"]) if L \
        else ctx.ramp("neutral", mode).steps[1]["hex"]
    overlay_states = raw.get("stateMethod") == "overlay"

    def states(name, desc):
        """bold, bold-hover, bold-pressed for a solid: shade steps, or see-through state layers (Q-color-20)."""
        base = tok(r(name, 9), desc)
        if overlay_states:
            b = ctx.ramp(name, mode).steps[9]["hex"]
            so = {"hover": 0.16, "pressed": 0.32} if raw.get("stateOpacity") == "atlassian" else {"hover": 0.08, "pressed": 0.10}
            tm = (7.0 if raw.get("contrastTarget") == "AAA" else 4.5) * MARGIN
            hv, ah, lh = _state_layer(b, on_hex(name), STATE_MIN["hover"], so["hover"], tm)
            pr, ap, lp = _state_layer(b, on_hex(name), STATE_MIN["pressed"], max(so["pressed"], ah + 0.02), tm)
            return (base, tok(srgb_value(hv), f"Hover: {lh} at {int(round(ah * 100))}% over the solid (state layer, DC-L01-17).",
                              {"stateLayer": {"over": r(name, 9), "color": lh, "alpha": ah}}),
                    tok(srgb_value(pr), f"Pressed: {lp} at {int(round(ap * 100))}% over the solid (state layer).",
                        {"stateLayer": {"over": r(name, 9), "color": lp, "alpha": ap}}))
        return (base, tok(r(name, 10), f"Hover: one step, at least {STATE_MIN['hover']}:1 from the solid (DC-L01-17)."),
                tok(r(name, "solid-pressed"), f"Pressed: at least {STATE_MIN['pressed']}:1 from the solid."))
    def ink(name, s, desc):
        """Text or icons on a ramp step; an off-shade when that step is pure black in light mode or pure white in dark, as
        with a near-black brand (issue 67): the engine never pairs pure white with pure black itself (STD-visual-details-66).
        The off-shade has the lightness of #111111 (or #f5f5f5) and the ramp's own hue."""
        if ctx.ramp(name, mode).steps[s]["hex"].lower() != ("#000000" if L else "#ffffff"):
            return tok(r(name, s), desc)
        _l, C, H = hex_to_oklch(ctx.ramp(name, mode).steps[9]["hex"])
        Lo = hex_to_oklch(OFF_BLACK if L else OFF_WHITE)[0]
        hx = oklch_to_hex(Lo, min(C, max_chroma(Lo, H)), H)
        return tok(srgb_value(hx), desc + f" Step {s} of the {name} ramp is pure {'black' if L else 'white'}, so this is {hx}, an "
                   "off-shade of the same hue (the engine never pairs pure white with pure black).", {"offShadeOf": r(name, s)})

    fs = raw.get("focusStyle") or "brand"
    focus_step = 9 if (lt("accent") == "light") else 11
    focus = (n(12) if fs in ("neutral", "two-tone") else (r("accent", focus_step) if L else r("accent", 11)))
    acc_b, acc_h, acc_p = states("accent", "Solid accent fill.")
    out = {
        "surface": {
            "sunken": tok(surf["sunken"], "Wells, code blocks, page gutters."),
            "base": tok(surf["base"], "The page background."),
            "raised": tok(surf["raised"], "Cards and panels on the page."),
            "overlay": tok(surf["overlay"], "Menus, popovers, dialogs; always with elevation.floating or elevation.overlay."),
            "nav": tok(surf_nav, nav_desc),
        },
        "text": {
            "primary": tok(n(12), "Body copy, headings, labels (guaranteed >= 7:1 on steps 1-5)."),
            "secondary": tok(n(11), "Supporting text (guaranteed >= the text minimum on surfaces and neutral fills 1-4)."),
            "tertiary": tok(A("color.text.secondary"), "Captions and placeholders: the same grey as secondary, so text keeps three greys "
                                                       "(primary, secondary, disabled; owner, 2026-11-05)."),
            "disabled": tok(n(8), "Disabled labels; exempt from contrast minimums (WCAG 1.4.3 exception)."),
            "inverse": tok(white if L else n(1), "Text on color.bg.inverse (tooltips, toasts)."),
            "link": ink("accent", 11, "Links. Underline them in running text so color is not the only cue."),
            "accent": ink("accent", 11, "Accent text and selected labels."),
            "on-accent": tok(on("accent"), "Text and icons on color.bg.accent.bold* (auto-picked light or dark, S-L06-094)."),
        },
        "bg": {
            "neutral": {
                "subtle": tok(n(3) if L else n(5), "Secondary buttons, chips, hovered rows."),
                "subtle-hover": tok(n(4) if L else n(6), "Hover: +1 step (DC-L01-17)."),
                "subtle-pressed": tok(n(5) if L else n(7), "Pressed or selected: +2 steps (DC-L01-17)."),
            },
            "accent": {
                "subtle": tok(r("accent", 3), "Selected rows, accent badges."),
                "subtle-hover": tok(r("accent", 4), "Hover on accent subtle fills."),
                "subtle-pressed": tok(r("accent", 5), "Pressed accent subtle fills."),
                "bold": acc_b, "bold-hover": acc_h, "bold-pressed": acc_p,
            },
            "disabled": tok(n(3) if L else n(4), "Disabled control fill."),
            "inverse": tok(n(12), "Tooltips and toasts: the inverted surface."),
            "field": tok((n(3) if L else n(4)) if raw.get("fieldStyle") == "filled" else surf["raised"],
                         "Text field fill: " + ("filled fields (Q-form-01, M3 filled)." if raw.get("fieldStyle") == "filled"
                                               else "outlined fields sit on the raised surface (Q-form-01).")),
        },
        "border": {
            "subtle": tok(n(6), "Dividers and card edges (decorative)."),
            "default": tok(n(7), "Outline buttons and table grids (decorative; the label carries meaning)."),
            "strong": tok(n(8), "Boundaries that are the only cue: inputs, checkboxes, switches (3:1, WCAG 1.4.11)."),
            "input": tok(n(8), "Text field and select borders (3:1, DC-L01-16)."),
            "focus": tok(focus, "Focus ring (3:1 against every surface, DC-L04-09)" + ({"neutral": "; neutral ring (Q-color-23).",
                                                                                         "two-tone": "; outer ring of a two-tone ring (Q-state-03)."}.get(fs, "."))),
            "accent": tok(r("accent", 8), "Selected card or accent outline."),
        },
        "icon": {
            "default": tok(n(11), "Icons beside text; same color as secondary text (DC-L05-08)."),
            "subtle": tok(n(10), "Decorative icons."),
            "accent": ink("accent", 11, "Selected and interactive icons."),
            "on-accent": tok(on("accent"), "Icons on solid accent fills."),
        },
    }
    softness = p["border.softness"]
    if softness == "strong-rules":
        out["border"]["subtle"] = tok(n(7), "Dividers (strong rules: Warmth 0-33, S-L06-067 inverse).")
        out["border"]["default"] = tok(n(8), "Outlines (strong rules).")
    elif softness == "soft":
        out["border"]["subtle"] = tok(n(5), "Dividers (soft borders: Warmth 67+, Linear 2026 S-L06-067).")
        out["border"]["default"] = tok(n(6), "Outlines (soft borders).")
    sep = {"strong-rules": 5, "soft": 3}.get(softness, 4) + (0 if L else 1)  # light: two steps under border.subtle; dark: one
    out["border"]["separator"] = tok(n(sep), "Hairlines between table rows and list items, lighter than border.subtle; decorative, "
                                             "so never the only cue (DC-L23-05).")
    # primary action: monochrome schemes use the neutral ink (shadcn pattern); raw primaryActionColor its own ramp
    if ctx.cinfo["scheme"] == "monochrome" and "action" not in has:
        act = (tok(n(12), "Primary action (monochrome scheme: neutral ink, as shadcn/ui)."),
               tok(n(11), "Primary action hover."), tok(n(10), "Primary action pressed.")), (white if L else n(1))
    elif "action" in has:
        act = states("action", "Primary action from its own color input."), on("action")
    else:
        act = states("accent", "Primary action. One per view (DC-L15-03, L15 P08)."), on("accent")
    out["bg"]["action"] = {"primary": act[0][0], "primary-hover": act[0][1], "primary-pressed": act[0][2]}
    out["text"]["on-action"] = tok(act[1], "Text on the primary action fill.")
    brand_step = ctx.cinfo["pinnedStep"] or 9
    out["bg"]["brand"] = tok(r("accent", brand_step) if L else r("accent", 9),
                             "Brand fill for signature surfaces; carries text.on-brand (brandAnchor rule, DC-L01-09).")
    out["text"]["on-brand"] = tok(on("accent"), "Text on color.bg.brand.")
    for extra in ("accent2", "accent3"):
        if extra in has:
            b_, h_, p_ = states(extra, f"{extra} solid fill.")
            out["bg"][extra] = {"subtle": tok(r(extra, 3), f"{extra} subtle fill."), "bold": b_, "bold-hover": h_, "bold-pressed": p_}
            out["text"][extra] = ink(extra, 11, f"{extra} text.")
            out["text"]["on-" + extra] = tok(on(extra), f"Text on {extra} solid.")
    if raw.get("tableRows") == "zebra":  # Q-pattern-07: alternate table rows one neutral step from the page (DC-L19-43)
        base_step = int(surf["base"].strip("{}").split(".")[-1]) if surf["base"].startswith("{color.neutral.") else 1
        out["surface"]["row-alternate"] = tok(n(base_step + 1), "Every other table row (zebra stripes): one step from the page, so it "
                                                               "groups a row without a line. Never the only cue; keep row hover and "
                                                               "selection states (DC-L19-43).")
    surfaces_mode = p["color.surfaces"]
    if surfaces_mode in ("tinted-containers", "brand-or-dynamic-surfaces"):
        out["surface"]["tinted"] = tok(r("accent", 2 if surfaces_mode == "tinted-containers" else 3),
                                       "Tinted container (Colorfulness 50+, L09 X rubric; Q-color-05).")
    for s_ in [x for x in ("success", "warning", "danger", "info", "discovery") if x in has]:
        b_, h_, p_ = states(s_, f"{s_.title()} solid fill.")
        out["bg"][s_] = {"subtle": tok(r(s_, 3), f"{s_.title()} banner and badge background."), "bold": b_, "bold-hover": h_, "bold-pressed": p_}
        out["text"][s_] = tok(r(s_, 11), f"{s_.title()} text and icons; pair with an icon or label (DC-L01-15).")
        out["text"]["on-" + s_] = tok(on(s_), f"Text on bg.{s_}.bold.")
        out["border"][s_] = tok(r(s_, 8), f"{s_.title()} boundary, for example an invalid field (3:1).")
    if raw.get("statusSet") == "workflow":  # Q-color-15 workflow states: fixed meanings on the status hues [inferred]
        wf = {"todo": "neutral", "in-progress": "info", "done": "success", "blocked": "danger", "review": "discovery"}
        out["workflow"] = {}
        for st, hue in wf.items():
            sub_bg = (n(3) if L else n(5)) if hue == "neutral" else r(hue, 3)
            sub_fg = n(11) if hue == "neutral" else r(hue, 11)
            out["workflow"][st] = {"bg": tok(sub_bg, f"Workflow state '{st}' badge fill."), "text": tok(sub_fg, f"Workflow state '{st}' label.")}
    if raw.get("focusColor"):
        out["border"]["focus"] = tok(A("color.focus.custom"), "Focus ring from the raw focus color (L09 M12).")
    if raw.get("focusColor") or fs == "two-tone":
        out["border"]["focus-inner"] = tok(n(12) if raw.get("focusColor") else (white if L else n(1)),
                                           "Inner ring of the two-tone focus indicator; keeps 3:1 on every surface (DC-L08-11).")
    scrim_alpha = {"fluent": (0.4, 0.5), "atlassian": (0.46, 0.6)}.get(raw.get("scrim") or "", (0.45, 0.6))[0 if L else 1]
    shadow_base = ctx.ramp("neutral", "light").steps[12]["hex"] if L else "#000000"
    a = shadow_alpha(ctx)
    k = 1 if L else 2  # dark mode doubles shadow opacity (DC-L04-12)
    ring_hex = ctx.ramp("neutral", "dark").steps[12]["hex"]
    out["overlay"] = {"scrim": tok(srgb_value(ctx.ramp("neutral", "light").steps[12]["hex"] if L and raw.get("scrim") != "fluent" else "#000000", scrim_alpha),
                                   "Modal backdrop (DC-L04-18; Q-depth-06).")}
    out["shadow"] = {
        "key": tok(srgb_value(shadow_base, min(0.6, a * k)), "Key shadow color; alpha doubles in dark (DC-L04-12)."),
        "ambient": tok(srgb_value(shadow_base, min(0.6, a * 0.85 * k)), "Ambient shadow color."),
        "ring": tok(srgb_value(shadow_base if L else ring_hex, 0.1 if L else 0.12),
                    "1px ring for ring-and-shadow depth and dark overlays (#BDBDBD at 12% pattern, DC-L04-12)."),
    }
    if model in ("extruded", "clay"):  # the light half of paired shadows (S-L15-060, DC-L19-67); alphas from styles.md [inferred]
        out["shadow"]["highlight"] = tok(srgb_value("#ffffff", 0.8 if L else 0.08),
                                         "Light shadow, up and left, paired with the key shadow down and right (neumorphism, clay).")
    if model == "offset":  # a solid offset shadow in the strongest text color (S-L15-006, DC-L19-67)
        out["shadow"]["offset"] = tok(out["text"]["primary"]["$value"], "Hard offset shadow at full opacity (neo-brutalism): the text color.")
    if model == "glow":  # the accent solid, see-through, so a glow stays a halo [inferred alphas]
        out["shadow"]["glow"] = tok(srgb_value(ctx.ramp("accent", mode).steps[9]["hex"], 0.35 if L else 0.5),
                                    "Glow color: the accent solid at 35% (light) or 50% (dark), blurred with no offset.")
    if (model == "materials" and raw.get("glass") is not False) or raw.get("glass") is True:
        glass_base = "#ffffff" if L else ctx.ramp("neutral", "dark").steps[3]["hex"]
        # 72% unless text or icons would fail over the worst content behind (black under light glass, white under dark):
        # then the glass gets just opaque enough to keep the floors (S-L15-078; the same check as contrast_pairs)
        behind, steps_ = ("#000000" if L else "#ffffff"), ctx.ramp("neutral", mode).steps
        need = [(steps_[12]["hex"], (7.0 if raw.get("contrastTarget") == "AAA" else 4.5) * MARGIN), (steps_[11]["hex"], 3.0 * MARGIN)]
        glass_a = next((a / 100 for a in range(72, 96) if all(contrast(fg, composite(glass_base, a / 100, behind)) >= m for fg, m in need)), 0.95)
        out["surface"]["glass"] = tok(srgb_value(glass_base, glass_a), "Glass for controls and navigation only, never content (DC-L04-15)"
                                      + ("." if glass_a == 0.72 else f"; {round(glass_a * 100)}% opaque so text and icons pass over any content."))
        out["surface"]["glass-fallback"] = tok(surf["overlay"], "Solid twin under Reduce Transparency and Increase Contrast (DC-L04-16).")
        out["surface"]["glass-dimming"] = tok(srgb_value("#000000", 0.35), "35% dimming under clear glass over bright content (S-L15-073).")
    cp = raw.get("chartPalette")
    if cp and cp != "none":
        page = alias_hex(ctx, surf["base"])

        def mark(name, why):  # the first solid step from 9 that a chart mark can use: 3:1 against the page (WCAG 1.4.11)
            step = next((s_ for s_ in (9, 10, 11) if contrast(ctx.ramp(name, mode).steps[s_]["hex"], page) >= 3.0 * MARGIN), 11)
            return tok(r(name, step), why)
        chart = {"$description": "Chart colors (Q-color-19): marks at least 3:1 against the page (WCAG 1.4.11). Categorical colors in a "
                                 "fixed order, a sequential ramp from the accent, a diverging ramp around a midpoint, status colors, and "
                                 "the chart's axis, gridline and label colors, which point at the border and text roles (DC-L05-23, DC-L05-24).",
                 "brand": mark("accent", "A chart with one series: the brand color (DC-L05-23)."),
                 "sequential": {str(i + 1): tok(r("accent", s_)) for i, s_ in enumerate((3, 5, 7, 9, 11))},
                 "neutral": tok(n(9), "Other, baseline or comparison series.")}
        if cp == "brand-gray":
            chart["categorical"] = {"1": mark("accent", "The brand series: the same step as color.chart.brand."),
                                    "2": tok(n(9), "Everything else.")}
        else:
            chart["categorical"] = {str(i + 1): tok(color_value(c)) for i, c in enumerate(ctx.charts.get(mode, []))}
        div = ctx.diverging.get(mode, [])
        if div:
            chart["diverging"] = {str(i + 1): tok(color_value(c), {0: "Furthest below the midpoint.", 3: "The midpoint, or no change.",
                                                                    6: "Furthest above the midpoint."}.get(i))
                                  for i, c in enumerate(div)}
        chart["status"] = {s_: mark(s_, f"{s_.title()} in a chart: pair it with a label or pattern, never color alone (WCAG 1.4.1).")
                           for s_ in ("success", "warning", "danger", "info", "discovery") if s_ in has}
        chart["axis"] = tok(A("color.border.default"), "Axis lines and tick marks.")
        chart["gridline"] = tok(A("color.border.subtle"), "Gridlines: supportive, so they stay quiet (DC-L05-24).")
        chart["label"] = tok(A("color.text.secondary"), "Tick labels, axis titles and legends: text, so they keep the text minimum.")
        chart["reference"] = tok(A("color.chart.neutral"), "Target, threshold and average lines.")
        out["chart"] = chart
    tree = {"color": dict({"$type": "color",
                           "$description": f"Semantic color roles, {mode} mapping. Names never change across modes; only values do. "
                                           "Dark is a separate mapping, never an inversion (DC-L01-18).",
                           "$extensions": {NS: {"mode": mode, "evidence": ["DC-L01-11", "DC-L01-12", "DC-L01-17", "DC-L01-18", "DC-L01-19", "DC-L04-12", "DC-L04-13"]}}},
                          **out)}
    grad = ctx.gradients()
    if grad:
        tree["gradient"] = build_gradients(ctx, grad, out, r, has)
    return tree


def build_gradients(ctx, kind, out, r, has):
    """DTCG gradient tokens (DC-L01-25): stops alias colors; kind, angle and interpolation live in $extensions. The brand
    gradient is one hue, between the two solids on-accent text is checked against, so its text passes at every stop (S-L19-045).
    The mesh is radial layers that fade to transparent, for marketing and brand surfaces only (DC-L19-12, S-L19-058)."""
    surfaces = ["marketing", "hero", "illustration"]
    if ctx.raw.get("gradients") == "components":
        surfaces += ["one call-to-action card", "hover strokes"]  # Q-color-25 components (DC-L19-12)
    never = "buttons, fields, status or data colors (a gradient that means data uses a sequential palette, DC-L01-25)"
    acc = out["bg"]["accent"]
    g = {"$type": "gradient",
         "$description": "Gradients for brand moments, never on controls. Blend in OKLab; text on a gradient meets 4.5:1 at its "
                         "lowest-contrast point (DC-L01-25).",
         "brand": tok([{"color": acc["bold"]["$value"], "position": 0}, {"color": acc["bold-pressed"]["$value"], "position": 1}],
                      "One-hue brand gradient between color.bg.accent.bold and bold-pressed; color.text.on-accent passes on both stops.",
                      {"kind": "linear", "angle": 180, "interpolation": "oklab", "allowedSurfaces": surfaces, "neverOn": never,
                       "evidence": ["DC-L01-25", "DC-L19-12", "S-L19-045"]})}
    if kind == "mesh":
        picks = [("accent", 9), ("accent2", 9) if "accent2" in has else ("accent", 6), ("accent3", 9) if "accent3" in has else ("accent", 11)]
        places = [(15, 20), (85, 25), (50, 95)]  # [inferred]
        clear = srgb_value("#000000", 0)
        mesh = {"$description": "Mesh gradient: radial layers stacked over color.surface.base, one per brand color (one hue in several "
                                "shades without second colors). Marketing and brand surfaces only; static, so reduced motion has nothing to stop.",
                "$extensions": {NS: {"layers": [f"gradient.mesh.{i}" for i in range(1, len(picks) + 1)], "base": "color.surface.base",
                                     "allowedSurfaces": ["marketing", "hero"], "neverOn": never, "motion": "static",
                                     "evidence": ["DC-L01-25", "DC-L19-12", "S-L19-058"], "inferred": ["positions", "layer colors"]}}}
        for i, ((name, step), (x, y)) in enumerate(zip(picks, places), start=1):
            mesh[str(i)] = tok([{"color": r(name, step), "position": 0}, {"color": clear, "position": 0.6}], None,
                               {"kind": "radial", "shape": "circle", "at": [x, y], "interpolation": "oklab"})
        g["mesh"] = mesh
    return g


def shadow_alpha(ctx):
    depth = ctx.dials["depth"]
    if depth < 16:
        return 0.0
    return rnd(eval_map({"kind": "anchors", "points": [[16, 0.08], [100, 0.24]]}, depth), 3)


# ---------------------------------------------------------------------------------------------- type

def line_height_ratio(size):
    """LEVERS B7 bands: [12,16]->1.5, [18,24]->1.4, [28,40]->1.25, [48,+]->1.12; gaps go to the nearer band."""
    if size <= 17:
        return 1.5
    if size <= 26:
        return 1.4
    if size <= 44:
        return 1.25
    return 1.12


def snap4_down_on_tie(x):
    return int(math.ceil(x / 4 - 0.5) * 4)


def type_scale_sizes(base, ratio, n_lo, n_hi):
    """The LEVERS B6 formula without any post-processing: round(base * ratio^n) for n in [n_lo, n_hi]."""
    return [round_half_up(base * ratio ** k) for k in range(n_lo, n_hi + 1)]


def build_type_scale(ctx):
    p, raw = ctx.params, ctx.raw
    base = raw.get("baseSize")
    plats = raw.get("platforms") or ["web"]
    pb = levers()["formulas"]["type"]["platformBase"]
    if not base and p.get("platform.useNativeBaseSize") and plats[0] in pb:
        # Brand presence below 50 keeps the platform's own body size when a native platform leads (LEVERS B6, DC-L02-08)
        nb = pb[plats[0]]
        base = (nb[1] if raw.get("productType") == "content" else nb[0]) if isinstance(nb, list) else nb
        ctx.used["type.baseSize.native"] = base
    base = int(base or ctx.P("type.baseSize.web", p["type.baseSize.web"]))
    ratio = float(ctx.P("type.ratio", p["type.ratio"]))
    # LEVERS B6 display reach [inferred bands]. Marketing surfaces get a separate fluid display scale (display_scale), so the
    # UI scale keeps the product reach: one 1.2 scale stretched to 83px gave a landing page no hero (2026-11-05)
    reach = float(p.get("type.displayReach") or 2.5)
    top_n = max(3, round_half_up(math.log(reach) / math.log(ratio)))
    sizes = type_scale_sizes(base, ratio, -2, top_n)
    # smallest size for text people read: 12px on the web (11 only for short labels; owner decision 2026-10-14, stage 11
    # "avoid below 12px on web", DC-L02-20), 11 pt/sp on iOS and Android (L14, S-L02-001)
    min_size = 12 if "web" in plats else 11
    kept = sorted(set(s for s in sizes if s >= min_size) | {base})
    merged = []
    below = [s for s in kept if s < base]
    above = [s for s in kept if s > base]
    # merge adjacent sizes less than 10% apart (DC-L02-10): below base keep the larger, above base keep the larger
    b2 = []
    for s in sorted(below, reverse=True):
        prev = b2[-1] if b2 else base
        if prev / s - 1 < float(p.get("type.maxStepGapMerge", levers()["formulas"]["type"]["maxStepGapMerge"])):
            merged.append(s)
            continue
        b2.append(s)
    a2 = []
    for s in above:
        prev = a2[-1] if a2 else base
        if s / prev - 1 < 0.1:
            merged.append(prev if a2 else s)
            if a2:
                a2[-1] = s
            continue
        a2.append(s)
    final = sorted(b2) + [base] + a2
    if final.index(base) == 0:  # keep one step below body for captions when the formula gave none
        cap = max(min_size, round_half_up(base / ratio))
        if cap < base:
            final = [cap] + final
    return {"base": base, "ratio": ratio, "reach": reach, "nTop": top_n, "raw": sizes, "sizes": final,
            "merged": sorted(set(merged)), "minSize": min_size}


def display_scale(ctx, top):
    """Marketing surfaces: {style: {key, min, max}} for the hero (display.lg) and section titles (display.md), fluid between
    a phone and the container width (levers formulas.type.display). top is the largest UI size; whole px only."""
    f = levers()["formulas"]["type"]["display"]
    hero = int(ctx.P("type.displayMax", ctx.params.get("type.displayMax") or 96))
    sec = f["section"]
    sec_max = max(int(sec["max"]), int(math.ceil(top * 1.1)))  # a section title stays a visible step above the UI headings
    hero = max(hero, int(math.ceil(sec_max * 1.25)))
    snap = int(f["hero"]["snap"])
    hero_min = max(sec["min"], int(round(hero * f["hero"]["minOfMax"] / snap) * snap))
    return {"display.md": {"key": "display-md", "min": int(sec["min"]), "max": sec_max},
            "display.lg": {"key": "display-lg", "min": min(hero_min, hero), "max": hero}}


def fluid_css(lo, hi, vw=None):
    """clamp() from lo px at the phone width to hi px at the container width, in rem so text zoom still works."""
    a, z = vw or levers()["formulas"]["type"]["display"]["viewport"]
    slope = (hi - lo) / (z - a)
    rem = lambda px: f"{fmt_num(rnd(px / 16, 4))}rem"
    return f"clamp({rem(lo)}, {rem(lo - slope * a)} + {fmt_num(rnd(slope * 100, 4))}vw, {rem(hi)})"


def build_typography(ctx):
    p, raw = ctx.params, ctx.raw
    sc = build_type_scale(ctx)
    S, base = sc["sizes"], sc["base"]
    b = S.index(base)
    wc = int(ctx.P("type.weightCount", p["type.weightCount"]))
    hw = int(ctx.P("type.headingWeight", p["type.headingWeight"]))
    if wc <= 2 and "type.headingWeight" not in (ctx.state.get("overrides") or {}):  # weights the person stated stay as stated
        hw = 600 if hw < 700 else 700
    w = {"body": 400, "label": 500 if wc >= 3 else 400, "heading": hw}
    if wc >= 4:
        w["display"] = min(900, hw + 100)
    compact_lh = bool(p.get("type.compactLineHeightVariant"))

    faces = font_faces(raw)

    def face(v, fallback):
        if v == "=serif":
            return list(SYSTEM_SERIF)
        if v == "=rounded":
            return list(SYSTEM_ROUNDED)
        if not v or v == "system":
            return list(fallback)
        if isinstance(v, list):
            return v + [x for x in fallback if x not in v]
        return [v] + list(fallback)
    tf = faces["text"]
    text_face = face((tf.get("stack") or tf["face"]) if tf["web"] is not False else "system", SYSTEM_SANS)
    df = faces["display"]
    disp = (df.get("stack") or df["face"]) if df["web"] is not False else None
    note = " " + "; ".join(f["note"] for f in (tf, df) if f.get("note")) if (tf.get("note") or df.get("note")) else ""
    fam = {"text": tok(text_face, "Text face for UI and body (DC-L02-01)." + note),
           "display": tok(A("font.family.text") if disp in (None, "=textFace", tf["face"]) or (tf.get("stack") and disp == tf["stack"]) else face(disp, text_face),
                          "Display face for headings (Apple, Google and Linear split display and text faces, DC-L06-07)."),
           "mono": tok(face(raw.get("monoFace"), SYSTEM_MONO), "Code, tokens, tabular values.")}
    weights = {"$type": "fontWeight", "$description": f"{wc} weights: body 400, labels {w['label']}, headings {hw} (DC-L02-15; Energy sets heading weight, S-L06-031).",
               "body": tok(400), "label": tok(w["label"]), "heading": tok(hw)}
    if "display" in w:
        weights["display"] = tok(w["display"], "Display sizes (32px and up) only.")
    size_tok = {"$type": "dimension",
                "$description": f"Type scale: round({base} x {sc['ratio']}^n), n from -2 to {sc['nTop']}; sizes under {sc['minSize']}px dropped; "
                                "adjacent sizes under 10% apart merged; only the steps a named text style uses are kept (DC-L02-09, DC-L02-10).",
                "$extensions": {NS: {"base": base, "ratio": sc["ratio"], "displayReach": sc["reach"], "formulaSizes": sc["raw"],
                                     "merged": sc["merged"], "evidence": ["DC-L02-09", "DC-L02-10", "S-L02-021", "S-L09-407"]}}}
    grid = 2 if raw.get("lineHeightGrid") == 2 else 4
    snap = (lambda x: int(math.ceil(x / 2 - 0.5) * 2)) if grid == 2 else snap4_down_on_tie
    lh_tok = {"$type": "dimension", "$description": f"Line heights snapped to a {grid}px grid: 1.5 up to 17px, 1.4 to 26px, 1.25 to 44px, 1.12 above (DC-L02-13)."}
    for s in S:
        lh = max(s + 2, snap(s * line_height_ratio(s)))
        lh_tok[str(lh)] = tok(dim(lh))
    text = {"$type": "typography",
            "$description": "Semantic text styles (role x size). lineHeight is a unitless multiplier as DTCG requires; px is in $extensions.",
            "$extensions": {NS: {"evidence": ["DC-L02-07", "DC-L02-13", "DC-L02-14", "DC-L02-15", "DC-L15-02"]}}}

    def sz(k):
        return S[clamp(b + k, 0, len(S) - 1)]

    zero_tracking = raw.get("tracking") == "zero"
    size_table = sf_tracking_on(ctx.state)
    jobs = levers()["formulas"]["type"]["tracking"]["jobs"]  # one value per job; capitals never negative

    def caps_em(size):
        return jobs["capsLabel"] if size <= jobs["capsLabelUntil"] else jobs["capsDisplay"]
    sf_until = levers()["formulas"]["type"]["tracking"]["sfPro"]["textUntil"]
    same = disp in (None, "=textFace")  # the display styles use the text face
    is_sf = {"text": _generic_face(tf["face"]), "display": _generic_face(tf["face"] if same else disp)}  # the Apple system font on Apple devices

    def tracking(size, caps=False, family="text"):
        if zero_tracking:  # Q-type-13 zero: the font's own spacing everywhere
            return 0.0
        if size_table and family in is_sf and (is_sf[family] or size <= sf_until):  # code faces keep the bands
            # Q-type-13 size-table: Apple's SF Pro table (S-L02-001). It is SF Pro's own tuning, so the system font takes all of it;
            # another face takes it only through SF Pro's Text sizes, because from 20 pt Apple loosens SF Pro Display, which is
            # drawn tighter, and a face without that drawing would loosen its headings (STD-visual-details-05)
            em = sf_pro_tracking(size)
            return max(em, caps_em(size)) if caps else em  # uppercase stays looser than sentence case (STD-visual-details-04)
        if caps:
            return caps_em(size)
        if size <= 12:
            return jobs["small"]
        if size >= 48:
            return jobs["display"]
        if size >= 32:
            return jobs["heading"]
        return float(jobs["body"])

    styles = []  # (path, size, weightRole, family, use, avoid, caps)
    styles += [("body.sm", sz(-1), "body", "text", "Helper text, timestamps, captions.", "Anything read at length.", False),
               ("body.md", base, "body", "text", "Default UI text: forms, tables, descriptions.", "Long articles when body.lg exists.", False),
               ("body.lg", sz(1), "body", "text", "Long-form reading, onboarding copy.", "Dense tables and forms.", False),
               ("label.sm", sz(-1), "label", "text", "Overlines in capitals with wide tracking (DC-L02-18).", "Sentences; scripts without case.", True),
               ("label.md", sz(-1), "label", "text", "Small control labels, badges, dense tabs.", "Body text.", False),
               ("label.lg", base, "label", "text", "Button and control labels.", "Headings.", False),
               ("code.sm", sz(-1), "body", "mono", "Inline values, dense code rows.", "Paragraphs.", False),
               ("code.md", base, "body", "mono", "Code blocks, token names.", "UI labels.", False),
               ("title.sm", base, "heading", "text", "Table headers, field-group titles.", "Paragraph emphasis.", False)]
    heading_names = ["title.md", "title.lg", "headline.sm", "headline.md", "headline.lg", "display.sm", "display.md", "display.lg"]
    H = S[b + 1:]
    fluid = display_scale(ctx, S[-1]) if raw.get("marketingSurfaces") else {}
    if fluid:  # the display styles come from their own fluid scale; the UI scale names four titles and headlines (15 styles in all)
        heading_names = heading_names[:4]
        if len(H) > 4:
            H = [H[i] for i in sorted({round(i * (len(H) - 1) / 3) for i in range(4)})]
    elif len(H) > 6:  # 9 base styles + 6 headings = 15, the top of the usual range (DC-L02-10; U5 F8, F28): spread over the scale
        H = [H[i] for i in sorted({round(i * (len(H) - 1) / 5) for i in range(6)})]
        heading_names = ["title.md", "title.lg", "headline.sm", "headline.lg", "display.md", "display.lg"]
    uses = {"title": ("Card, panel and group titles.", "Page titles."), "headline": ("Page and section titles.", "Card titles."),
            "display": ("One hero line per page: marketing, empty states.", "App chrome and repeated elements.")}
    for name, s in zip(heading_names, H):
        role = "display" if name.startswith("display") and "display" in w else "heading"
        fam_name = "display" if not name.startswith("title") else "text"
        u, av = uses[name.split(".")[0]]
        styles.append((name, s, role, fam_name, u, av, False))
    fluid_uses = {"display.md": ("Section titles on marketing pages; one per section.", "Cards and app screens."),
                  "display.lg": ("The hero line: one per page, at most two lines.", "Section titles and repeated elements.")}
    for name, f in fluid.items():
        styles.append((name, f["max"], "display" if "display" in w else "heading", "display", *fluid_uses[name], False))
    if fluid and base < 15:  # the call to action on a marketing page: at least 15px, sentence case (owner, 2026-11-05); else label.lg
        styles.append(("label.cta", next((x for x in S if x >= max(15, base)), base), "label", "text",
                       "Call-to-action buttons: sentence case, one filled per view.", "Capitals; body text.", False))

    if raw.get("numericStyles", True):  # tabular figures for amounts and tables; on unless set off (STD-visual-details-02 must)
        styles += [("numeric.md", base, "body", "text", "Amounts and table figures: tabular digits line up in columns; right-align "
                                                        "numeric columns.", "Running text.", False),
                   ("numeric.lg", sz(2), "heading", "text", "Key numbers: balances, KPIs.", "Headings.", False)]
    used_lh = {}

    def add_style(root, path, s, role, fam_name, use, avoid, caps):
        lh = max(s + 2, snap(s * line_height_ratio(s)))
        used_lh[lh] = True
        em = tracking(s, caps, fam_name)
        ext = {"lineHeightPx": lh, "letterSpacingEm": em, "use": use, "avoid": avoid}
        if path in fluid:
            ext["fluid"] = {"minPx": fluid[path]["min"], "maxPx": fluid[path]["max"]}
        if path == "label.cta":
            ext["case"] = "sentence"
        if caps:
            ext["textTransform"] = "uppercase"
        if path.startswith("numeric."):
            ext["fontVariantNumeric"] = "tabular-nums"
        if compact_lh and (path.startswith("label") or path in ("body.sm", "body.md")):
            ext["lineHeightTightPx"] = s + 4 if s <= 16 else snap4_down_on_tie(s * 1.2)
        node = root
        parts = path.split(".")
        for q in parts[:-1]:
            node = node.setdefault(q, {})
        node[parts[-1]] = tok({"fontFamily": A(f"font.family.{fam_name}"), "fontSize": A(f"font.size.{fluid[path]['key'] if path in fluid else s}"),
                               "fontWeight": A(f"font.weight.{role}"), "letterSpacing": dim(rnd(s * em, 2)),
                               "lineHeight": rnd(lh / s, 4)}, None, ext)
    for st in styles:
        add_style(text, *st)
    used_sizes = sorted({st[1] for st in styles if st[0] not in fluid} | {base})  # the font.size steps a named style uses (DC-L02-10: 8-10 sizes)
    for s in used_sizes:
        size_tok[str(s)] = tok(dim(s))
    for name, f in fluid.items():  # $value is the desktop size; CSS gets the clamp() (a DTCG dimension cannot hold one)
        size_tok[f["key"]] = tok(dim(f["max"]), f"{name}: fluid from {f['min']}px on a phone to {f['max']}px at the container width.",
                                 {"fluid": {"minPx": f["min"], "maxPx": f["max"], "viewport": levers()["formulas"]["type"]["display"]["viewport"]},
                                  "css": fluid_css(f["min"], f["max"])})
    tracking_tok = {"$type": "number", "$description": "Letter spacing in em, one value per job (levers formulas.type.tracking.jobs). Capitals "
                                                       "never take negative tracking. The font shorthand drops letter-spacing: set it too, or use the text classes.",
                    **{k: tok(v) for k, v in (("small", jobs["small"]), ("body", jobs["body"]), ("heading", jobs["heading"]),
                                              ("display", jobs["display"]), ("caps-label", jobs["capsLabel"]), ("caps-display", jobs["capsDisplay"]))}}
    if zero_tracking:
        tracking_tok.update({k: tok(0) for k in ("small", "body", "heading", "display", "caps-label", "caps-display")})
    sc = dict(sc, sizes=used_sizes, scaleSizes=S, fluid={k: {"min": f["min"], "max": f["max"]} for k, f in fluid.items()})
    # Emphasized variants: Expression 67 and up (levers.json type.emphasizedVariants). Material 3 Expressive pairs each
    # baseline style with a heavier one for selection, actions, headlines and editorial moments (DC-L02-11, S-L02-006).
    # Each uses the next heavier weight the system already has, so the weight count stays as DC-L02-15 set it.
    emphasized = []
    if ctx.P("type.emphasizedVariants", p.get("type.emphasizedVariants")):
        order = sorted(w, key=lambda r: (w[r], r))

        def heavier(role):
            return next((r for r in order if w[r] > w[role]), None)
        emph = {"$description": "Emphasized variants: the same size and line height, one weight heavier. Use them for the selected "
                                "item, key actions, headlines and editorial moments, not for whole paragraphs (DC-L02-11, S-L02-006)."}
        for path, s, role, fam_name, use, avoid, caps in styles:
            hr = heavier(role)
            if path.startswith(("code.", "numeric.")) or caps or not hr:
                continue
            add_style(emph, path, s, hr, fam_name, f"Emphasized {path}: selection, actions, headlines.", "Whole paragraphs.", False)
            emphasized.append("emphasized." + path)
        if emphasized:
            text["emphasized"] = emph
    scripts = levers()["formulas"]["type"]["scripts"]
    script_notes = {}
    for sc_code in raw.get("scripts") or ["Latn"]:
        f = 1.0
        for band, codes in (("medium", scripts["medium"]), ("large", scripts["large"]), ("extraLarge", scripts["extraLarge"])):
            if sc_code in codes:
                f = scripts["lineHeightFactor"][band]
        if sc_code in ("Hans", "Hant", "Jpan", "Kore"):
            script_notes[sc_code] = {"lineHeightFactor": f, "cjk": scripts["cjk"]}
        elif f != 1.0 or sc_code in levers()["formulas"]["type"]["tracking"]["zeroScripts"]:
            script_notes[sc_code] = {"lineHeightFactor": f,
                                     "zeroTracking": sc_code in levers()["formulas"]["type"]["tracking"]["zeroScripts"]}
    text["$extensions"][NS]["scripts"] = script_notes
    ctx.type_info = dict(sc, weights=w, styles=[s[0] for s in styles], emphasized=emphasized, lineHeights=sorted(used_lh), scripts=script_notes,
                         faces=faces, tracking={k: v["$value"] for k, v in tracking_tok.items() if not k.startswith("$")})
    font = {"family": dict({"$type": "fontFamily"}, **fam), "weight": weights, "size": size_tok,
            "line-height": {k: v for k, v in lh_tok.items() if k.startswith("$") or int(k) in used_lh}, "tracking": tracking_tok}
    return {"font": font, "text": text}


# ---------------------------------------------------------------------------------------------- space

def space_ladder(unit, raw=None):
    vals = []
    for m in space_multipliers(raw):
        v = unit * m
        if abs(v - round(v)) < 1e-9:
            vals.append(int(round(v)))
    return sorted(set(vals))


def targets_for(ctx):
    plats = set(ctx.raw.get("platforms") or ["web"])
    inputs = set(ctx.raw.get("inputs") or ["pointer", "touch"])
    inputs |= {DEVICE_INPUTS[x] for x in (ctx.raw.get("devices") or []) + (ctx.raw.get("situations") or []) if x in DEVICE_INPUTS}
    out = {}
    if "pointer" in inputs or plats & {"web", "desktop", "macos", "windows"}:
        out["pointer"] = TARGETS["pointer"]
    if "touch" in inputs or plats & {"ios", "android", "ipados"}:
        out["touch"] = TARGETS["touch-android"] if "android" in plats else TARGETS["touch"]
    if "remote" in inputs or "tv" in plats:
        out["remote"] = TARGETS["remote"]
    if "gaze" in inputs or plats & {"visionos", "xr"}:
        out["gaze"] = TARGETS["gaze"]
    if "vehicle" in inputs or "car" in plats:
        out["vehicle"] = TARGETS["vehicle"]
    if ctx.raw.get("minTarget"):
        out = {k: max(v, int(ctx.raw["minTarget"])) for k, v in out.items()}
    return out


def build_space_foundation(ctx):
    unit = int(ctx.raw.get("spaceUnit") or 4)
    ladder = space_ladder(unit, ctx.raw)
    space = {"$type": "dimension",
             "$description": f"Spacing ladder: {unit} x [{', '.join(fmt_num(m) for m in space_multipliers(ctx.raw))}], non-integers dropped "
                             "(LEVERS B8; x24 added by spec 6.2). Names are pixel values.",
             "$extensions": {NS: {"unit": unit, "evidence": ["DC-L03-01", "DC-L03-02", "S-L09-508"]}}}
    for v in ladder:
        space[str(v)] = tok(dim(v))
    tg = targets_for(ctx)
    icon_default = int(ctx.P("icon.defaultSize", ctx.params["icon.defaultSize"]))
    pairs = {16: 14, 20: 16, 24: 20}  # icon size -> paired text size (DC-L05-05)
    label_w = 500 if int(ctx.params["type.weightCount"]) >= 3 else 400

    fixed = ctx.raw.get("iconStroke")

    def stroke(sz):  # LEVERS B12 [inferred formula]: round_to_0.5((size/12) * (weight/400)), min 1; Q-icon-03 fixes it at 24px
        if isinstance(fixed, (int, float)):
            return max(1.0, round(fixed * sz / 24 * 2) / 2)
        return max(1.0, round((sz / 12) * (label_w / 400) * 2) / 2)
    size = {"$type": "dimension",
            "icon": {"$description": "Icon sizes paired with text sizes 14/16/20 (DC-L05-05).",
                     "sm": tok(dim(16)), "md": tok(dim(20)), "lg": tok(dim(24)),
                     "default": tok(A(f"size.icon.{ {16: 'sm', 20: 'md', 24: 'lg'}.get(icon_default, 'md') }"),
                                    "Default icon size from the Density dial (DC-L05-05).")},
            "target": {"$description": "Minimum hit areas per input. Density never changes these (L14 I-1, DC-L03-12, DC-L14-03).",
                       **{k: tok(dim(v)) for k, v in tg.items()},
                       "min": tok(dim(tg.get("touch", tg.get("pointer", 24)) if "touch" in tg else tg.get("pointer", 24)),
                                  "Hit-area floor for the product's primary input; grow hit areas (not visuals) to reach it.")}}
    gaps = {k: TARGET_GAPS.get(k, 8) for k in tg}
    space["target"] = {"gap": tok(dim(max(gaps.values()) if "touch" in tg else gaps.get("pointer", 8)),
                                  "Gap between adjacent targets: 12 coarse, 8 fine (Primer, S-L03-009).")}
    icon = {"stroke": {"$type": "dimension",
                       "$description": "Icon stroke = round_to_0.5((size/12) x (label weight/400)), min 1 (LEVERS B12, [inferred] fit to Material 2px@24 and Octicons 1.5px@16).",
                       "sm": tok(dim(stroke(16))), "md": tok(dim(stroke(20))), "lg": tok(dim(stroke(24)))}}
    bp = BREAKPOINTS.get(ctx.raw.get("breakpoints") or "")
    if bp:
        size["breakpoint"] = {"$description": f"Layout breakpoints ({ctx.raw['breakpoints']}, Q-layout-01): the minimum width where each layout starts.",
                              **{k: tok(dim(v)) for k, v in bp.items()}}
    lay = levers()["formulas"]["layout"]
    base_px = int(ctx.raw.get("baseSize") or 16)
    measure = {k: tok(dim(int(round(lay["measure"][k] * 0.55 * base_px))),  # px is about the ch width of a sans at body size
                      f"{lay['measure'][k]} characters per line ({'paragraphs' if k == 'prose' else 'the lead under a heading'}); CSS uses ch.",
                      {"css": f"{lay['measure'][k]}ch"}) for k in ("prose", "lead")}
    layout = {"$description": "One container for every section of the site; columns, gutters and margins by width class; a reading "
                              "measure. A centred hero is fine; within a section the heading and its content share one alignment.",
              "$extensions": {NS: {"evidence": lay["evidence"]}},
              "container": {"$type": "dimension", "max": tok(dim(lay["container"]), "The one content width (Primer full pages, S-L03-008).")},
              "columns": {"$type": "number", **{k: tok(v) for k, v in lay["columns"].items()}},
              "gutter": {"$type": "dimension", **{k: tok(dim(v)) for k, v in lay["gutter"].items()}},
              "margin": {"$type": "dimension", **{k: tok(dim(v)) for k, v in lay["margin"].items()}},
              "measure": {"$type": "dimension", **measure}}
    ctx.space_info = {"unit": unit, "ladder": ladder, "targets": tg, "iconDefault": icon_default,
                      "iconStroke": {16: stroke(16), 20: stroke(20), 24: stroke(24)}, "breakpoints": bp or {},
                      "layout": {"container": lay["container"], "columns": lay["columns"], "gutter": lay["gutter"], "margin": lay["margin"],
                                 "measure": lay["measure"], "alignment": lay["alignment"]}}
    return {"space": space, "size": size, "icon": icon, "layout": layout}


def build_space_density(ctx, density):
    ladder = ctx.space_info["ladder"]
    unit = ctx.space_info["unit"]
    shift = {"spacious": 1, "comfortable": 0, "compact": -1}[density]
    ratio = {"spacious": 3.5, "comfortable": 2.5, "compact": 2.0}[density]  # innerOuterRatio bands (DC-L03-24 [inferred])
    ratio = {"1:3-1:4": {"spacious": 4.0, "comfortable": 3.0, "compact": 3.0},   # Q-space-05 [inferred]
             "dense": {"spacious": 3.0, "comfortable": 2.0, "compact": 2.0}}.get(ctx.raw.get("groupRatio") or "", {}).get(density, ratio)
    nz = [v for v in ladder if v > 0]

    def at(mult):
        want = mult * unit
        i = min(range(len(nz)), key=lambda j: (abs(nz[j] - want), nz[j]))
        return nz[clamp(i + shift, 0, len(nz) - 1)]

    inset = {k: at(m) for k, m in (("xs", 1), ("sm", 2), ("md", 3), ("lg", 4), ("xl", 6))}
    stack = {k: at(m) for k, m in (("xs", 1), ("sm", 2), ("md", 3), ("lg", 4), ("xl", 6))}
    inline = {k: at(m) for k, m in (("xs", 1), ("sm", 2), ("md", 3))}

    def outer(inner):  # smallest ladder value >= ratio x inner and at least one step above it (L15 P16)
        cands = [v for v in nz if v >= ratio * inner and v > inner]
        return cands[0] if cands else nz[-1]
    section = {"sm": outer(stack["md"]), "md": outer(stack["lg"]), "lg": outer(stack["xl"])}
    md_home = int(ctx.P("control.height.md", ctx.params["control.height.md"]))
    home = ctx.params["space.densityMode"]
    steps = [24, 32, 40, 48, 56]
    idx = {"spacious": 0, "comfortable": 1, "compact": 2}
    md = md_home + 8 * (idx[home] - idx[density])
    md = clamp(md, 32 if "touch" in ctx.space_info["targets"] else 24, 56)
    sm = max(24, md - 8)
    lg = md + 8
    ref = lambda v: A(f"space.{v}")
    out = {"space": {"$type": "dimension",
                     "$description": f"Semantic spacing, {density} density: aliases into the ladder, shifted {shift:+d} step (DC-L03-10, DC-L03-11). "
                                     "Parents own spacing; children never set outer margins (DC-L03-04).",
                     "$extensions": {NS: {"density": density, "innerOuterRatio": ratio, "excluded": levers()["formulas"]["density"]["excluded"],
                                          "evidence": ["DC-L03-04", "DC-L03-10", "DC-L03-11", "DC-L03-24", "S-L03-029"]}},
                     "inset": {k: tok(ref(v)) for k, v in inset.items()},
                     "stack": {k: tok(ref(v)) for k, v in stack.items()},
                     "inline": {k: tok(ref(v)) for k, v in inline.items()},
                     "section": {k: tok(ref(v), "Outer gap between groups: at least ratio x the inner gap (inner < outer, L15 P16).")
                                 for k, v in section.items()}},
           "size": {"$type": "dimension",
                    "control": {"$description": f"Control heights, {density} (DC-L03-07). Hit areas never shrink below size.target.min.",
                                "sm": tok(dim(sm)), "md": tok(dim(md)), "lg": tok(dim(lg))}}}
    # rows of lists and tables: the default control height plus 4 / 8 / 16 px, and 32 px for a two-line row
    # (Carbon rows 32/40/48/64 at 32px controls, S-L08-092; premium B2B tables 34-42, 48 and 56-78 px, DC-L23-06)
    rows = {"sm": md + 4, "md": md + 8, "lg": md + 16, "two-line": md + 32}
    out["size"]["row"] = {"$description": f"List and table row heights, {density}: one line dense (sm), default (md) and roomy (lg), and a "
                                          "row whose cells hold two lines. Hairlines between rows; hit areas follow size.target.min (DC-L23-06).",
                          **{k: tok(dim(v)) for k, v in rows.items()}}
    cta = clamp(lg, 48, 56) if ctx.raw.get("marketingSurfaces") else None
    if cta:  # the call to action on a marketing page: 48 to 56px, text.label.cta, one filled per view
        out["size"]["control"]["cta"] = tok(dim(cta), "Call-to-action buttons on marketing pages: 48 to 56px tall, one filled per view.")
    ctx.__dict__.setdefault("density_info", {})[density] = {"inset": inset, "stack": stack, "inline": inline, "section": section,
                                                          "control": dict({"sm": sm, "md": md, "lg": lg}, **({"cta": cta} if cta else {})),
                                                          "row": rows, "ratio": ratio}
    return out


# ---------------------------------------------------------------------------------------------- shape

def roundness_chosen(ctx):
    """True when the corners are a choice: the Roundness dial set (Q-shape-01 sets it), a named style, or a preset the
    person picked. Coupling, feel words and the default preset are not."""
    src = ctx.dial_src.get("roundness", "")
    return src.startswith(("set", "style:")) or (src.startswith("preset:") and not effective_preset(ctx.state)[1])


def unchosen_control(px):
    """A control radius nobody chose: never square and never a pill (levers formulas.radius.unchosen); 0-2px -> 6px."""
    u = levers()["formulas"]["radius"]["unchosen"]
    if px == "full" or (isinstance(px, (int, float)) and px >= FULL):
        return u["max"]
    return u["to"] if px < u["raiseBelow"] else min(px, u["max"])


def cta_shape(control):
    """The button shape in words: square (0-2px), subtle (4-6px), rounded (8-12px) or pill."""
    if control == "full" or control >= FULL:
        return "pill"
    return "square" if control <= 2 else "subtle" if control <= 6 else "rounded"


def build_shape(ctx):
    p = ctx.params
    rough = ctx.dials["roundness"]
    chosen = roundness_chosen(ctx)

    def own(name, computed):
        """A radius role in px: the person's value (radius_px) or the computed one. A stored value that is not a radius
        (from before engine.py set checked it, or edited by hand) is skipped, and validate says so."""
        v = ctx.P(name, computed)
        px = radius_px(v, name in RADIUS_PILLS)
        if px is None:
            ctx.notes.append(f"override {name} skipped: {json.dumps(v)} is not a radius it can take; the Roundness dial's value is used")
            ctx.used[name] = computed
            return radius_px(computed)
        return px
    computed = eval_map(lever_index()["radius.control"]["map"], rough)
    control = own("radius.control", computed if chosen else unchosen_control(computed))  # params hold the override already

    def corners(c):
        """(control, container, detail) for a control radius."""
        if c == "full" or (isinstance(c, (int, float)) and c >= FULL):
            # [inferred]: pill controls keep small square-ish details (M3 checkbox 2dp)
            return FULL, (snap_to(16 + (rough - 93) / 7 * 12, SNAP_RADII) if rough >= 93 else 20), 4
        cv = int(c)
        cont = snap_to(cv * 1.5, SNAP_RADII)
        if cv > 0:
            cont = max(cont, 8)
        # LEVERS B9 says detail = max(2, control/2); a sharp system (control 0) keeps 0, the same guard
        # container already has (correction logged in NOTES)
        return cv, cont, (0 if cv == 0 else snap_to(max(2, cv / 2), SNAP_RADII))
    control_v, container, detail = corners(control)
    full = control_v >= FULL
    drv = lever_index().get("radius.control")
    if drv and std_has_records(ctx.state) and "overrides.radius.control" in std_held(ctx.state):
        # a standard that fixes the control radius says nothing about cards and dialogs: they keep following the Roundness dial
        dial_c = eval_map(drv["map"], ctx.dials[drv["dial"]])
        _c, container, detail = corners(dial_c if chosen else unchosen_control(dial_c))
    container = own("radius.container", container)
    overlay = own("radius.overlay", snap_to(min(32, container * 1.5), SNAP_RADII) if container else 0)
    detail = own("radius.detail", detail)
    smallest = min([v for v in SNAP_RADII if v > 0])
    # shapes under 32px drop one step (S-L04-007): the step below the control radius, also when the person chose one between steps
    control_sm = FULL if full else max((s for s in SNAP_RADII if s < control_v), default=0)
    pad = ctx.density_info[ctx.params["space.densityMode"]]["inset"]["lg"]
    nested = 0 if container == 0 else max(container - pad, smallest)  # DC-L04-05
    focus_w = int(ctx.raw.get("focusWidth") or 2)
    offset = int(ctx.raw.get("focusOffset") if isinstance(ctx.raw.get("focusOffset"), (int, float)) else 2)
    focus_r = FULL if full else (max(0, control_v + offset) if control_v > 0 else 0)
    # a radius set between the steps (radius.control 10) gets its own step, so the role's alias has a target
    chosen = sorted({v for v in (control_v, control_sm, detail, container, overlay) if v < FULL} - set(SNAP_RADII))
    radius = {"$type": "dimension",
              "$description": "Radius scale snapped to 0, 2, 4, 6, 8, 12, 16, 20, 24, 28, 32 plus full (LEVERS B9, [inferred] ratios checked against Atlassian)."
                              + (f" {', '.join(str(v) for v in chosen)} added: a radius chosen between the steps (overrides.radius.*)." if chosen else ""),
              "$extensions": {NS: {"evidence": ["DC-L04-02", "DC-L04-03", "DC-L04-05", "S-L04-016", "S-L04-007"]}}}
    for v in sorted(set(SNAP_RADII) | set(chosen)):
        radius[str(v)] = tok(dim(v))
    radius["full"] = tok(dim(FULL), "Pills and avatars.")
    rr = lambda v: A("radius.full") if v >= FULL else A(f"radius.{v}")
    roles = levers()["formulas"]["radius"]["roles"]  # the same kind of thing takes one corner everywhere
    radius.update({
        "detail": tok(rr(detail), roles["detail"].capitalize() + "."),
        "control": tok(rr(control_v), roles["control"].capitalize() + ": one corner for all of them (Roundness dial or Q-shape-01, DC-L04-02)."),
        "control-sm": tok(rr(control_sm), "Controls under 32px tall drop one step (Fluent, S-L04-007)."),
        "container": tok(rr(container), roles["container"].capitalize() + ": one corner for all of them."),
        "overlay": tok(rr(overlay), roles["overlay"].capitalize() + "."),
        "person": tok(A("radius.full"), roles["person"].capitalize() + "."),
        "nested": tok(dim(nested), "Inner radius for an element inset by space.inset.lg inside a container: max(outer - padding, smallest step) (DC-L04-05)."),
        "focus": tok(dim(focus_r), "Focus ring radius = control radius + ring offset (Atlassian radius + 2px, S-L04-016)."),
    })
    bd = ctx.look.get("borderDefault")  # raw.borderDefault, else the style or preset (neo-brutalist: 3), else 1
    bd = int(bd) if isinstance(bd, (int, float)) and not isinstance(bd, bool) and 1 <= bd <= 4 else 1
    widths = sorted({1, 2, 4, bd} | {int(x) for x in (ctx.raw.get("borderWidths") or []) if isinstance(x, (int, float)) and 0 < x <= 8})
    border = {"$type": "dimension", "width": {
        "$description": f"Border widths {' / '.join(str(x) for x in widths)}. Width changes on state use an inset shadow so layout does not jump (DC-L04-07).",
        **{str(x): tok(dim(x)) for x in widths},
        "default": tok(A(f"border.width.{bd}"), None if bd == 1 else
                       f"Thick {bd}px outlines for the style (S-L15-006); solid borders go against STD-visual-details-14, chosen with the style."),
        "selected": tok(A("border.width.2" if bd < 2 else "border.width.4")), "emphasis": tok(A("border.width.4"))}}
    focus = {"$type": "dimension",
             "$description": f"Focus indicator: {focus_w}px ring, {offset}px offset" + (" (inside the edge)" if offset < 0 else "")
                             + ", color.border.focus; never color-only (DC-L04-09, WCAG 2.4.7, 2.4.13).",
             "ring": {"width": tok(dim(focus_w)), "offset": tok(dim(offset))}}
    ctx.shape_info = {"control": "full" if full else control_v, "control-sm": control_sm, "detail": detail, "container": container,
                      "overlay": overlay, "nested": nested, "focusWidth": focus_w, "focusRadius": focus_r,
                      "iconCorners": p["icon.cornerStyle"], "iconCaps": p["icon.caps"], "borderDefault": bd,
                      "ctaShape": cta_shape(control_v), "chosen": chosen or "radius.control" in (ctx.state.get("overrides") or {}),
                      # Q-shape-04 (DC-L04-04): corner geometry. The radii are the same on every platform; this says how each draws them
                      "cornerShape": ctx.raw.get("cornerShape") or "circular"}
    return {"radius": radius, "border": border, "focus": focus}


# ---------------------------------------------------------------------------------------------- elevation

def shadow_layer(color, x, y, blur, spread=0, inset=False):
    v = {"color": A(color), "offsetX": dim(x), "offsetY": dim(y), "blur": dim(blur), "spread": dim(spread)}
    if inset:
        v["inset"] = True
    return v


def build_elevation(ctx):
    model = ctx.elevation_model()
    pressed = None
    none = [shadow_layer("color.shadow.key", 0, 0, 0, 0)]
    ring = shadow_layer("color.shadow.ring", 0, 0, 0, 1)
    two = lambda y, b: [shadow_layer("color.shadow.key", 0, 1, 2, 0), shadow_layer("color.shadow.ambient", 0, y, b, 0)]
    ladder = {}
    if model in ("shadow-ladder", "materials"):
        for i, nlev in enumerate(levers()["formulas"]["elevation"]["shadowLadder"]["levels"], start=1):
            ladder[str(i)] = tok([shadow_layer("color.shadow.ambient", 0, 0, 2, 0),
                                  shadow_layer("color.shadow.key", 0, nlev / 2, nlev, 0)],
                                 f"Level {nlev}: ambient 0 0 2px + key 0 {nlev / 2:g}px {nlev}px (Fluent formula, S-L09-179).")
        raised, floating, overlay = A("elevation.shadow.1"), A("elevation.shadow.3"), A("elevation.shadow.5")
    elif model == "tonal":
        raised, floating, overlay = none, two(4, 12), two(12, 32)
    elif model == "ring+faint-shadow":
        raised = [ring, shadow_layer("color.shadow.key", 0, 1, 2, 0)]
        floating = [ring] + two(4, 12)
        overlay = [ring] + two(12, 32)
    elif model == "offset":  # solid, no blur, 4px (S-L15-006); bigger surfaces get a deeper shadow (STD-visual-details-19) [inferred steps]
        hard = lambda n_: [shadow_layer("color.shadow.offset", n_, n_, 0, 0)]
        raised, floating, overlay, pressed = hard(4), hard(6), hard(8), hard(2)
    elif model == "extruded":  # paired light and dark shadows; pressed swaps both to inset (S-L15-060) [inferred sizes, styles.md]
        pair = lambda n_, inset=False: [shadow_layer("color.shadow.highlight", -n_, -n_, 2 * n_, 0, inset),
                                        shadow_layer("color.shadow.key", n_, n_, 2 * n_, 0, inset)]
        raised, floating, overlay, pressed = pair(6), pair(8), pair(12), pair(4, inset=True)
    elif model == "clay":  # two inner shadows on opposite edges plus a soft drop shadow (S-L19-058, DC-L19-67) [inferred sizes]
        bulge = [shadow_layer("color.shadow.key", -6, -6, 12, 0, inset=True), shadow_layer("color.shadow.highlight", 6, 6, 12, 0, inset=True)]
        drop = lambda y, b: [shadow_layer("color.shadow.ambient", 0, y, b, 0)]
        raised, floating, overlay, pressed = drop(8, 16) + bulge, drop(16, 32) + bulge, drop(24, 48) + bulge, copy.deepcopy(bulge)
    elif model == "glow":  # a colored blur with no offset over a faint ring (DC-L19-67); dialogs keep a real shadow [inferred sizes]
        glow = lambda b: [ring, shadow_layer("color.shadow.glow", 0, 0, b, 0)]
        raised, floating, pressed = glow(12), glow(24), glow(6)
        overlay = [ring] + two(12, 32) + [shadow_layer("color.shadow.glow", 0, 0, 40, 0)]
    else:  # borders
        raised = floating = overlay = none
    desc = {"borders": "Borders only: surfaces separate by 1px borders; no shadows (GOV.UK, Primer; L09 M7).",
            "ring+faint-shadow": "1px alpha ring plus an extra-small shadow (shadcn, Geist, Radix).",
            "tonal": "Tonal layers: surfaces step in lightness; shadows only on floating UI (Carbon, Material 3, Linear).",
            "shadow-ladder": "Key + ambient shadow ladder (Fluent 2, Polaris).",
            "materials": "Shadow ladder plus glass for controls and navigation only, with solid fallbacks (Liquid Glass, Acrylic).",
            "offset": "Hard offset shadows: solid, no blur, in the text color, deeper on bigger surfaces (neo-brutalism, S-L15-006).",
            "extruded": "Paired soft shadows, light up and left, dark down and right (neumorphism, S-L15-060). Shadows are not an edge: "
                        "controls keep a 3:1 border.",
            "clay": "A soft drop shadow plus two inner shadows, so shapes bulge like clay (S-L19-058). Inner shadows are not an edge: "
                    "controls keep a 3:1 border.",
            "glow": "A soft accent-colored glow with no offset over a faint ring (neon, synthwave, AI glow; DC-L19-67). A glow marks what "
                    "matters and is not an edge: controls keep a 3:1 border, and piled-up glows read as amateur (S-L19-045)."}[model]
    evidence = {"offset": ["S-L15-006", "DC-L19-67"], "extruded": ["S-L15-060", "DC-L19-67"], "clay": ["S-L19-058", "DC-L19-67"],
                "glow": ["DC-L19-67", "S-L19-059", "S-L19-045"]}.get(model, [])
    el = {"$type": "shadow", "$description": desc + (" In dark mode the shadow takes the light text color." if model == "offset" else
                                                     " Dark mode doubles shadow alpha and lifts surfaces (DC-L04-12, DC-L04-13)."),
          "$extensions": {NS: {"model": model, "depth": ctx.dials["depth"], "shadowAlphaLight": shadow_alpha(ctx),
                               "evidence": ["DC-L04-10", "DC-L04-12", "DC-L04-13", "L09-M7"] + evidence}},
          "raised": tok(raised, "Cards that lift on hover, sticky headers, dragged rows."),
          "floating": tok(floating, "Menus, popovers, dropdowns."),
          "overlay": tok(overlay, "Dialogs and sheets (with color.overlay.scrim).")}
    if pressed:
        el["pressed"] = tok(pressed, "Pressed controls: the element moves into its shadow" if model == "offset" else
                            "Pressed controls: the glow tightens. Pressed also needs a second signal, such as a fill change." if model == "glow" else
                            "Pressed controls: the shadows turn inward. Pressed also needs a second signal, such as a fill change.")
    if "surfaces" in (ctx.profile or {}).get("items", {}):  # static surfaces flat, floating ones lifted (DC-L23-05)
        why = f"({ctx.profile['name'].lower()} default, DC-L23-05)"
        if model in ("ring+faint-shadow", "shadow-ladder", "materials"):
            el["raised"] = tok([ring], "Static cards and panels: a 1px ring, no shadow; shadows stay on floating layers, and dragged "
                                       f"rows use elevation.floating {why}.")
        elif model == "borders":
            el["floating"] = tok([ring] + two(4, 12), f"Menus, popovers, dropdowns, toasts and the bulk-action bar: they float, so they keep a shadow {why}.")
            el["overlay"] = tok([ring] + two(12, 32), f"Dialogs and sheets (with color.overlay.scrim): they float, so they keep a shadow {why}.")
    out = {"elevation": el}
    if ladder:
        el["shadow"] = ladder
    if (model == "materials" and ctx.raw.get("glass") is not False) or ctx.raw.get("glass") is True:
        out["material"] = {"glass": {"blur": tok(dim(24), "Backdrop blur for glass controls and bars.", type_="dimension")}}
    ctx.elev_info = {"model": model, "alpha": shadow_alpha(ctx)}
    return out


TEXTURES = {  # strength [inferred, references/styles.md surface glossary]; each recipe is drawn by the CSS export, never a token
    "grain": (0.06, "Grain: a fine static noise", {"asset": "inline SVG feTurbulence fractal noise", "baseFrequency": 0.8, "blend": "overlay"}),
    "halftone": (0.12, "Halftone: a grid of small dots, like comic shading", {"asset": "radial-gradient dot grid", "dot": 1.5, "cell": 8,
                                                                              "blend": "normal"}),
    "scanlines": (0.15, "Scanlines: thin horizontal lines, like an old TV", {"asset": "repeating-linear-gradient lines", "line": 1, "period": 3,
                                                                            "blend": "normal"}),
}


def build_texture(ctx):
    """A texture layer (raw.texture, or a style such as risograph or comic dots). Noise and patterns are image assets, not tokens
    (DC-L19-12): only the strength is a token, the recipe lives in $extensions, and the CSS export draws it. Static, behind
    content, off under more contrast and forced colors."""
    kind = ctx.look.get("texture")
    if kind not in TEXTURES:
        return {}
    strength, what, recipe = TEXTURES[kind]
    return {"texture": {"$type": "number", kind: {
        "$description": f"{what}, behind content on brand surfaces, used sparingly so it never reads as TV static (S-L19-082). "
                        "Never over body text, controls or data.",
        "$extensions": {NS: dict(recipe, motion="static", layer="behind content", allowedSurfaces=["marketing", "hero", "brand panels"],
                                 offUnder=["prefers-contrast: more", "forced-colors: active"],
                                 evidence=["DC-L19-12", "S-L19-062", "S-L19-082"], inferred=["opacity", "sizes"])},
        "opacity": tok(strength, f"{kind.title()} strength [inferred, references/styles.md].")}}}


# ---------------------------------------------------------------------------------------------- motion

def spring_curve(damping, stiffness, samples=24):
    """Step response of a mass-1 spring, sampled into CSS linear() (DC-L04-22). Returns (linear(), ms)."""
    w = math.sqrt(stiffness)
    z = damping
    over = z > 1 + 1e-6
    if z < 1:
        t_end = math.log(1000) / (z * w)
    elif over:  # overdamped: the slower of the two decays sets the settle time
        t_end = 9.2 / (w * (z - math.sqrt(z * z - 1)))
    else:
        t_end = 9.2 / w
    wd = w * math.sqrt(max(1e-9, 1 - z * z))
    r1, r2 = (-w * (z - math.sqrt(z * z - 1)), -w * (z + math.sqrt(z * z - 1))) if over else (0.0, 0.0)

    def x(t):
        if z < 1:
            return 1 - math.exp(-z * w * t) * (math.cos(wd * t) + (z * w / wd) * math.sin(wd * t))
        if over:
            return 1 - (r2 * math.exp(r1 * t) - r1 * math.exp(r2 * t)) / (r2 - r1)
        return 1 - math.exp(-w * t) * (1 + w * t)
    pts = [rnd(x(t_end * i / samples), 3) for i in range(samples + 1)]
    pts[0], pts[-1] = 0, 1
    return "linear(" + ", ".join(f"{v:g}" for v in pts) + ")", int(round(t_end * 1000 / 10) * 10)


def spring_params(value):
    """(dampingRatio, stiffness at mass 1) of a spring written as {dampingRatio, stiffness, mass?}, else None."""
    if not (isinstance(value, dict) and {"dampingRatio", "stiffness"} <= set(value) <= {"dampingRatio", "stiffness", "mass"}):
        return None
    z, k, m = value["dampingRatio"], value["stiffness"], value.get("mass", 1)
    if not all(isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) and x > 0 for x in (z, k, m)):
        return None
    return rnd(z, 3), rnd(k / m, 1)  # the damping ratio already includes the mass; the curve needs stiffness per unit mass


def spring_token(z, stiff, standard):
    """A spring as DTCG 2025.10 stores it (no spring type, S-L07-002 issue #429): a transition $value with a cubic-bezier
    fallback, and $extensions holding dampingRatio and stiffness, Apple duration and bounce, and a CSS linear() sample
    (DC-L04-22), for a critically damped spring too, since a cubic-bezier cannot draw its settle (R19). The $value keeps
    the standard curve as the fallback for tools that read no $extensions. Returns ($value, extensions)."""
    lin, dur = spring_curve(z, stiff)
    ext = {"spring": {"dampingRatio": z, "stiffness": stiff, "mass": 1},
           "apple": {"duration": rnd(2 * math.pi / math.sqrt(stiff), 3), "bounce": rnd(max(0.0, 1 - z), 3)},
           "css": {"easing": lin, "durationMs": dur}}
    return {"duration": ms(dur), "delay": ms(0), "timingFunction": A("motion.easing.standard")}, ext


DURATION_NOTES = {"extra": "Illustrative and marketing motion only: UI animations stay under 300ms (house standard STD-easing-duration-06).",
                  "medium-exit": "About 0.8 x medium, the entrance in force (STD-easing-duration-11).",
                  "long-exit": "About 0.8 x long, the entrance in force (STD-easing-duration-11)."}


def _entrance_ms(state, step, computed):
    """The entrance duration in force for motion.duration.<step>: a value set for the token (by a standard or the person),
    else the ladder's own."""
    v = (state.get("overrides") or {}).get(f"motion.duration.{step}")
    v = coerce_token_value(v, "duration") if v is not None else None
    if isinstance(v, dict) and isinstance(v.get("value"), (int, float)) and not isinstance(v.get("value"), bool) and v["value"] > 0:
        return v["value"] * (1000 if v.get("unit") == "s" else 1)
    return computed


def build_motion(ctx):
    p = ctx.params
    energy = ctx.dials["energy"]
    mult = float(ctx.P("motion.durationMultiplier", p["motion.durationMultiplier"]))
    r10 = lambda v: int(round(v / 10) * 10)
    d = {"instant": 0, "micro": 100, "short": 150, "medium": r10(250 * mult), "long": r10(400 * mult), "extra": r10(700 * mult)}
    exit_k = 0.8  # exits about 20% shorter than entrances: house standard STD-easing-duration-11 (Atlassian 250/200, Primer 300/200)
    # derived from the entrance in force, so a value a standard or the person set for medium or long keeps its exit coherent
    # (D05); an exit a standard or the person sets directly still wins, through the token overrides
    d["medium-exit"] = r10(_entrance_ms(ctx.state, "medium", d["medium"]) * exit_k)
    d["long-exit"] = r10(_entrance_ms(ctx.state, "long", d["long"]) * exit_k)
    std = p["motion.easing.standard"]
    if energy <= 33:
        enter, exit_ = [0, 0, 0.38, 0.9], [0, 0, 0.38, 0.9]     # Carbon productive enter curve (S-L06-002); exits too (below)
    elif energy <= 66:
        enter, exit_ = [0, 0, 0, 1], [0, 0, 0, 1]              # Material decelerate, for exits too (below)
    else:
        enter, exit_ = [0, 0, 0.3, 1], [0, 0, 0.3, 1]          # Carbon expressive enter curve (S-L06-002)
    # Exits decelerate like entrances: house standard STD-easing-duration-03 bans ease-in on UI, so even when a person
    # overrides the stronger house curves (STD-easing-duration-02), exits never fall back to an accelerating curve.
    zeta = float(ctx.P("motion.spring.spatial.dampingRatio", p["motion.spring.spatial.dampingRatio"]))
    k = float(ctx.P("motion.spring.spatial.stiffness", p["motion.spring.spatial.stiffness"]))
    zeta, k = rnd(zeta, 3), rnd(k, 1)
    springs = {}
    for group, (z, ks) in {"spatial": (zeta, {"fast": k * 2, "default": k, "slow": k * 0.45}),
                           "effects": (1.0, {"fast": 3800, "default": 1600, "slow": 800})}.items():
        g = {}
        for speed, stiff in ks.items():
            val, ext = spring_token(z, rnd(stiff, 1), std)
            ext["use"] = {"fast": "small components (switches, buttons)", "default": "partial-screen (sheets, drawers)",
                          "slow": "full-screen"}[speed]
            g[speed] = tok(val, None, ext)
        springs[group] = g
    motion = {
        "duration": {"$type": "duration",
                     "$description": f"Duration ladder (DC-L04-20); Energy multiplies medium and longer by {mult:.2f} (0.8-1.2, A4). Exits about 20% shorter (STD-easing-duration-11).",
                     **{kk: tok(ms(v), DURATION_NOTES.get(kk)) for kk, v in d.items()}},
        "easing": {"$type": "cubicBezier", "$description": "Standard, enter (decelerate) and exit curves; linear only for spinners and progress (DC-L04-21).",
                   "standard": tok(std, "Moving and morphing on screen."), "enter": tok(enter, "Entering: decelerate."),
                   "exit": tok(exit_, "Leaving the screen."), "linear": tok([0, 0, 1, 1], "Spinners and progress only.")},
        "spring": {"$type": "transition",
                   "$description": "Springs. DTCG 2025.10 has no spring type (S-L07-002, issue #429): each is a transition with a cubic-bezier "
                                   "fallback; dampingRatio and stiffness live in $extensions with Apple duration/bounce and a CSS linear() "
                                   "sample (DC-L04-22, L04 token-encoding default). Effects springs stay critically damped (S-L04-004).",
                   **springs},
    }
    ctx.motion_info = {"durations": d, "multiplier": mult, "standard": std, "enter": enter, "exit": exit_,
                       "spatial": {"dampingRatio": zeta, "stiffness": k, "bounce": rnd(1 - zeta, 3) if zeta < 1 else 0},
                       "motionOff": bool(ctx.flags.get("motionOff"))}
    return {"motion": motion}


def build_motion_context(ctx, context):
    reduced = context == "reduced" or ctx.flags.get("motionOff")
    off = bool(ctx.flags.get("motionOff")) or (context == "reduced" and ctx.raw.get("reducedMotion") == "remove")

    def t(dur, ease, desc):
        return tok({"duration": A(f"motion.duration.{dur}"), "delay": ms(0), "timingFunction": A(f"motion.easing.{ease}")}, desc)
    # hover and color changes take the hover curve when the system has one (house standard STD-easing-duration-01: ease for
    # hover and color changes, never the ease-in-out that moves things on screen); else the standard curve
    fb_ease = "hover" if "motion.easing.hover" in (ctx.state.get("overrides") or {}) else "standard"
    if reduced:
        fb = "instant" if off else "micro"
        body = {"feedback": t(fb, fb_ease, "Color and opacity feedback stays (reduced motion keeps feedback, DC-L04-25)."),
                "enter": t(fb, "standard", "Fade only: no translate or scale."),
                "exit": t(fb, "standard", "Fade only."),
                "move": t("instant", "standard", "Travel removed: position changes are instant."),
                "expand": t(fb, "standard", "Fade only.")}
    else:
        body = {"feedback": t("micro", fb_ease, "Hover, press, color changes."),
                "enter": t("medium", "enter", "Menus, popovers, toasts entering."),
                "exit": t("medium-exit", "exit", "Leaving the screen, shorter than entering (exit durations: STD-easing-duration-11)."),
                "move": tok(A("motion.spring.spatial.default"), "On-screen movement: spatial spring (web: linear() sample)."),
                "expand": t("long", "enter", "Dialogs, sheets, side panels entering.")}
    desc = f"Semantic transitions, {context} motion. Reduced motion is a token mode: travel becomes opacity, feedback stays (DC-L04-25)."
    if off and not ctx.flags.get("motionOff"):
        desc += " Q-motion-07 remove: feedback is instant too."
    elif off:
        desc += " flags.motionOff is set, so standard equals reduced (GOV.UK posture, L09 M8)."
    return {"motion": {"transition": dict({"$type": "transition", "$description": desc}, **body)}}


# =============================================================================================
# Generate: files, resolver, contrast pairs, meta
# =============================================================================================

TOKEN_FILES_ORDER = ["primitives", "semantic"]


def contrast_pairs(ctx):
    """Every foreground/background pair the semantic layer promises, per mode (DC-L01-22, B5)."""
    tmin = 7.0 if ctx.raw.get("contrastTarget") == "AAA" else 4.5
    surfaces = ["color.surface.base", "color.surface.raised", "color.surface.sunken", "color.surface.overlay"]
    text_on = {
        "color.text.primary": surfaces + ["color.bg.neutral.subtle", "color.bg.neutral.subtle-hover", "color.bg.neutral.subtle-pressed",
                                          "color.bg.accent.subtle"],
        "color.text.secondary": surfaces + ["color.bg.neutral.subtle", "color.bg.neutral.subtle-hover"],
        "color.text.tertiary": surfaces,
        "color.text.link": surfaces + ["color.bg.accent.subtle"],
        "color.text.on-accent": ["color.bg.accent.bold", "color.bg.accent.bold-hover", "color.bg.accent.bold-pressed"],
        "color.text.on-action": ["color.bg.action.primary", "color.bg.action.primary-hover", "color.bg.action.primary-pressed"],
        "color.text.on-brand": ["color.bg.brand"],
        "color.text.inverse": ["color.bg.inverse"],
    }
    text_on["color.text.primary"].append("color.bg.field")
    for s in [x for x in ("success", "warning", "danger", "info", "discovery") if x in ctx.cinfo["ramps"]]:
        text_on[f"color.text.{s}"] = ["color.surface.base", "color.surface.raised", f"color.bg.{s}.subtle"]
        text_on[f"color.text.on-{s}"] = [f"color.bg.{s}.bold", f"color.bg.{s}.bold-hover", f"color.bg.{s}.bold-pressed"]
    for extra in ("accent2", "accent3"):
        if extra in ctx.cinfo["ramps"]:
            text_on[f"color.text.{extra}"] = ["color.surface.base", "color.surface.raised", f"color.bg.{extra}.subtle"]
            text_on[f"color.text.on-{extra}"] = [f"color.bg.{extra}.bold", f"color.bg.{extra}.bold-hover", f"color.bg.{extra}.bold-pressed"]
    if ctx.raw.get("statusSet") == "workflow":
        for st in ("todo", "in-progress", "done", "blocked", "review"):
            text_on[f"color.workflow.{st}.text"] = [f"color.workflow.{st}.bg"]
    non_text = {
        "color.border.strong": surfaces,
        "color.border.input": surfaces + ["color.bg.neutral.subtle", "color.bg.field"],
        "color.icon.default": surfaces + ["color.bg.neutral.subtle"],
        "color.border.danger": surfaces,
    }
    focus_bgs = surfaces + ["color.bg.neutral.subtle"]
    pairs = []
    for mode in ctx.modes:
        for fg, bgs in text_on.items():
            for bg in bgs:
                pairs.append({"mode": mode, "fg": fg, "bg": bg, "min": tmin, "kind": "text",
                              "rule": "WCAG 2.2 SC 1.4.3" + (" / 1.4.6 (AAA)" if tmin > 4.5 else ""), "level": "error"})
        for fg, bgs in non_text.items():
            for bg in bgs:
                pairs.append({"mode": mode, "fg": fg, "bg": bg, "min": 3.0, "kind": "non-text", "rule": "WCAG 2.2 SC 1.4.11", "level": "error"})
        for bg in focus_bgs:
            pr = {"mode": mode, "fg": "color.border.focus", "bg": bg, "min": 3.0, "kind": "focus", "rule": "WCAG 2.2 SC 1.4.11, 2.4.13",
                  "level": "error"}
            if ctx.raw.get("focusColor") or ctx.raw.get("focusStyle") == "two-tone":
                pr["inner"] = "color.border.focus-inner"
            pairs.append(pr)
        cp = ctx.raw.get("chartPalette")
        if cp in ("categorical-8", "categorical-14", "brand-gray"):
            n_cat = {"categorical-8": 8, "categorical-14": 14, "brand-gray": 2}[cp]
            marks = [f"color.chart.categorical.{i}" for i in range(1, n_cat + 1)] + ["color.chart.brand"]
            marks += [f"color.chart.diverging.{i}" for i in range(1, len(DIVERGING_RATIOS) + 1)]
            marks += [f"color.chart.status.{x}" for x in ("success", "warning", "danger", "info", "discovery") if x in ctx.cinfo["ramps"]]
            for fg in marks:
                pairs.append({"mode": mode, "fg": fg, "bg": "color.surface.base", "min": 3.0, "kind": "chart",
                              "rule": "WCAG 2.2 SC 1.4.11 (chart marks)", "level": "warning"})
        if ctx.raw.get("tableRows") == "zebra":  # text on striped rows keeps its minimum (Q-pattern-07)
            for fg in ("color.text.primary", "color.text.secondary"):
                pairs.append({"mode": mode, "fg": fg, "bg": "color.surface.row-alternate", "min": tmin, "kind": "text",
                              "rule": "WCAG 2.2 SC 1.4.3 (text on zebra rows)", "level": "error"})
        if (ctx.elevation_model() == "materials" and ctx.raw.get("glass") is not False) or ctx.raw.get("glass") is True:
            # text on glass changes with whatever scrolls behind it, so check the worst case: black content under light glass,
            # white under dark glass (S-L15-078; STD-visual-details-13 asks for the strongest text on glass)
            behind = "#000000" if mode == "light" else "#ffffff"
            pairs.append({"mode": mode, "fg": "color.text.primary", "bg": "color.surface.glass", "behind": behind, "min": tmin,
                          "kind": "text-on-glass", "rule": "WCAG 2.2 SC 1.4.3, worst content behind the glass", "level": "error"})
            pairs.append({"mode": mode, "fg": "color.icon.default", "bg": "color.surface.glass", "behind": behind, "min": 3.0,
                          "kind": "icon-on-glass", "rule": "WCAG 2.2 SC 1.4.11, worst content behind the glass", "level": "error"})
        for bg in ("color.surface.base", "color.surface.raised"):
            pairs.append({"mode": mode, "fg": "color.bg.action.primary", "bg": bg, "min": 3.0, "kind": "fill-boundary",
                          "rule": "WCAG 2.2 SC 1.4.11 (advisory: a text-labelled button needs no boundary contrast)", "level": "warning"})
    return pairs


def build_resolver(ctx, files):
    foundation = [f for f in files if not re.search(r"\.(light|dark|spacious|comfortable|compact|standard|reduced)\.tokens\.json$", f)
                  and f.endswith(".tokens.json")]
    order = {n: i for i, n in enumerate(TOKEN_FILES_ORDER)}
    foundation.sort(key=lambda f: order.get(f.replace(".tokens.json", ""), 99))
    res = {"name": ctx.state.get("name") or "Design system", "version": "2025.10",
           "description": "DTCG Resolver Module 2025.10. Orthogonal modifiers (no two set the same token): "
                          + " x ".join(["theme"] if len(ctx.modes) > 1 else []) + (" x " if len(ctx.modes) > 1 else "")
                          + "density x motion (S-L07-004, DC-L07-15, DC-L07-17).",
           "sets": {"foundation": {"description": "Primitives and mode-independent tokens.",
                                   "sources": [{"$ref": f} for f in foundation]}},
           "modifiers": {}, "resolutionOrder": [{"$ref": "#/sets/foundation"}]}
    if len(ctx.modes) > 1:
        default_theme = "dark" if ctx.raw.get("defaultTheme") == "dark" else "light"
        res["modifiers"]["theme"] = {"description": "Color scheme; dark is a separate mapping, not an inversion (DC-L01-18).",
                                     "contexts": {m: [{"$ref": f"semantic.color.{m}.tokens.json"}] for m in ctx.modes},
                                     "default": default_theme}
        res["resolutionOrder"].append({"$ref": "#/modifiers/theme"})
    else:
        res["sets"]["theme"] = {"description": f"Single color scheme ({ctx.modes[0]}).",
                                "sources": [{"$ref": f"semantic.color.{ctx.modes[0]}.tokens.json"}]}
        res["resolutionOrder"].append({"$ref": "#/sets/theme"})
    res["modifiers"]["density"] = {"description": "Semantic spacing density; primitives and target minimums never change (DC-L03-11).",
                                   "contexts": {d: [{"$ref": f"semantic.density.{d}.tokens.json"}] for d in DENSITIES},
                                   "default": ctx.params["space.densityMode"]}
    res["modifiers"]["motion"] = {"description": "Reduced motion as a token mode (DC-L04-25; WCAG 2.3.3 treated as required).",
                                  "contexts": {c: [{"$ref": f"motion.{c}.tokens.json"}] for c in ("standard", "reduced")},
                                  "default": "reduced" if ctx.flags.get("motionOff") else "standard"}
    res["resolutionOrder"] += [{"$ref": "#/modifiers/density"}, {"$ref": "#/modifiers/motion"}]
    return res


PARAM_OVERRIDES = {"type.displayReach", "radius.container", "radius.overlay", "radius.detail", "color.dark.baseY",
                   "color.placeholderHue", "type.maxStepGapMerge"}
MODE_WORDS = {"light": "theme", "dark": "theme", "spacious": "density", "comfortable": "density", "compact": "density",
              "standard": "motion", "reduced": "motion"}


def is_param_override(key):
    return key in PARAM_OVERRIDES or key in lever_index()


RADIUS_PARAMS = ("radius.control", "radius.container", "radius.overlay", "radius.detail")
RADIUS_PILLS = ("radius.control", "radius.detail")  # pill buttons and tags; a pill card or dialog is not a shape the engine builds


def _px_number(value):
    """12, 12.5 or "12px" -> the number of px; None for anything else."""
    if isinstance(value, str):
        m = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*px\s*", value)
        return float(m.group(1)) if m else None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    return value


def radius_px(value, pill=True):
    """A radius role's value in whole px as build_shape uses it: "full" (or anything from FULL up) is FULL, "10px" is 10.
    None when it is not a radius (negative, another unit, words), or is full for a role that cannot be a pill."""
    n = FULL if value == "full" else _px_number(value)
    if n is None or n < 0 or (n >= FULL and not pill):
        return None
    return FULL if n >= FULL else int(round(n))


def param_value(key, value):
    """A lever parameter's value as stored, for the parameters whose number names a step. A radius between the steps of
    the scale is added to the scale (build_shape), so radius.control 10 builds; the default icon size is one of the three
    icon sizes. Raises ValueError, in plain words, for a value the engine cannot build. Other parameters pass through."""
    if value is None:
        return None
    if key in RADIUS_PARAMS:
        pill = key in RADIUS_PILLS
        n = FULL if value == "full" else _px_number(value)
        if n is None or n < 0 or n != int(n) or (n >= FULL and not pill):
            raise ValueError(f"{key} takes a corner radius in whole px, such as 10 or \"10px\"" + (", or \"full\" for pill shapes" if pill else "")
                             + f". The scale has {', '.join(str(s) for s in SNAP_RADII)} and full; a radius between those steps is added to it")
        return "full" if n >= FULL else int(n)
    if key == "icon.defaultSize":
        n = _px_number(value)
        if n not in (16, 20, 24):
            raise ValueError("icon.defaultSize takes 16, 20 or 24, the three icon sizes (size.icon.sm, md and lg)")
        return int(n)
    return value


def split_mode_key(key):
    """'compact:size.row.md' -> ('compact', 'size.row.md'); 'size.row.md' -> (None, 'size.row.md')."""
    if ":" in key:
        mode, path = key.split(":", 1)
        return mode.strip(), path.strip()
    return None, key


def _node_at(tree, parts):
    node = tree
    for q in parts:
        node = node.get(q) if isinstance(node, dict) else None
        if node is None:
            return None
    return node


def _group_type(tree, parts):
    """$type inherited from the nearest group of a path inside one token file."""
    node, t = tree, tree.get("$type") if isinstance(tree, dict) else None
    for q in parts[:-1]:
        node = node.get(q) if isinstance(node, dict) else None
        if not isinstance(node, dict):
            break
        t = node.get("$type", t)
    return t


def infer_token_type(value, path):
    """DTCG $type for a value a person gives (U5 F2): hex -> color, 12 / '12px' -> dimension, '250ms' -> duration."""
    head = path.split(".")[0]
    if isinstance(value, str):
        v = value.strip()
        if re.fullmatch(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})", v):
            return "color"
        if re.fullmatch(r"-?\d+(\.\d+)?(px|rem)", v):
            return "dimension"
        if re.fullmatch(r"\d+(\.\d+)?(ms|s)", v):
            return "duration"
        if path.startswith("font.family."):
            return "fontFamily"
        if "easing" in path and css_easing(v):
            return "cubicBezier"
        return None
    if isinstance(value, dict) and "unit" in value:
        return "duration" if value["unit"] in ("ms", "s") else "dimension"
    if isinstance(value, dict) and "colorSpace" in value:
        return "color"
    if isinstance(value, list) and len(value) == 4 and all(isinstance(x, (int, float)) for x in value) and "easing" in path:
        return "cubicBezier"
    if isinstance(value, list) and path.startswith("font.family."):
        return "fontFamily"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if path.startswith("font.weight."):
            return "fontWeight"
        if head == "opacity":
            return "number"
        if path.startswith("motion.duration."):
            return "duration"
        if head in ("space", "size", "radius", "border", "focus", "font", "icon", "material"):
            return "dimension"
    return None


CSS_EASINGS = {"linear": [0, 0, 1, 1], "ease": [0.25, 0.1, 0.25, 1], "ease-in": [0.42, 0, 1, 1], "ease-out": [0, 0, 0.58, 1],
               "ease-in-out": [0.42, 0, 0.58, 1]}  # the CSS keyword curves (CSS Easing Functions Level 1)


def css_easing(text):
    """'ease-out' or 'cubic-bezier(0.23, 1, 0.32, 1)' -> its four numbers; None when the text is neither."""
    if not isinstance(text, str):
        return None
    t = text.strip().lower()
    if t in CSS_EASINGS:
        return list(CSS_EASINGS[t])
    m = re.fullmatch(r"cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)", t)
    if not m:
        return None
    try:
        return [float(x) if "." in x else int(x) for x in m.groups()]
    except ValueError:
        return None


def coerce_token_value(value, typ):
    """A person's value in DTCG 2025.10 form for a token type; None when it cannot be (aliases pass through)."""
    if isinstance(value, str) and value.startswith("{") and value.endswith("}"):
        return value
    if typ == "color":
        if isinstance(value, dict) and "colorSpace" in value:
            return value
        if isinstance(value, str) and re.fullmatch(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})", value.strip()):
            hx = value.strip().lower()
            hx = "#" + "".join(c * 2 for c in hx[1:]) if len(hx) == 4 else hx
            return srgb_value(hx)
        return None
    if typ == "dimension":
        if isinstance(value, dict) and isinstance(value.get("value"), (int, float)) and value.get("unit") in ("px", "rem"):
            return value
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return dim(value)
        m = re.fullmatch(r"\s*(-?\d+(?:\.\d+)?)(px|rem)\s*", value) if isinstance(value, str) else None
        return {"value": float(m.group(1)) if "." in m.group(1) else int(m.group(1)), "unit": m.group(2)} if m else None
    if typ == "duration":
        if isinstance(value, dict) and value.get("unit") in ("ms", "s"):
            return value
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return ms(value)
        m = re.fullmatch(r"\s*(\d+(?:\.\d+)?)(ms|s)\s*", value) if isinstance(value, str) else None
        return {"value": float(m.group(1)) if "." in m.group(1) else int(m.group(1)), "unit": m.group(2)} if m else None
    if typ in ("number", "fontWeight"):
        return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None
    if typ == "fontFamily":
        return value if isinstance(value, (str, list)) else None
    if typ == "cubicBezier":
        if isinstance(value, str):
            return css_easing(value)
        return value if isinstance(value, list) and len(value) == 4 else None
    if typ == "transition" and isinstance(value, dict) and ({"dampingRatio", "stiffness"} & set(value)):
        return value if spring_params(value) else None  # a spring: apply_token_overrides writes it as a transition
    if typ == "shadow":  # each layer's color and sizes in DTCG form, so a hex like "#ffffff" builds (it once broke every export)
        layers = []
        for lay in (value if isinstance(value, list) else [value]):
            if isinstance(lay, str) and lay.startswith("{") and lay.endswith("}"):
                layers.append(lay)
                continue
            if not (isinstance(lay, dict) and {"color", "offsetX", "offsetY", "blur"} <= set(lay)):
                return None
            out = dict(lay, color=coerce_token_value(lay["color"], "color"), spread=lay.get("spread", 0))
            for k in ("offsetX", "offsetY", "blur", "spread"):
                out[k] = coerce_token_value(out[k], "dimension")
            if any(out[k] is None for k in ("color", "offsetX", "offsetY", "blur", "spread")) or not isinstance(out.get("inset", False), bool):
                return None
            layers.append(out)
        return layers if isinstance(value, list) else layers[0]
    return value  # other composite types (typography, transition, gradient) are passed through as given


SHADOW_HINT = ("; each layer needs color (a hex such as \"#111111\" or an alias such as \"{color.text.primary}\"), offsetX, offsetY "
               "and blur (numbers in px, or \"4px\"), and may have spread and inset: true")


def override_plan(files, key, value, default_density, typ=None):
    """Where a token override lands and in what form: {files: [..], values: {file: value}, type, new, note} or {error}.
    Existing tokens keep their type; a density token without a mode prefix changes the default density only, so the
    other densities keep their own values. New tokens go to the files of their group, in every context of a modifier,
    so names stay the same across modes (DTCG resolver rule). typ: the $type the caller already knows (a standard's
    mapping gives one); a new token takes it, else the type is inferred from the value and path. A standard's number
    and spring tokens (motion.scale.press 0.97, STD-mobile-touch-05) cannot be inferred, so they need it."""
    if typ is not None and typ not in DTCG_TYPES:
        return {"error": f"{typ!r} is not a DTCG token type; use one of {', '.join(sorted(DTCG_TYPES))}"}
    mode, path = split_mode_key(key)
    if mode and mode not in MODE_WORDS:
        return {"error": f"unknown mode {mode!r}; use one of {', '.join(MODE_WORDS)}"}
    parts = path.split(".")
    if not path or any(not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", q) for q in parts):
        return {"error": f"{path!r} is not a token path: use lowercase kebab-case segments, like size.row.md"}
    tokfiles = [fn for fn in files if fn.endswith(".tokens.json")]
    have = [fn for fn in tokfiles if isinstance(_node_at(files[fn], parts), dict) and "$value" in _node_at(files[fn], parts)]
    note = ""
    if have:
        typ = None
        for fn in have:
            node = _node_at(files[fn], parts)
            typ = node.get("$type") or _group_type(files[fn], parts) or typ
        targets = [fn for fn in have if (f".{mode}." in fn)] if mode else have
        if not mode and len(have) > 1 and all(".density." in fn for fn in have):
            targets = [fn for fn in have if f".{default_density}." in fn]
            note = (f"changed the {default_density} density only (the default); the other densities keep their values. "
                    f"Set one with a prefix, for example compact:{path}")
        if not targets:
            moded = sorted({fn.split(".")[-3] for fn in have if fn.count(".") >= 3})
            return {"error": f"{path} has no {mode} value: " + (f"its modes are {', '.join(moded)}" if moded else
                                                                 "it is the same in every mode, so set it without a prefix")}
        v = coerce_token_value(value, typ) if typ else value
        if v is None:
            return {"error": f"{path} is a {typ} token; {json.dumps(value)} is not a {typ} value" + (SHADOW_HINT if typ == "shadow" else "")}
        return {"files": targets, "values": {fn: v for fn in targets}, "type": typ, "new": False, "note": note, "path": path}
    typ = typ or infer_token_type(value, path)
    if isinstance(value, str) and value.startswith("{") and value.endswith("}"):
        tgt = value[1:-1]
        for fn in tokfiles:
            node = _node_at(files[fn], tgt.split("."))
            if isinstance(node, dict) and "$value" in node:
                typ = node.get("$type") or _group_type(files[fn], tgt.split("."))
                break
        else:
            return {"error": f"alias target {tgt} does not exist"}
    if not typ:
        return {"error": f"no token {path} yet, and the type of {json.dumps(value)} is unclear. Give a hex color, a size like 36 or "
                         "\"36px\", a duration like \"200ms\", or an alias like \"{space.16}\""}
    v = coerce_token_value(value, typ)
    if v is None:
        return {"error": f"{json.dumps(value)} is not a valid {typ} value" + (SHADOW_HINT if typ == "shadow" else "")}
    group_ctx = None
    if mode:
        group_ctx = MODE_WORDS[mode]
    elif parts[0] == "color" and not PRIMITIVE_RE.match(path + "."):
        group_ctx = "theme"
    elif re.match(r"(space\.(inset|stack|inline|section)|size\.control)\.", path):
        group_ctx = "density"
    elif parts[0] == "motion" and parts[1:2] == ["transition"]:
        group_ctx = "motion"
    if group_ctx:
        pat = {"theme": ".color.", "density": ".density.", "motion": "motion."}[group_ctx]
        targets = sorted(fn for fn in tokfiles if pat in fn and (group_ctx != "motion" or fn.startswith("motion.")))
        if group_ctx == "theme" and not targets:
            targets = sorted(fn for fn in tokfiles if fn.startswith("semantic.color."))
    else:
        targets = ["primitives.tokens.json" if PRIMITIVE_RE.match(path) else "semantic.tokens.json"]
    if not targets:
        return {"error": f"no token file takes {path}"}
    values = {fn: v for fn in targets}
    if mode and len(targets) > 1:
        note = f"new token: {mode} gets {json.dumps(value)}; the other {group_ctx} modes start with the same value (names match across modes)"
    return {"files": targets, "values": values, "type": typ, "new": True, "note": note or f"new {typ} token in {', '.join(targets)}",
            "path": path}


def std_token_types(state):
    """{override key: DTCG $type} from the engine mappings of the standards this system keeps records for (a house
    standard by the copy kept with its record, a project one by its own entry). A new token a standard adds keeps its
    type on every build, also after the person overrode the standard; a higher-ranked standard's type wins. The types kept
    when a standard was released or retired (standards.types) come last, so its token keeps exporting."""
    st = state.get("standards")
    kept = st.get("types") if isinstance(st, dict) and isinstance(st.get("types"), dict) else {}
    if not std_has_records(state):
        return {k: v for k, v in kept.items() if isinstance(v, str)}
    proj = st.get("project")
    project = {s.get("id"): s for s in proj if isinstance(s, dict)} if isinstance(proj, list) else {}
    out = {}
    for sid, rec in sorted(st["records"].items(), key=lambda kv: _std_rank(kv[0])):
        s = project.get(sid) or (rec.get("std") if isinstance(rec, dict) and isinstance(rec.get("std"), dict) else None)
        for eng in std_engine(s or {}):
            path, typ = eng.get("path"), eng.get("type")
            if isinstance(path, str) and path.strip() and isinstance(typ, str):
                sp = normalize_path(path.strip())
                if sp.startswith("overrides.") and not is_param_override(sp.split(".", 1)[1]):
                    out.setdefault(sp.split(".", 1)[1], typ)
    for k, v in kept.items():
        if isinstance(v, str):
            out.setdefault(k, v)
    return out


def apply_token_overrides(ctx, files, token_types=None):
    """Overrides whose key is not a lever parameter patch or add a token: 'path' or '<mode>:path' (light, dark, spacious,
    comfortable, compact, standard, reduced). Values are DTCG; new tokens carry source: person, or the standard that
    holds them. token_types: {key: $type} for values no standard record names yet (a standard's trial build); the
    standards' own mappings give the rest. A spring ({dampingRatio, stiffness}) is written the way build_motion writes
    motion.spring.spatial.*: a transition with the spring in $extensions."""
    applied = []
    ov = ctx.state.get("overrides") or {}
    default_density = ctx.params["space.densityMode"]
    held = std_held(ctx.state) if std_has_records(ctx.state) else {}
    sts = ctx.state.get("standards")
    untouched = sts.get("untouched") if isinstance(sts, dict) and isinstance(sts.get("untouched"), dict) else {}
    types = dict(std_token_types(ctx.state), **(token_types or {}))
    # unprefixed keys first, so a mode-prefixed value for the same token wins in its mode
    for key in sorted((k for k in ov if not is_param_override(k)), key=lambda k: (":" in k, k)):
        plan = override_plan(files, key, ov[key], default_density, types.get(key))
        if "error" in plan:
            ctx.notes.append(f"override {key} skipped: {plan['error']}")
            continue
        parts = plan["path"].split(".")
        for fn in plan["files"]:
            node = files[fn]
            for q in parts[:-1]:
                node = node.setdefault(q, {})
            leaf = node.get(parts[-1])
            sid = held.get("overrides." + key)
            freed = untouched.get("overrides." + key)
            src = {"source": "standard", "standard": sid} if sid else \
                {"source": "standard-overridden", "standard": freed} if freed else {"source": "person"}
            val, ext = copy.deepcopy(plan["values"][fn]), {}
            spring = spring_params(val) if plan["type"] == "transition" else None
            if spring:
                val, ext = spring_token(*spring, ctx.params["motion.easing.standard"])
            if isinstance(leaf, dict) and "$value" in leaf:
                leaf["$value"] = val
                leaf.setdefault("$extensions", {}).setdefault(NS, {}).update(ext, **src)
            else:
                node[parts[-1]] = {"$value": val, "$type": plan["type"],
                                   "$description": f"Added by standard {sid}." if sid else f"Added by standard {freed} (overridden)."
                                   if freed else "Added by a person (engine.py set).",
                                   "$extensions": {NS: dict(ext, **src)}}
            applied.append(f"{fn}:{plan['path']}")
    # a lever parameter a standard holds (motion.easing.standard) is a token too: it says which standard set it
    for key in (k for k in ov if is_param_override(k)):
        sid, freed = held.get("overrides." + key), untouched.get("overrides." + key)
        if not (sid or freed):
            continue
        for fn, tree in files.items():
            leaf = _node_at(tree, key.split(".")) if fn.endswith(".tokens.json") else None
            if isinstance(leaf, dict) and "$value" in leaf:
                leaf.setdefault("$extensions", {}).setdefault(NS, {}).update(
                    {"source": "standard", "standard": sid} if sid else {"source": "standard-overridden", "standard": freed})
    return applied


PRIMITIVE_RE = re.compile(r"^(color\.(white|black|brand|focus|neutral-alpha|neutral|accent|action|accent2|accent3|success|warning|danger|info)\."
                          r"|color\.(white|black)$|opacity\.|space\.\d+$|radius\.(\d+|full)$|font\.(size|line-height)\.|border\.width\.\d+$"
                          r"|motion\.(duration|easing|spring)\.|elevation\.shadow\.)")


def merge_trees(a, b):
    for k, v in b.items():
        if isinstance(v, dict) and isinstance(a.get(k), dict) and "$value" not in v:
            merge_trees(a[k], v)
        else:
            a[k] = copy.deepcopy(v)
    return a


def split_tree(tree, pred, prefix=""):
    """Split a DTCG tree into (matching, rest) by token path; group $-keys go to whichever side has children."""
    yes, no = {}, {}
    meta = {k: v for k, v in tree.items() if k.startswith("$")}
    for k, v in tree.items():
        if k.startswith("$"):
            continue
        path = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict) and "$value" in v:
            (yes if pred(path) else no)[k] = v
        elif isinstance(v, dict):
            y, n = split_tree(v, pred, path)
            if y:
                yes[k] = y
            if n:
                no[k] = n
    if yes:
        yes = dict(meta, **yes)
    if no:
        no = dict(meta, **no)
    return yes, no


def page_limits(ctx):
    """What one page built from the system may use (levers formulas.type.pageLimits), with the values themselves, so a
    review can count a page against them: sizes, weights, families, tracking per job, text greys, accents, corners,
    one container and one filled call to action per view."""
    lim = levers()["formulas"]["type"]["pageLimits"]
    t, shp, lay = ctx.type_info, ctx.shape_info, ctx.space_info.get("layout") or {}
    faces = t.get("faces") or {}
    fams = [f.get("face") for k, f in faces.items() if k in ("text", "display") and f.get("face") and f.get("face") != "=textFace"]
    out = {"_about": "Caps for one page. opendesigner-review counts a built page against them; the values are the tokens.",
           "sizes": {"max": lim["sizes"], "scale": t["sizes"], "fluid": t.get("fluid") or {}},
           "weights": {"max": lim["weights"], "values": sorted(set(t["weights"].values()))},
           "families": {"max": lim["families"], "values": list(dict.fromkeys(fams)) or ["system"], "note": "a code face only where code is shown"},
           "tracking": dict(t.get("tracking") or {}, capsNeverNegative=True),
           "textGreys": {"max": lim["textGreys"], "tokens": ["color.text.primary", "color.text.secondary", "color.text.disabled"]},
           "accents": {"max": max(lim["accents"], int(ctx.cinfo.get("accentCount") or 1))},
           "filledPrimaryPerView": lim["primaryPerView"],
           "radius": {k: ("full" if isinstance(shp.get(k), (int, float)) and shp[k] >= FULL else shp.get(k))
                      for k in ("control", "container", "overlay", "detail")},
           "ctaShape": shp.get("ctaShape"),
           "containers": {"max": lim["containers"], "width": lay.get("container")},
           "alignment": lay.get("alignment"), "heroMaxLines": lim["heroMaxLines"], "evidence": lim["evidence"]}
    if ctx.raw.get("marketingSurfaces"):
        out["cta"] = {"height": [48, 56], "labelStyle": "text.label.cta" if "label.cta" in t["styles"] else "text.label.lg",
                      "labelMinPx": 15, "case": "sentence"}
    return out


def generate_system(state, token_types=None):
    """Files follow the spec's tiering (7.4): primitives, semantic, semantic.color.<theme>, semantic.density.<mode>,
    motion.<standard|reduced>, plus the resolver and a meta file. token_types: see apply_token_overrides."""
    ctx = Ctx(state)
    files = {}
    prim, opacity = build_color_primitives(ctx)
    foundation = {}
    for tree in (prim, opacity, build_typography(ctx), build_space_foundation(ctx)):
        merge_trees(foundation, tree)
    dens = {dname: build_space_density(ctx, dname) for dname in DENSITIES}
    for tree in (build_shape(ctx), build_elevation(ctx), build_texture(ctx), build_motion(ctx)):
        merge_trees(foundation, tree)
    p_tree, s_tree = split_tree(foundation, lambda path: bool(PRIMITIVE_RE.match(path)))
    for t in (p_tree, s_tree):
        t["$extensions"] = {NS: {"source": "formula", "note": "Every value comes from references/levers.json formulas at the dials "
                                 "recorded in opendesigner.meta.json; tokens a person detached carry source: person."}}
    files["primitives.tokens.json"] = p_tree
    files["semantic.tokens.json"] = s_tree
    for m in ctx.modes:
        files[f"semantic.color.{m}.tokens.json"] = build_color_semantic(ctx, m)
    for dname in DENSITIES:
        files[f"semantic.density.{dname}.tokens.json"] = dens[dname]
    for c in ("standard", "reduced"):
        files[f"motion.{c}.tokens.json"] = build_motion_context(ctx, c)
    applied = apply_token_overrides(ctx, files, token_types)
    files["opendesigner.resolver.json"] = build_resolver(ctx, list(files))
    ramps = {}
    for (name, mode), r in sorted(ctx.ramps.items()):
        ramps.setdefault(name, {})[mode] = {"hex": r.hexes(), "textOnSolid": r.text_on_solid,
                                            "oklch": [[rnd(r.steps[i]["L"], 3), rnd(r.steps[i]["C"], 3)] for i in range(1, 13)]}
    meta = {
        "engine": ENGINE_VERSION, "name": ctx.state.get("name"), "prefix": ctx.state["exports"].get("prefix", "ds"),
        "dials": ctx.dials, "dialSources": ctx.dial_src, "macroConflicts": ctx.conflicts,
        "preset": effective_preset(ctx.state)[0], "presetIsDefault": effective_preset(ctx.state)[1], "macros": ctx.state.get("macros"),
        "style": (effective_style(ctx.state) or {}).get("id"), "look": dict(ctx.look, gradient=ctx.gradients()),
        "params": {k: {"value": ctx.params[k], **ctx.pmeta.get(k, {})} for k in sorted(ctx.params)},
        "color": ctx.cinfo, "ramps": ramps, "modes": ctx.modes,
        "type": ctx.type_info, "space": ctx.space_info, "density": ctx.density_info, "shape": ctx.shape_info,
        "elevation": ctx.elev_info, "motion": ctx.motion_info,
        "contrastPairs": contrast_pairs(ctx), "tokenOverrides": applied,
        "platforms": ctx.raw.get("platforms"), "inputs": ctx.raw.get("inputs"),
        "textScaling": ctx.raw.get("textScaling") or "full", "notes": ctx.notes,
    }
    meta["limits"] = page_limits(ctx)
    meta["stateHash"] = state_hash(state)
    meta["profile"] = profile_record(ctx.profile)
    files["opendesigner.meta.json"] = meta
    return files, meta, ctx


# =============================================================================================
# DTCG reading: flatten, resolve aliases, permutations (used by validate and every exporter)
# =============================================================================================

DTCG_TYPES = {"color", "dimension", "fontFamily", "fontWeight", "duration", "cubicBezier", "number", "strokeStyle",
              "border", "transition", "shadow", "gradient", "typography"}


def flatten(node, prefix="", inherited=None, out=None, problems=None):
    out = {} if out is None else out
    t = node.get("$type", inherited) if isinstance(node, dict) else inherited
    if isinstance(node, dict) and "$value" in node:
        out[prefix] = {"$value": node["$value"], "$type": t, "$description": node.get("$description", ""),
                       "$extensions": node.get("$extensions", {})}
        return out
    if not isinstance(node, dict):
        return out
    for k, v in node.items():
        if k.startswith("$"):
            continue
        if problems is not None and ("." in k or "{" in k or "}" in k):
            problems.append(f"{prefix}.{k}: token and group names must not contain '.', '{{' or '}}' (DTCG 2025.10)")
        if isinstance(v, dict):
            flatten(v, f"{prefix}.{k}" if prefix else k, t, out, problems)
    return out


def load_token_dir(tokdir):
    files = {}
    for fn in sorted(os.listdir(tokdir)):
        if fn.endswith(".json"):
            files[fn] = read_json(os.path.join(tokdir, fn))
    return files


def resolver_contexts(res):
    mods = res.get("modifiers", {})
    return {name: list(m["contexts"]) for name, m in mods.items()}


def sources_for(res, choice):
    out = []
    for entry in res["resolutionOrder"]:
        ref = entry["$ref"]
        _, kind, name = ref.split("/")
        if kind == "sets":
            out += [s["$ref"] for s in res["sets"][name]["sources"]]
        else:
            m = res["modifiers"][name]
            ctxn = choice.get(name) or m.get("default")
            out += [s["$ref"] for s in m["contexts"][ctxn]]
    return out


def deep_resolve(value, flat, trail):
    if isinstance(value, str) and value.startswith("{") and value.endswith("}"):
        path = value[1:-1]
        if path in trail:
            raise ValueError("alias cycle: " + " -> ".join(trail + [path]))
        if path not in flat:
            raise KeyError(f"alias target missing: {path} (from {trail[0]})")
        return deep_resolve(flat[path]["$value"], flat, trail + [path])
    if isinstance(value, dict) and "colorSpace" not in value:
        return {k: deep_resolve(v, flat, trail) for k, v in value.items()}
    if isinstance(value, list):
        return [deep_resolve(v, flat, trail) for v in value]
    return value


def resolve_type(path, flat, seen=None):
    t = flat[path]["$type"]
    if t:
        return t
    v = flat[path]["$value"]
    if isinstance(v, str) and v.startswith("{"):
        seen = seen or set()
        if path in seen:
            return None
        seen.add(path)
        tgt = v[1:-1]
        return resolve_type(tgt, flat, seen) if tgt in flat else None
    return None


def resolve_all(files, choice):
    res = files["opendesigner.resolver.json"]
    flat = {}
    for src in sources_for(res, choice):
        flatten(files[src], "", None, flat)
    out = {}
    for path, t in flat.items():
        out[path] = dict(t, resolved=deep_resolve(t["$value"], flat, [path]), type=resolve_type(path, flat))
    return out


def all_choices(res):
    ctxs = resolver_contexts(res)
    names = list(ctxs)
    combos = [{}]
    for n in names:
        combos = [dict(c, **{n: v}) for c in combos for v in ctxs[n]]
    return combos


def hex_of(v):
    """Hex of a resolved DTCG color value (alpha ignored)."""
    if isinstance(v, dict) and v.get("hex"):
        return v["hex"]
    if isinstance(v, dict) and v.get("colorSpace") == "oklch":
        return oklch_to_hex(*v["components"])
    if isinstance(v, dict) and v.get("colorSpace") == "srgb":
        return "#" + "".join(f"{round_half_up(c * 255):02x}" for c in v["components"])
    raise ValueError(f"not a color: {v}")


# =============================================================================================
# Validate
# =============================================================================================

COLOR_SPACES = {"srgb", "srgb-linear", "hsl", "hwb", "lab", "lch", "oklab", "oklch", "display-p3", "a98-rgb",
                "prophoto-rgb", "rec2020", "xyz-d65", "xyz-d50"}
WEIGHT_NAMES = {"thin", "hairline", "extra-light", "ultra-light", "light", "normal", "regular", "book", "medium", "semi-bold",
                "demi-bold", "bold", "extra-bold", "ultra-bold", "black", "heavy", "extra-black", "ultra-black"}
FIGMA_MODE_LIMITS = {"starter": 1, "professional": 10, "organization": 20, "enterprise": 40}


class Report:
    def __init__(self):
        self.items = []
        self.stats = {}

    SEV = {"error": "error", "warning": "warn", "warn": "warn", "advisory": "info", "info": "info"}

    def add(self, level, check, message, rule="", source="", where="", measured=None, threshold=None, fix=""):
        """One finding in the spec 6.6 shape: {rule, severity, where, measured, threshold, evidence, fix}."""
        self.items.append({"severity": self.SEV[level], "category": check, "rule": rule, "where": where, "measured": measured,
                           "threshold": threshold, "evidence": source, "fix": fix, "message": message})

    def count(self, level):
        sev = self.SEV[level]
        return sum(1 for i in self.items if i["severity"] == sev)


GEN_KEYS = ("name", "dials", "preset", "style", "customStyles", "macros", "raw", "overrides", "exports")


def state_hash(state):
    """Hash of the state keys that change tokens (answers, hooks, hashes and notes do not)."""
    import hashlib
    core = {k: state.get(k) for k in GEN_KEYS if k not in ("style", "customStyles") or state.get(k)}  # unused: the hash from before styles
    core["dials"] = {k: dial_value(v) for k, v in (core.get("dials") or {}).items()}
    return hashlib.sha256(json.dumps(core, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]


def _check_value(t, v, path, rep):
    """DTCG 2025.10 value-shape checks on a resolved value."""
    def bad(msg):
        rep.add("error", "dtcg", f"{path}: {msg}", "DTCG 2025.10 Format, $type table", "S-L07-002 (L07 A3)", path)
    if t == "color":
        if not isinstance(v, dict) or v.get("colorSpace") not in COLOR_SPACES:
            return bad("color must be an object with a known colorSpace")
        comps = v.get("components")
        if not (isinstance(comps, list) and len(comps) == 3 and all(isinstance(c, (int, float)) or c == "none" for c in comps)):
            return bad("color components must be three numbers (or 'none')")
        if "alpha" in v and not (0 <= v["alpha"] <= 1):
            bad("alpha must be 0-1")
        if "hex" in v and not re.fullmatch(r"#[0-9a-fA-F]{6}", v["hex"]):
            bad("hex fallback must be #rrggbb")
        if v["colorSpace"] == "oklch" and "hex" in v:
            want = hex_to_rgb8(oklch_to_hex(*[0 if c == "none" else c for c in comps]))
            got = hex_to_rgb8(v["hex"])
            if max(abs(a - b) for a, b in zip(want, got)) > 1:
                bad(f"hex fallback {v['hex']} does not match its OKLCH components")
    elif t == "dimension":
        if not (isinstance(v, dict) and isinstance(v.get("value"), (int, float)) and v.get("unit") in ("px", "rem")):
            bad("dimension must be {value, unit: px|rem}")
    elif t == "duration":
        if not (isinstance(v, dict) and isinstance(v.get("value"), (int, float)) and v.get("unit") in ("ms", "s")):
            bad("duration must be {value, unit: ms|s}")
    elif t == "cubicBezier":
        if not (isinstance(v, list) and len(v) == 4 and all(isinstance(x, (int, float)) for x in v) and 0 <= v[0] <= 1 and 0 <= v[2] <= 1):
            bad("cubicBezier must be [x1, y1, x2, y2] with x in [0, 1]")
    elif t == "fontWeight":
        if not ((isinstance(v, (int, float)) and 1 <= v <= 1000) or v in WEIGHT_NAMES):
            bad("fontWeight must be 1-1000 or a named weight")
    elif t == "fontFamily":
        if not (isinstance(v, str) or (isinstance(v, list) and v and all(isinstance(x, str) for x in v))):
            bad("fontFamily must be a string or a list of strings")
    elif t == "number":
        if not isinstance(v, (int, float)):
            bad("number must be a JSON number")
    elif t == "typography":
        need = {"fontFamily", "fontSize", "fontWeight", "letterSpacing", "lineHeight"}
        if not (isinstance(v, dict) and need <= set(v)):
            return bad("typography needs fontFamily, fontSize, fontWeight, letterSpacing, lineHeight")
        _check_value("dimension", v["fontSize"], path + ".fontSize", rep)
        _check_value("number", v["lineHeight"], path + ".lineHeight", rep)
    elif t == "shadow":
        layers = v if isinstance(v, list) else [v]
        for lay in layers:
            if not (isinstance(lay, dict) and {"color", "offsetX", "offsetY", "blur", "spread"} <= set(lay)):
                return bad("shadow layers need color, offsetX, offsetY, blur, spread")
            _check_value("color", lay["color"], path + ".color", rep)  # a bare "#fff" string here once crashed every export
            for k in ("offsetX", "offsetY", "blur", "spread"):
                _check_value("dimension", lay[k], f"{path}.{k}", rep)
    elif t == "gradient":
        if not (isinstance(v, list) and len(v) >= 2 and all(isinstance(s, dict) and {"color", "position"} <= set(s) for s in v)):
            return bad("gradient must be a list of at least two stops, each with color and position")
        for s in v:
            _check_value("color", s["color"], path + ".color", rep)
            if not (isinstance(s["position"], (int, float)) and 0 <= s["position"] <= 1):
                bad("gradient stop position must be a number from 0 to 1")
    elif t == "transition":
        if not (isinstance(v, dict) and {"duration", "delay", "timingFunction"} <= set(v)):
            bad("transition needs duration, delay, timingFunction")
    elif t not in DTCG_TYPES:
        bad(f"unknown $type {t!r}")


def _px(v):
    return v["value"] if v.get("unit") == "px" else v["value"] * 16


def pair_hexes(toks, pr):
    """The two colours of a contrast pair as people see them: a see-through background over the worst content behind it,
    a see-through foreground over its background. validate and the palette preview both measure through this."""
    bgv = toks[pr["bg"]]["resolved"]
    bg = hex_of(bgv)
    if pr.get("behind") and isinstance(bgv, dict) and bgv.get("alpha") is not None:
        bg = composite(bg, bgv["alpha"], pr["behind"])
    fgv = toks[pr["fg"]]["resolved"]
    fg = hex_of(fgv)
    if isinstance(fgv, dict) and fgv.get("alpha") is not None:
        fg = composite(fg, fgv["alpha"], bg)
    return fg, bg


def validate_files(files, state, rep):
    meta = files.get("opendesigner.meta.json") or {}
    res = files.get("opendesigner.resolver.json")
    if not res:
        rep.add("error", "dtcg", "tokens/opendesigner.resolver.json is missing; run generate", "DTCG Resolver 2025.10", "S-L07-004")
        return
    # ---- resolver structure
    if res.get("version") != "2025.10":
        rep.add("error", "dtcg", "resolver version must be \"2025.10\"", "DTCG Resolver 2025.10", "S-L07-004")
    for entry in res.get("resolutionOrder", []):
        ref = entry.get("$ref", "")
        parts = ref.split("/")
        if len(parts) != 3 or parts[1] not in ("sets", "modifiers") or parts[2] not in res.get(parts[1], {}):
            rep.add("error", "dtcg", f"resolutionOrder entry {ref} does not point at a set or modifier", "DTCG Resolver 2025.10", "S-L07-004")
    for name, m in res.get("modifiers", {}).items():
        if not m.get("contexts"):
            rep.add("error", "dtcg", f"modifier {name} has no contexts", "DTCG Resolver 2025.10", "S-L07-004")
        elif len(m["contexts"]) < 2:
            rep.add("warning", "dtcg", f"modifier {name} has one context; the spec says SHOULD have two or more", "DTCG Resolver 2025.10", "S-L07-004")
        if m.get("default") not in m.get("contexts", {}):
            rep.add("error", "dtcg", f"modifier {name} default {m.get('default')!r} is not one of its contexts", "DTCG Resolver 2025.10", "S-L07-004")
        for cname, srcs in m.get("contexts", {}).items():
            for s in srcs:
                if s["$ref"] not in files:
                    rep.add("error", "dtcg", f"{name}/{cname} source {s['$ref']} is missing", "DTCG Resolver 2025.10", "S-L07-004")
    for sname, sset in res.get("sets", {}).items():
        for s in sset.get("sources", []):
            if s["$ref"] not in files:
                rep.add("error", "dtcg", f"set {sname} source {s['$ref']} is missing", "DTCG Resolver 2025.10", "S-L07-004")
    if rep.count("error"):
        return
    # ---- names, types, value shapes (per file)
    problems = []
    for fn, tree in files.items():
        if fn.endswith(".tokens.json"):
            flatten(tree, "", None, {}, problems)
    for pmsg in problems:
        rep.add("error", "dtcg", pmsg, "DTCG 2025.10 names", "S-L07-002")
    # ---- orthogonal modifiers and consistent names across contexts
    for name, m in res.get("modifiers", {}).items():
        sets_ = []
        for cname, srcs in m["contexts"].items():
            paths = set()
            for s in srcs:
                paths |= set(flatten(files[s["$ref"]]))
            sets_.append((cname, paths))
        base_c, base_p = sets_[0]
        for cname, paths in sets_[1:]:
            diff = base_p ^ paths
            if diff:
                rep.add("error", "dtcg", f"modifier {name}: contexts {base_c} and {cname} define different tokens ({sorted(diff)[:4]}...)",
                        "Names never change across modes; only values do", "DC-L01-18, S-L07-112")
    mod_paths = {}
    for name, m in res.get("modifiers", {}).items():
        for srcs in m["contexts"].values():
            for s in srcs:
                for pth in flatten(files[s["$ref"]]):
                    mod_paths.setdefault(pth, set()).add(name)
    for pth, owners in mod_paths.items():
        if len(owners) > 1:
            rep.add("error", "dtcg", f"{pth} is set by more than one modifier ({', '.join(sorted(owners))})",
                    "Resolver modifiers should be orthogonal", "S-L07-004")
    # ---- every permutation resolves
    choices = all_choices(res)
    resolved = {}
    for ch in choices:
        try:
            resolved[tuple(sorted(ch.items()))] = resolve_all(files, ch)
        except (KeyError, ValueError) as ex:
            rep.add("error", "dtcg", f"permutation {ch}: {ex}", "Aliases must resolve without cycles", "S-L07-002")
    rep.stats["permutations"] = len(choices)
    if rep.count("error"):
        return
    first = next(iter(resolved.values()))
    rep.stats["tokens"] = len(first)
    for key, toks in resolved.items():
        for pth, t in toks.items():
            if not t["type"]:
                rep.add("error", "dtcg", f"{pth}: no $type on the token, its groups or its alias target", "DTCG 2025.10 $type", "S-L07-002")
            else:
                _check_value(t["type"], t["resolved"], pth, rep)
        break  # value shapes do not change across permutations except values; one pass is enough
    for key, toks in list(resolved.items())[1:]:
        for pth, t in toks.items():
            if t["type"] in ("color", "dimension", "duration"):
                _check_value(t["type"], t["resolved"], pth, rep)

    def pick(**kw):
        for key, toks in resolved.items():
            d = dict(key)
            if all(d.get(k, v) == v for k, v in kw.items()):
                return toks
        return first
    modes = meta.get("modes") or (list(res["modifiers"]["theme"]["contexts"]) if "theme" in res.get("modifiers", {}) else ["light"])
    dials = meta.get("dials", {})
    params = {k: v.get("value") for k, v in meta.get("params", {}).items()}

    # ---- contrast (WCAG 2.2, no rounding)
    lows, n_pairs = {}, 0
    for pr in meta.get("contrastPairs", []):
        toks = pick(theme=pr["mode"])
        if pr["fg"] not in toks or pr["bg"] not in toks:
            rep.add("error", "contrast", f"{pr['mode']}: pair {pr['fg']} on {pr['bg']} names a missing token", pr["rule"], "DC-L01-22")
            continue
        fg, bg = pair_hexes(toks, pr)  # a see-through surface is measured over the worst content behind it
        ratio = contrast(fg, bg)
        n_pairs += 1
        ok = ratio >= pr["min"]
        if not ok and pr.get("inner") and pr["inner"] in toks:
            inner = hex_of(toks[pr["inner"]]["resolved"])
            ok = contrast(inner, bg) >= 3.0 and contrast(inner, fg) >= 3.0  # two-tone ring (L09 M12 pattern)
            if ok:
                rep.add("advisory", "contrast", f"{pr['mode']}: focus color is {ratio:.2f}:1 on {pr['bg']}; the two-tone inner ring carries 3:1",
                        pr["rule"], "DC-L04-09")
        key = (pr["mode"], pr["kind"])
        if key not in lows or ratio < lows[key][0]:
            lows[key] = (ratio, pr["fg"], pr["bg"])
        if not ok:
            lvl = "warning" if pr.get("level") == "warning" else "error"
            rep.add(lvl, "contrast", f"{pr['mode']}: {pr['fg']} ({fg}) on {pr['bg']} ({bg}) is {ratio:.2f}:1, needs {pr['min']}:1",
                    pr["rule"], "DC-L01-22, S-L01-022, S-L01-023", f"{pr['mode']}:{pr['fg']} on {pr['bg']}",
                    measured=rnd(ratio, 3), threshold=pr["min"],
                    fix="Point the role at a step further from the background: steps 11-12 for text, 8 or higher for edges. "
                        "Or remove the override that detached it. Generated steps always pass.")
    rep.stats["contrastPairs"] = n_pairs
    rep.stats["lowest"] = {f"{m} {k}": f"{r:.2f}:1 ({fg} on {bg})" for (m, k), (r, fg, bg) in sorted(lows.items())}
    for mode in modes:
        toks = pick(theme=mode)
        for fg, need in (("color.text.primary", 75), ("color.text.secondary", 60)):
            for bg in ("color.surface.base", "color.surface.raised"):
                if fg in toks and bg in toks:
                    lc = abs(apca_lc(hex_of(toks[fg]["resolved"]), hex_of(toks[bg]["resolved"])))
                    if lc < need:
                        rep.add("advisory", "apca", f"in {mode} mode, {words_of(fg)} on the {words_of(bg)} scores Lc {lc:.0f} on APCA, a newer reading-contrast score. {need} or more is advised",
                                "APCA advisory only; WCAG 3 contrast is undetermined", "S-L01-026, S-L01-021")

    # ---- visible states (U5 F24): hover and pressed must differ from their solid fill
    n_states = 0
    for mode in modes:
        toks = pick(theme=mode)
        for base_ in sorted(k for k in toks if re.fullmatch(r"color\.bg\.[a-z0-9-]+\.(bold|primary)", k)):
            for st, need in (("hover", STATE_MIN["hover"]), ("pressed", STATE_MIN["pressed"])):
                sp_ = f"{base_}-{st}"
                if sp_ not in toks:
                    continue
                n_states += 1
                bh, sh = hex_of(toks[base_]["resolved"]), hex_of(toks[sp_]["resolved"])
                ratio = contrast(sh, bh)
                if ratio < need - 0.005:
                    rep.add("warning", "states", f"in {mode} mode, {words_of(sp_)} ({sh}) is only {ratio:.2f}:1 from {words_of(base_)} ({bh}); "
                            f"people may not see the {st} state. {need}:1 or more is needed", "Visible states", "DC-L01-17",
                            f"{mode}:{sp_}", measured=rnd(ratio, 3), threshold=need,
                            fix="Remove the override on this state, or point it at a step further from the fill.")
    rep.stats["statePairs"] = n_states
    # ---- font licences (U5 F21): a brand face outside its licence is never shipped silently
    faces = (meta.get("type") or {}).get("faces") or {}
    plats_ = set(state.get("raw", {}).get("platforms") or [])
    for role, f in faces.items():
        if not f or f.get("open") or f.get("face") in (None, "=textFace"):
            continue
        if f.get("web") is False or f.get("app") is False:
            rep.add("advisory", "licence", f"{f.get('note')}.", "Font licence scope", "Q-type-02, hooks H-type")
        apps = plats_ & {"ios", "android", "desktop", "macos", "windows", "ipados"}
        if apps and f.get("app") is None:
            rep.add("warning", "licence", f"the {role} font {f['face']} has no recorded app licence, but the product ships on "
                    f"{', '.join(sorted(apps))}. The Swift and Compose files use the system font until you record it: "
                    "engine.py set raw.fontLicence '{\"web\": true, \"app\": true}'", "Font licence scope", "Q-type-02, hooks H-type")

    # ---- targets (L14 device floors; density never shrinks hit areas)
    toks = first
    plats = set(meta.get("platforms") or state.get("raw", {}).get("platforms") or ["web"])
    tg = {k.split(".")[-1]: _px(v["resolved"]) for k, v in toks.items() if k.startswith("size.target.")}
    if "min" not in tg:
        rep.add("error", "targets", "size.target.min is missing", "Minimum target size (WCAG 2.2 SC 2.5.8)", "DC-L03-12, L14 I-1")
    floors = {"pointer": (24, "WCAG 2.2 SC 2.5.8 (24x24 CSS px)", "S-L03-035"),
              "touch": (48 if "android" in plats else 44, "Apple 44pt / Material 48dp", "S-L03-033, S-L03-029"),
              "remote": (66, "tvOS 66pt", "S-L14-012"), "gaze": (60, "visionOS 60pt", "S-L14-012"),
              "vehicle": (76, "Design for Driving 76dp", "S-L14-037")}
    for k, (floor, rule, src) in floors.items():
        if k in tg and tg[k] < floor:
            rep.add("error", "targets", f"size.target.{k} is {tg[k]:g}px, below the {floor}px minimum", rule, f"DC-L14-03, {src}",
                    f"size.target.{k}", measured=tg[k], threshold=floor, fix=f"Set size.target.{k} to at least {floor}px.")
    for key, t2 in resolved.items():
        for k, v in t2.items():
            if k.startswith("size.target.") and _px(v["resolved"]) != tg.get(k.split(".")[-1]):
                rep.add("error", "targets", f"{k} changes with {dict(key)}. Density must never change tap areas", "L14 I-1", "DC-L03-11")
                break
    ctl_min = min(_px(t2[k]["resolved"]) for t2 in resolved.values() for k in t2 if k.startswith("size.control."))
    if ctl_min < 24 and tg.get("min", 0) < 24:
        rep.add("error", "targets", f"the smallest control is {ctl_min:g}px, and there is no 24px tap-area token", "target < 24x24 CSS px (lint error)", "L13-E1-level2, S-L03-035")
    elif tg.get("min") and ctl_min < tg["min"]:
        rep.add("advisory", "targets", f"the smallest control is {ctl_min:g}px tall. Give it a {tg['min']:g}px {term('hit area')} with padding "
                "(size.target.min), never a smaller one", "L14 I-1", "DC-L03-12, S-L03-029")
    rep.stats["targets"] = tg

    # ---- lint: type
    sizes = sorted({_px(v["resolved"]) for k, v in toks.items() if k.startswith("font.size.")})
    rep.stats["typeSizes"] = sizes
    if len(sizes) > 10:
        rep.add("warning", "lint", f"{len(sizes)} text sizes; 8 to 10 is the usual range", "Type scale size count", "DC-L02-10")
    if sizes and sizes[0] < 11:
        rep.add("warning", "lint", f"the smallest text size, {sizes[0]:g}px, is under 11px", "Minimum legible size 11pt/sp", "S-L02-001, S-L02-005")
    halves = [x for x in sizes if x != int(x)]
    if halves:  # a private B2B landing page had 20 sizes at 18px and below in half-pixel steps (2026-11-05)
        rep.add("warning", "lint", f"font sizes between whole pixels: {', '.join(f'{x:g}px' for x in halves)}. Use whole px",
                "Whole-pixel type sizes", "DC-L02-09")
    for k, v in toks.items():  # capitals never take negative tracking (levers formulas.type.tracking.jobs, STD-visual-details-04)
        ext = (v.get("$extensions") or {}).get(NS) or {}
        caps = (k.startswith("text.") and ext.get("textTransform") == "uppercase") or k in ("font.tracking.caps-label", "font.tracking.caps-display")
        em = ext.get("letterSpacingEm") if k.startswith("text.") else v.get("resolved")
        if caps and isinstance(em, (int, float)) and em < 0:
            rep.add("error", "lint", f"{k} sets capitals with negative tracking ({em:g}em); capitals take 0 to +0.08em",
                    "Capitals never take negative tracking", "STD-visual-details-04, S-L02-021", k)
    styles = {k: v["resolved"] for k, v in toks.items() if k.startswith("text.") and not k.startswith(("text.emphasized.", "text.numeric."))
              and v["type"] == "typography"}  # emphasized and numeric variants pair with a baseline style; they are not extra levels
    if len(styles) > 15:
        rep.add("warning", "lint", f"{len(styles)} text styles; 12 to 15 is the usual range", "Type style count", "DC-L02-10")
    body_weights = {v["fontWeight"] for k, v in styles.items() if not k.startswith("text.display")}
    if len(body_weights) > 3:
        rep.add("warning", "lint", f"{len(body_weights)} font weights outside display styles ({sorted(body_weights)}). Only two or three look different",
                "Hierarchy tiers: weights 2-3", "L15-P03, S-L15-038")
    heads = sorted(((_px(v["fontSize"]), v["fontWeight"], k) for k, v in styles.items()
                    if k.split(".")[1] in ("title", "headline", "display")), key=lambda x: (x[0], x[1]))
    for (s1, w1, k1), (s2, w2, k2) in zip(heads, heads[1:]):
        if s2 / s1 - 1 < 0.1 and abs(w2 - w1) < 200 and not (s1 == s2 and w1 == w2):
            rep.add("warning", "lint", f"{k1} ({s1:g}px/{w1}) and {k2} ({s2:g}px/{w2}) look almost the same: under 10% apart in size and under 200 in weight",
                    "Adjacent hierarchy levels must differ visibly", "DC-L15-02 (200 [inferred])")
    text_tiers = {json.dumps(toks[k]["resolved"], sort_keys=True) for k in toks
                  if re.fullmatch(r"color\.text\.(primary|secondary|tertiary|quaternary|muted|subtle|disabled)", k)}
    if len(text_tiers) > 3:
        rep.add("warning", "lint", f"{len(text_tiers)} gray text colors; three (primary, secondary, disabled) is the most that stay distinct",
                "Hierarchy tiers: 3 text colors", "L15-P04, S-L15-038")

    # ---- lint: motion
    if "motion" not in res.get("modifiers", {}) or "reduced" not in res["modifiers"]["motion"]["contexts"]:
        rep.add("error", "lint", "no reduced-motion mode", "Reduced motion as a token mode (WCAG 2.3.3 treated as required)", "DC-L04-25, L14-I-13")
    else:
        red = pick(motion="reduced")
        mv = red.get("motion.transition.move")
        if not mv or mv["resolved"]["duration"]["value"] != 0:
            rep.add("error", "lint", "reduced motion still moves things: motion.transition.move must be 0ms in the reduced context",
                    "Reduced motion: travel to opacity, travel durations 0", "DC-L04-25, S-L09-458")
    std = pick(motion="standard")
    for k, v in std.items():
        if k.startswith("motion.transition."):
            dms = v["resolved"]["duration"]["value"] * (1000 if v["resolved"]["duration"]["unit"] == "s" else 1)
            if isinstance(v.get("$value"), str) and v["$value"].startswith("{motion.spring."):
                continue  # a spring is judged by its response, not by the settle time of its linear() sample (STD-springs-gestures)
            if dms > 500:
                rep.add("warning", "lint", f"{k} takes {dms}ms. Over 500ms feels slow", "transition-over 500ms", "L13-E1 [inferred link]")
            elif dms > 400:
                rep.add("advisory", "lint", f"{k} takes {dms}ms. Changes feel instant only up to 400ms", "Doherty threshold 400ms", "L13-B5, DC-L04-20")
    macros = [m if isinstance(m, str) else m.get("id") for m in (meta.get("macros") or [])]
    for k, v in toks.items():
        if k.startswith("motion.spring.") and v["type"] == "transition":
            sp = (v.get("$extensions") or {}).get(NS, {}).get("spring")
            if sp and 1 - sp["dampingRatio"] > 0.2 and "playful" not in macros:
                rep.add("warning", "lint", f"{k} bounces {1 - sp['dampingRatio']:.2f}, over 0.2, but the playful feel is not chosen",
                        "Bounce cap", "DC-L04-19")
    # ---- lint: focus
    if "color.border.focus" not in toks or "focus.ring.width" not in toks:
        rep.add("error", "lint", "the focus outline tokens are missing (color.border.focus, focus.ring.width)", "Visible focus (WCAG 2.4.7, 2.4.13)", "DC-L04-09")
    elif _px(toks["focus.ring.width"]["resolved"]) < 2:
        rep.add("error", "lint", "the focus ring is thinner than 2px", "Focus ring 2px + 2px offset", "DC-L04-09, L14-I-5")
    # ---- lint: shape
    rc = toks.get("radius.control")
    rcont = toks.get("radius.container")
    if rc and rcont:
        a_, b_ = _px(rc["resolved"]), _px(rcont["resolved"])
        if a_ == b_ and 0 < a_ < FULL:
            rep.add("warning", "lint", f"radius.control and radius.container are both {a_:g}px; nested corners will look uneven", "Equal nested radii read as uneven", "DC-L04-05")
        nst = toks.get("radius.nested")
        if nst and b_ > 0 and _px(nst["resolved"]) >= b_:
            rep.add("error", "lint", "radius.nested is not smaller than radius.container", "Nested radius = outer - padding", "DC-L04-05, S-L04-057")
    # ---- lint: materials
    if any(k == "color.surface.glass" for k in toks) and "color.surface.glass-fallback" not in toks:
        rep.add("error", "lint", "a glass surface has no solid fallback for people who turn off transparency", "Materials emit a solid twin (Reduce Transparency)", "DC-L04-16")
    # ---- lint: spacing (inner < outer, per density)
    if "density" in res.get("modifiers", {}):
        for dname in res["modifiers"]["density"]["contexts"]:
            t2 = pick(density=dname)
            inner = _px(t2["space.stack.md"]["resolved"])
            outer = _px(t2["space.section.sm"]["resolved"])
            if not (inner < outer and inner <= outer / 2):
                rep.add("error", "lint", f"{dname}: the inner gap ({inner:g}px) must be at most half the outer gap ({outer:g}px)",
                        "Proximity: inner <= half the outer gap", "L15-P16, DC-L03-24")
    ladder = {_px(v["resolved"]) for k, v in toks.items() if re.fullmatch(r"space\.\d+", k)}
    for k, v in toks.items():
        if re.match(r"space\.(inset|stack|inline|section)\.", k) and _px(v["resolved"]) not in ladder:
            rep.add("warning", "lint", f"{k} = {_px(v['resolved']):g}px is not on the spacing scale", "Spacing on scale", "DC-L03-02")
    # ---- lint: dial combinations
    if dials:
        if dials.get("expression", 0) > 66 and (state.get("raw", {}).get("domain") or "").lower() == "high-trust":
            rep.add("warning", "lint", "a very expressive look in a money, health or government product can cost trust", "expressive-high-trust", "S-L06-010")
        if dials.get("colorfulness", 0) > 75 and dials.get("density", 0) > 66:
            rep.add("warning", "lint", "vivid color on a dense layout can feel noisy", "vivid-and-dense", "S-L15-047")
        if params.get("signifier.minStrength") == "minimal-allowed" and dials.get("density", 0) > 33:
            rep.add("warning", "lint", "buttons and links barely look clickable on a layout that is not roomy", "minimal-signifiers-dense", "S-L15-004")
        if dials.get("expression", 0) > 66 and (state.get("raw", {}).get("domain") or "").lower() in ("finance", "banking", "fintech"):
            rep.add("warning", "lint", "a very expressive look in a finance product can cost trust", "expressive-finance", "S-L06-010")
    if (meta.get("elevation") or {}).get("model") == "extruded":  # the soft preset's paired shadows; clay says its rule in DESIGN.md
        rep.add("warning", "lint", "the soft (neumorphic) look fails 3:1 edge contrast by design: shadows are not an edge, so every "
                "control keeps a border in color.border.input or color.border.strong", "neumorphic-preset", "S-L15-060, DC-L19-67")
    for c in meta.get("macroConflicts") or []:
        rep.add("warning", "lint", f"the feel words {', '.join(c['macros'])} pull {c['dial']} in opposite directions. Pick which one wins",
                "Macro conflict", "L06 4.2 usage note")
    profile_accent = any(x["item"] == "accent" for x in (meta.get("profile") or {}).get("applied", []))
    if (meta.get("color") or {}).get("placeholderBrand") and (dials.get("colorfulness", 0) > 10 or profile_accent):
        rep.add("warning", "lint", "no brand color yet, so the accent uses a stand-in blue", "Brand color is a raw input", "DC-L06-06")
    # ---- modes and tool limits
    flags = state.get("raw", {}).get("flags", {})
    if flags.get("darkMode", True) and len(modes) < 2:
        rep.add("error", "lint", "dark mode is on (flags.darkMode), but there is no dark theme", "Dark mode is a separate mapping", "DC-L01-18")
    plan = (state.get("exports") or {}).get("figmaPlan", "professional")
    limit = FIGMA_MODE_LIMITS.get(plan, 10)
    biggest = max([len(m["contexts"]) for m in res.get("modifiers", {}).values()] or [1])
    if biggest > limit:
        rep.add("warning", "export", f"Figma {plan} allows {limit} mode(s) per collection, and the largest modifier has {biggest}. "
                "The Figma export splits them into separate collections.", "Figma plan limits", "S-L07-014, S-L07-038")
    # ---- scale monotonicity (spec 6.3)
    def mono(vals, name, strict=True):
        bad_ = [(a, b) for a, b in zip(vals, vals[1:]) if (b <= a if strict else b < a)]
        if bad_:
            rep.add("error", "lint", f"{name} does not grow step by step: {bad_[0][0]:g} then {bad_[0][1]:g}", "Scales increase step by step",
                    "DC-L02-09, DC-L03-02, DC-L04-20", name)
    mono(sizes, "font.size scale")
    mono(sorted(ladder), "space ladder")
    dur = [toks[f"motion.duration.{k}"]["resolved"]["value"] for k in ("instant", "micro", "short", "medium", "long", "extra")
           if f"motion.duration.{k}" in toks]
    mono(dur, "motion.duration ladder", strict=False)
    # ---- a coherent motion scale (R31): medium below long, exits about 0.8 x their entrance (STD-easing-duration-11)
    dms = {k: duration_ms(toks[f"motion.duration.{k}"]["resolved"]) for k in ("medium", "long", "medium-exit", "long-exit")
           if f"motion.duration.{k}" in toks}
    if dms.get("medium") and dms.get("long") and dms["medium"] >= dms["long"]:
        rep.add("warning", "lint", f"motion.duration.medium ({fmt_num(dms['medium'])}ms) is not shorter than motion.duration.long "
                f"({fmt_num(dms['long'])}ms), so bigger moves are not slower than small ones", "Durations grow with the distance moved",
                "DC-L04-20", "motion.duration.medium", measured=dms["medium"], threshold=dms["long"],
                fix="set medium below long, for example engine.py set motion.duration.medium 200ms")
    for ent, ex in (("medium", "medium-exit"), ("long", "long-exit")):
        if dms.get(ent) and dms.get(ex):
            r = dms[ex] / dms[ent]
            if not 0.695 <= r <= 0.905:
                rep.add("warning", "lint", f"motion.duration.{ex} ({fmt_num(dms[ex])}ms) is {r:.2f} x motion.duration.{ent} "
                        f"({fmt_num(dms[ent])}ms); an exit takes about 0.8 x its entrance (0.7 to 0.9)", "Exits are faster than entrances",
                        "STD-easing-duration-11", f"motion.duration.{ex}", measured=round(r, 2), threshold="0.7-0.9",
                        fix=f"engine.py set motion.duration.{ex} {int(round(dms[ent] * 0.8 / 10) * 10)}ms")
    for mode in modes:
        t2 = pick(theme=mode)
        ramps_ = sorted({k.split(".")[1] for k in t2 if re.fullmatch(rf"color\.[a-zA-Z0-9-]+\.{mode}\.\d+", k)} - {"neutral-alpha"})
        for rname in ramps_:
            ys = [luminance(hex_of(t2[f"color.{rname}.{mode}.{i}"]["resolved"])) for i in range(1, 13)]
            seg = [ys[i] for i in list(range(0, 8)) + [10, 11]]  # steps 1-8 and 11-12; 9-10 may be light fills
            ok = all(b <= a for a, b in zip(seg, seg[1:])) if mode == "light" else all(b >= a for a, b in zip(seg, seg[1:]))
            if not ok:
                rep.add("error", "lint", f"color.{rname}.{mode} shades are out of order (steps 1-8 and 11-12 must get steadily darker or lighter)",
                        "Ramp steps are ordered by contrast", "DC-L01-03", f"color.{rname}.{mode}")
    # ---- orphans: primitives no semantic token uses (info only; ramps keep spare steps on purpose)
    used = set()
    for fn, tree in files.items():
        if fn.endswith(".tokens.json") and not fn.startswith("primitives"):
            used |= set(re.findall(r"\{([^{}]+)\}", json.dumps(tree)))
    prim_tree = files.get("primitives.tokens.json")
    if prim_tree:
        pp = set(flatten(prim_tree))
        by_std = {shown_path(x) for x in std_held(state)} if std_has_records(state) else set()  # a standard's token is on purpose
        orphans = sorted(p for p in pp - used - by_std if re.match(r"(space|radius|font\.size|border\.width|motion\.(duration|easing))\.", p))
        rep.stats["orphans"] = orphans
        if orphans:
            rep.add("advisory", "lint", f"{len(orphans)} scale steps are not used by any named value yet (for example {', '.join(orphans[:3])}). "
                    "That is fine if you plan to use them", "Orphan tokens", "spec 6.3")
    # ---- coverage (block statuses from the interview)
    blocks = state.get("blocks") or {}
    if blocks:
        counts = {}
        for v in blocks.values():
            st = v.get("status") if isinstance(v, dict) else v
            counts[st] = counts.get(st, 0) + 1
        rep.stats["coverage"] = counts
        if counts.get("pending"):
            rep.add("advisory", "coverage", f"{counts['pending']} building blocks still pending: " + ", ".join(sorted(k for k, v in blocks.items()
                    if (v.get("status") if isinstance(v, dict) else v) == "pending")[:12]), "Nothing missed", "BRIEF req. 5")
    # ---- designer-owned assets (coverage, never an error)
    open_hooks = [(h, v) for h, v in (state.get("hooks") or {}).items() if (v or {}).get("status", "pending") in ("pending", "unknown")]
    if open_hooks:
        names = [hook_label(h, v) for h, v in open_hooks]
        rep.add("advisory", "hooks", f"{len(open_hooks)} assets a person must make, not asked about yet: {'; '.join(names)}",
                "Designer hooks, not designer replacement", "BRIEF req. 2, Q-brand-08", where=", ".join(h for h, _ in open_hooks))


def hook_label(hid, rec):
    """Plain asset name for a hook id: 'H-logo' -> 'logo, wordmark, symbol, lockups' (from hooks.json via state)."""
    name = (rec or {}).get("name") or dict((h, n) for h, n, _q in hook_catalog()).get(hid) or hid
    return name[:1].lower() + name[1:] if name[1:2].islower() else name


def validate_dir(d, write_state_hash=True):
    rep = Report()
    state_path = os.path.join(d, "state.json")
    state = merge_defaults(read_json(state_path)) if os.path.exists(state_path) else default_state()
    tokdir = os.path.join(d, "tokens")
    if not os.path.isdir(tokdir):
        rep.add("error", "setup", "there is no tokens/ folder yet. Run `engine.py generate` first", "", "")
        return rep
    files = load_token_dir(tokdir)
    meta = files.get("opendesigner.meta.json") or {}
    if os.path.exists(state_path) and meta.get("stateHash") and meta["stateHash"] != state_hash(read_json(state_path)):
        # check what state.json says now, so a value a check refuses shows here and not first in build (R30)
        try:
            files = generate_system(read_json(state_path))[0]
            rep.add("warning", "setup", "the files in tokens/ are older than state.json, so this check used the current state.json. "
                    "Run `engine.py build` to write the tokens, exports and DESIGN.md", "", "", fix="engine.py build")
        except Exception:
            rep.add("warning", "setup", "the tokens are older than state.json. Run `engine.py build`", "", "", fix="engine.py build")
    return validate_generated(files, state, rep)


def validate_generated(files, state, rep):
    """The checks validate runs on a set of token files and the state they came from (also a dry run's what-if copy)."""
    meta = files.get("opendesigner.meta.json") or {}
    validate_files(files, state, rep)
    for note in meta.get("notes") or []:  # a token the engine could not write is missing from every export (R03)
        m = re.match(r"^override (\S+) skipped: (.*)$", str(note))
        if m:
            rep.add("warning", "tokens", f"{m.group(1)} is missing from every export: its value could not be written ({m.group(2)})",
                    "Every recorded value reaches the tokens", "", where=m.group(1),
                    fix=f"give it a value with a unit or a type: engine.py set {m.group(1)} <value>, for example \"200ms\" or \"12px\"")
    std_validate(state, rep, files)
    return rep


TERM_DEFAULTS = {  # plain voice first (BRIEF req. 12); a glossary file, when present, overrides these
    "contrast": "contrast", "non-text contrast": "edge contrast", "hit area": "tap area", "focus ring": "focus outline",
    "token": "design value", "semantic token": "named design value", "primitive": "base value", "resolver": "mode map",
    "reduced motion": "reduced motion", "type scale": "text sizes", "spacing ladder": "spacing steps", "radius": "corner rounding",
    "elevation": "depth", "density": "density", "dial": "dial",
}
_GLOSSARY = None
_GLOSSARY_FULL = {}


def glossary():
    """Plain names from synthesis/glossary.json or references/glossary.json when another session has written one."""
    global _GLOSSARY
    if _GLOSSARY is None:
        _GLOSSARY = {}
        for path in (os.path.join(REFERENCES, "glossary.json"), os.path.join(SKILL_ROOT, "..", "..", "synthesis", "glossary.json")):
            if os.path.exists(path):
                try:
                    data = read_json(path)
                except ValueError:
                    continue
                items = data.get("terms", data) if isinstance(data, dict) else data
                if isinstance(items, dict):
                    items = [dict(v, term=k) if isinstance(v, dict) else {"term": k, "plain": v} for k, v in items.items()]
                for it in items if isinstance(items, list) else []:
                    if isinstance(it, dict):
                        key = str(it.get("term") or it.get("id") or it.get("name") or "").lower()
                        plain = it.get("plain") or (it.get("voices") or {}).get("plain")
                        if key and isinstance(plain, str):
                            _GLOSSARY[key] = plain
                            _GLOSSARY_FULL[key] = it
                break
    return _GLOSSARY


def short_line(key):
    """The one-line 'Designers: X · Code: Y' note for a glossary term (synthesis/THREE-VOICES.md), or ''."""
    glossary()
    it = _GLOSSARY_FULL.get(key.lower()) or {}
    ds, cn = it.get("designer_says"), it.get("code_name")
    return f"Designers: {ds} · Code: `{cn}`" if ds and cn else ""


def term(key):
    g = glossary()
    v = g.get(key.lower())
    if v:
        return v.split(".")[0].split(";")[0].strip()[:60]  # a short name, not the whole definition
    return TERM_DEFAULTS.get(key, key)


def words_of(path):
    """color.bg.neutral.subtle-hover -> 'neutral subtle hover background' (plain words for a token path)."""
    parts = [re.sub(r"(?<=[a-z0-9])([A-Z])", lambda m: " " + m.group(1).lower(), x).replace("-", " ") for x in path.split(".")]
    if parts and parts[0] == "color":
        parts = parts[1:]
    kind = {"bg": "background", "text": "text", "border": "border", "surface": "surface", "icon": "icon"}.get(parts[0] if parts else "", None)
    rest = [x for x in parts[1:]]
    if kind == "text" and rest and rest[0].startswith("on "):
        return f"text on {rest[0][3:]} fills"
    return " ".join(rest + ([kind] if kind else parts[:1])).strip()


def plain_of(it):
    """One short plain sentence per finding; the rule and source id go at the end of the printed line."""
    cat, where, m, th = it["category"], it.get("where") or "", it.get("measured"), it.get("threshold")
    if cat == "contrast" and " on " in where and ":" in where:
        mode, pair = where.split(":", 1)
        fg, bg = pair.split(" on ")
        what = "hard to read" if (".text." in fg) else "too faint to see"
        return f"In {mode} mode, {words_of(fg)} on {words_of(bg)} is {what}: {term('contrast')} {m}:1, needs {th}:1."
    if cat == "targets" and m is not None:
        return f"{words_of(where) or where} is too small to tap or click: {m:g}px, needs {th:g}px."
    if cat == "dtcg":
        return "The token files break the DTCG file format: " + it["message"]
    if cat == "apca":
        return "Advice only: " + it["message"]
    if cat == "hooks":
        return "Not asked yet (assets a person must make): " + it["message"].split(": ", 1)[-1]
    return it["message"][:1].upper() + it["message"][1:]


def print_report(rep, d, as_json=False):
    for it in rep.items:
        it["plain"] = plain_of(it)
    if as_json:
        print(json.dumps({"dir": d, "errors": rep.count("error"), "warnings": rep.count("warning"),
                          "advisories": rep.count("advisory"), "items": rep.items, "stats": rep.stats}, indent=2))
        return
    label = {"error": "ERROR", "warn": "WARN ", "info": "NOTE "}
    ne, nw, ni = rep.count("error"), rep.count("warning"), rep.count("advisory")
    head = "Passes: no errors." if not ne else f"Fails: {ne} error{'s' if ne != 1 else ''} to fix before you export."
    print(f"{head} {nw} warning{'s' if nw != 1 else ''}, {ni} note{'s' if ni != 1 else ''}.  ({d})")
    for sev in ("error", "warn", "info"):
        for it in rep.items:
            if it["severity"] != sev:
                continue
            cite = "; ".join(x for x in (it["rule"], it["evidence"]) if x)
            print(f"{label[sev]} {it['plain']}" + (f"  [{cite}]" if cite else ""))
            if it.get("fix") and sev != "info":
                print(f"      Fix: {it['fix']}")
    st = rep.stats
    print(f"Checked {st.get('contrastPairs', 0)} color pairs in every mode, {st.get('permutations', 0)} mode combinations and "
          f"{st.get('tokens', 0)} tokens.")


# =============================================================================================
# State editing: set, pick, lock (the OD:set / OD:pick grammar maps one-to-one onto these)
# =============================================================================================

TOP_KEYS = {"name", "summary", "context", "dials", "preset", "style", "customStyles", "macros", "raw", "overrides", "answers", "principles",
            "components", "hooks", "exports", "locks", "zoom", "blocks", "references", "taste", "waivers", "mode", "profile"}
VOICES = ["plain", "designer", "engineer"]  # BRIEF req. 12: plain first
# Q-scope-06 surface modes [S-L17-007]. Tokens stay global: the main surface sets raw.productType, any Persuade or
# Experience surface sets raw.marketingSurfaces, and each surface gets its density mode and hero rule in the docs [inferred].
SURFACE_MODES = {
    "persuade": {"name": "Persuade", "productType": "marketing", "density": "spacious",
                 "rule": "one hero line per page; sections, not card grids"},
    "operate": {"name": "Operate", "productType": "work-tool", "density": None,
                "rule": "no hero; cards only to group related data"},
    "read": {"name": "Read", "productType": "content", "density": "comfortable",
             "rule": "no hero; `text.body.lg` for long text; no cards around running text"},
    "experience": {"name": "Experience", "productType": "marketing", "density": "spacious",
                   "rule": "hero moments and big imagery allowed; display styles welcome"},
}


def surface_list(value):
    """Q-scope-06 answer -> [{name, mode}] with the main surface first. Takes a mode word, a list of mode words,
    a list of {name, mode}, or 'name:mode' strings."""
    items = value if isinstance(value, list) else [value]
    out = []
    for it in items:
        if isinstance(it, dict):
            name, mode = it.get("name") or "", str(it.get("mode") or "")
        elif isinstance(it, str) and ":" in it:
            name, mode = (x.strip() for x in it.split(":", 1))
        else:
            name, mode = "", str(it)
        key = mode.strip().lower()
        if key in SURFACE_MODES:
            out.append({"name": name or SURFACE_MODES[key]["name"] + " surface", "mode": SURFACE_MODES[key]["name"]})
    return out


def surface_rule(surface, density_default):
    info = SURFACE_MODES.get(str(surface.get("mode", "")).lower()) if isinstance(surface, dict) else None
    if not info:
        return ""
    return f"density {info['density'] or density_default}; {info['rule']}"


FIGMA_PLAN_OF = {"figma-starter": "starter", "figma-pro": "professional", "figma-org": "organization", "figma-ent": "enterprise"}  # Q-tool-03
BRAND_ROWS = {"A": ("playful", "serious"), "B": ("friendly", "authoritative"), "C": ("minimal", "rich"),
              "D": (None, None), "E": ("premium", "everyday"), "F": ("modern", "heritage"), "G": ("bold", "deferential")}


EXTENDED_COMPONENTS = [  # Q-comp-02 "extended": about 25 more parts (DC-L08-01 long tail) [inferred list]
    "date-picker", "combobox", "multi-select", "file-upload", "toast", "skeleton", "pagination", "stepper", "tag", "chip",
    "segmented-control", "icon-button", "drawer", "sheet", "navigation-bar", "tab-bar", "toolbar", "search-field", "empty-state",
    "data-table", "tree-view", "rating", "carousel", "command-palette", "number-field"]
AI_COMPONENTS = ["logo", "ai-label", "ai-button", "chat-message", "prompt-input"]  # Q-comp-02 "logo-ai"
UNSET = "__unset__"  # an answer effect that removes an earlier value, so the engine default applies again
LABEL = "__label__"  # an answer effect whose value is the chosen option's plain label

# Answer -> engine input, per question and option (U5: every answer reaches the system, or says why not).
# Values are [inferred] positions inside the levers.json bands that each option names.
ANSWER_TABLE = {
    "Q-aud-01": {"dense": {"dials.density": 80}, "regular": {"dials.density": 50}, "large": {"dials.density": 15}},
    "Q-aud-02": {"high-trust": {"raw.domain": "high-trust"}, "work": {"raw.domain": "work"}, "consumer": {"raw.domain": "consumer"},
                 "play": {"raw.domain": "play"}},
    "Q-aud-03": {"wcag22-aa": {"raw.contrastTarget": "AA"}, "wcag22-aa-plus": {"raw.contrastTarget": "AAA"},
                 "wcag22-a": {"raw.contrastTarget": "AA"}},  # AA stays the floor (guardrails)
    "Q-brand-02": {"sig-typeface": {"context.memorable": LABEL}, "sig-color": {"context.memorable": LABEL},
                   "sig-device": {"context.memorable": LABEL}, "sig-character": {"context.memorable": LABEL}},
    "Q-brand-03": {"yes-full": {"hooks.H-logo.status": "have"}, "yes-wordmark": {"hooks.H-logo.status": "have"},
                   "no": {"hooks.H-logo.status": "placeholder"}},
    "Q-brand-04": {"productive": {"dials.expression": 25}, "hero-moments": {"dials.expression": 50}, "expressive": {"dials.expression": 80}},
    "Q-brand-06": {"two-sets": {"raw.marketingSurfaces": True}, "emphasized": {"overrides.type.emphasizedVariants": True},
                   "brand-face": {"raw.displayFace": "=brandFace"},
                   "productive-only": {"raw.marketingSurfaces": False, "overrides.type.emphasizedVariants": False}},
    "Q-brand-08": {k: {f"hooks.{h}.status": "have"} for k, h in (
        ("logo", "H-logo"), ("brand-colors", "H-color"), ("typeface", "H-type"), ("icons", "H-icons"), ("app-icon", "H-appicon"),
        ("photography", "H-photo"), ("illustration", "H-illus"), ("motion-assets", "H-motion"), ("motifs", "H-motif"),
        ("sounds", "H-sound"), ("voice-guide", "H-voice"), ("brand-book", "H-brandbook"))},
    "Q-plat-02": {k: {"raw.devices": [k]} for k in ("phone", "tablet-foldable", "desktop-web", "watch", "tv", "car", "spatial")},
    "Q-plat-03": {"touch": {"raw.inputs": ["touch"]}, "pointer": {"raw.inputs": ["pointer"]}, "keyboard": {"raw.inputs": ["keyboard"]},
                  "remote": {"raw.inputs": ["remote"]}, "spatial": {"raw.inputs": ["gaze"]}},
    "Q-plat-04": {"driving": {"raw.situations": ["driving"]}, "spatial": {"raw.situations": ["headset"]},
                  "watch": {"raw.situations": ["wrist"]}, "none": {"raw.situations": []}},
    "Q-plat-05": {"native-first": {"dials.brandPresence": 25}, "hybrid": {"dials.brandPresence": 50}, "brand-first": {"dials.brandPresence": 75}},
    "Q-dir-02": {"compact": {"dials.density": 80}, "comfortable": {"dials.density": 50}, "spacious": {"dials.density": 20},
                 "user-selectable": {"dials.density": 50}},
    "Q-dir-03": {"subtle": {"overrides.type.ratio": 1.2}, "balanced": {"overrides.type.ratio": 1.25}, "dramatic": {"overrides.type.ratio": 1.333}},
    "Q-dir-04": {"space": {"overrides.border.softness": "soft", "overrides.layout.containment": "whitespace"},
                 "containers": {"overrides.border.softness": "default", "overrides.layout.containment": "visible-containers"},
                 "lines": {"overrides.border.softness": "strong-rules", "overrides.layout.containment": "whitespace"}},
    "Q-color-01": {"keep-hex": {"raw.flags.brandExact": True}, "seed": {"raw.flags.brandExact": False},
                   "seed-3": {"raw.flags.brandExact": False}, "contrast-targets": {"raw.flags.brandExact": False}},
    "Q-color-02": {"accent": {"overrides.color.brandRole": "reserved-accent", "overrides.chrome.navTreatment": "neutral", "overrides.color.surfaces": UNSET},
                   "signature-surface": {"overrides.color.brandRole": "accent+signature-surface", "overrides.chrome.navTreatment": "neutral",
                                         "overrides.color.surfaces": "tinted-containers"},
                   "flooded-chrome": {"overrides.color.brandRole": "brand-chrome-allowed", "overrides.chrome.navTreatment": "colored-if-expression-allows",
                                      "overrides.color.surfaces": UNSET},
                   "content-layer": {"overrides.color.brandRole": "reserved-accent", "overrides.chrome.navTreatment": "neutral",
                                     "overrides.color.surfaces": UNSET, "raw.glass": True},
                   "neutral-first": {"overrides.color.brandRole": "reserved-accent", "overrides.chrome.navTreatment": "recessive",
                                     "overrides.color.surfaces": UNSET, "raw.neutralTint": "brand"}},
    "Q-color-03": {"monochrome": {"dials.colorfulness": 5}, "tonal": {"dials.colorfulness": 45}, "vivid": {"dials.colorfulness": 92},
                   "expressive": {"dials.colorfulness": 75}, "fidelity": {"raw.flags.brandExact": True, "dials.colorfulness": 60}},
    "Q-color-04": {"one": {"raw.accentCount": 1, "raw.accentHarmony": UNSET},
                   "analogous": {"raw.accentCount": 3, "raw.accentHarmony": "analogous"},
                   "contrasting": {"raw.accentCount": 2, "raw.accentHarmony": "complementary", "raw.neutralTint": "brand"},
                   "three": {"raw.accentCount": 3, "raw.accentHarmony": "triadic"},
                   "multi": {"raw.accentCount": 3, "raw.accentHarmony": "triadic", "raw.chartPalette": "categorical-8"}},
    "Q-color-05": {"strict": {"overrides.color.surfaces": "neutral+one-accent"}, "moderate": {"overrides.color.surfaces": "tinted-containers"},
                   "expressive": {"overrides.color.surfaces": "brand-or-dynamic-surfaces"}},
    "Q-color-09": {"pure": {"raw.neutralTint": "pure"}, "cool": {"raw.neutralTint": "cool"}, "warm": {"raw.neutralTint": "warm"},
                   "hue-matched": {"raw.neutralTint": "brand"}},
    "Q-color-11": {"srgb": {"raw.flags.p3": False}, "p3-enhance": {"raw.flags.p3": True}, "oklch-wide": {"raw.flags.p3": True},
                   "native-p3": {"raw.flags.p3": True}},
    "Q-color-14": {"alternating": {"raw.surfaceLayers": "alternating"}, "role-tiers": {"raw.surfaceLayers": UNSET},
                   "container-tiers": {"raw.surfaceLayers": UNSET}, "elevation-named": {"raw.surfaceLayers": UNSET}},
    "Q-color-15": {"classic-4": {"raw.statusSet": "classic-4"}, "discovery": {"raw.statusSet": "discovery"}, "workflow": {"raw.statusSet": "workflow"}},
    "Q-color-17": {"aa": {"raw.contrastTarget": "AA"}, "aaa": {"raw.contrastTarget": "AAA"}, "aa-apca": {"raw.contrastTarget": "AA"}},
    "Q-pattern-07": {"lines": {"raw.tableRows": "lines"}, "zebra": {"raw.tableRows": "zebra"}, "space": {"raw.tableRows": "space"},
                     "sticky-header": {"raw.tableHeader": "sticky"}, "static-header": {"raw.tableHeader": "static"},
                     "numbers-right": {"raw.tableNumbers": "right"}, "numbers-left": {"raw.tableNumbers": "left"}},
    "Q-color-19": {"none": {"raw.chartPalette": "none"}, "brand-gray": {"raw.chartPalette": "brand-gray"},
                   "categorical-6-8": {"raw.chartPalette": "categorical-8"}, "carbon-14": {"raw.chartPalette": "categorical-14"}},
    "Q-color-20": {"overlay": {"raw.stateMethod": "overlay"}, "step-shift": {"raw.stateMethod": "step"}, "hybrid": {"raw.stateMethod": "hybrid"}},
    "Q-color-21": {"black": {"raw.darkBase": "black"}, "near-black": {"raw.darkBase": "near-black"}, "charcoal": {"raw.darkBase": "charcoal"},
                   "dimmed": {"raw.darkBase": "dimmed"}},
    "Q-color-23": {"focus-brand": {"raw.focusStyle": "brand"}, "focus-neutral": {"raw.focusStyle": "neutral"},
                   "two-tier": {"overrides.border.softness": "default"}, "by-purpose": {"overrides.border.softness": "strong-rules"}},
    "Q-type-01": {"system": {"raw.textFace": "system", "raw.displayFace": "=textFace"},
                  "open-neutral": {"raw.textFace": "Inter", "raw.displayFace": "=textFace"},
                  "open-custom": {"raw.textFace": "=openClass", "raw.displayFace": "=textFace"},
                  "brand-display": {"raw.textFace": "system", "raw.displayFace": "=brandFace"},
                  "brand-everywhere": {"raw.textFace": "=brandFace", "raw.displayFace": "=textFace"}},
    "Q-type-02": {"yes": {"hooks.H-type.status": "have", "raw.fontLicence": {"web": True, "app": True, "selfHost": True}},
                  "license-only": {"hooks.H-type.status": "placeholder", "raw.fontLicence": {"web": True, "app": True, "selfHost": True}},
                  "no": {"hooks.H-type.status": "open-library", "raw.fontLicence": {"web": False, "app": False, "selfHost": False}},
                  "web-only": {"hooks.H-type.status": "have", "raw.fontLicence": {"web": True, "app": False, "selfHost": True}},
                  "app-only": {"hooks.H-type.status": "have", "raw.fontLicence": {"web": False, "app": True, "selfHost": False}}},
    "Q-type-03": {c: {"raw.fontClass": c} for c in ("neo-grotesque", "geometric", "humanist", "serif", "slab", "rounded")},
    "Q-type-04": {"latin": {"raw.scripts": ["Latn"]}, "indic": {"raw.scripts": ["Latn", "Deva", "Beng"]},
                  "cjk": {"raw.scripts": ["Latn", "Hans", "Jpan", "Kore"]}, "arabic-hebrew": {"raw.scripts": ["Latn", "Arab", "Hebr"]},
                  "thai-other": {"raw.scripts": ["Latn", "Thai"]}},
    "Q-type-05": {"one": {"raw.displayFace": "=textFace"}, "superfamily": {"raw.displayFace": "=textFace"},
                  "sans-serif": {"raw.displayFace": "=serif"}, "display-face": {"raw.displayFace": "=brandFace"}},
    "Q-type-06": {"system-mono": {"raw.monoFace": "ui-monospace"}, "numeric-face": {"raw.numericStyles": True}},
    "Q-type-09": {"1.125": {"overrides.type.ratio": 1.125}, "1.2": {"overrides.type.ratio": 1.2}, "1.25": {"overrides.type.ratio": 1.25},
                  "1.333": {"overrides.type.ratio": 1.333},
                  **{k: {"overrides.type.ratio": v} for k, v in (("major-second", 1.125), ("minor-third", 1.2), ("major-third", 1.25),
                                                                   ("perfect-fourth", 1.333), ("augmented-fourth", 1.414),
                                                                   ("perfect-fifth", 1.5), ("golden-ratio", 1.618))}},
    "Q-type-11": {"4pt": {"raw.lineHeightGrid": 4}, "2pt": {"raw.lineHeightGrid": 2}},
    "Q-type-12": {"two": {"overrides.type.weightCount": 2}, "three": {"overrides.type.weightCount": 3}, "four": {"overrides.type.weightCount": 4},
                  "emphasized-twin": {"overrides.type.emphasizedVariants": True}, "strong-stronger": {"overrides.type.emphasizedVariants": True}},
    "Q-type-13": {"size-table": {"raw.tracking": "sf-pro"}, "per-style": {"raw.tracking": "per-style"}, "zero": {"raw.tracking": "zero"}},
    "Q-type-17": {"full": {"raw.textScaling": "full"}, "capped-chrome": {"raw.textScaling": "capped"}, "none": {"raw.textScaling": "none"}},
    "Q-space-02": {"hybrid": {"raw.spaceLadder": "hybrid"}, "linear": {"raw.spaceLadder": "linear"}, "geometric": {"raw.spaceLadder": "geometric"}},
    "Q-space-03": {"web-24-44": {"raw.minTarget": UNSET}, "ios-44": {"raw.minTarget": 44}, "android-48": {"raw.minTarget": 48},
                   "vehicle-76": {"raw.minTarget": 76}},
    "Q-space-04": {"pointer-24-32-40": {"overrides.control.height.md": 32}, "touch-32-40-48": {"overrides.control.height.md": 40},
                   "expressive-m3": {"overrides.control.height.md": 56}},
    "Q-space-05": {"1:2": {"raw.groupRatio": "1:2"}, "1:3-1:4": {"raw.groupRatio": "1:3-1:4"}, "dense": {"raw.groupRatio": "dense"}},
    "Q-space-07": {"nudges": {"raw.spaceExtras": ["nudges"]}, "hairline": {"raw.spaceExtras": ["hairline"]}},
    "Q-space-10": {"icons-16-32": {"overrides.icon.defaultSize": 16}, "button-sized": {"overrides.icon.defaultSize": 20}},
    "Q-layout-01": {"material": {"raw.breakpoints": "material"}, "tailwind": {"raw.breakpoints": "tailwind"},
                    "bootstrap": {"raw.breakpoints": "bootstrap"}, "apple-size-classes": {"raw.breakpoints": UNSET}},
    "Q-layout-03": {"reading": {"raw.productType": "content"}, "working": {"raw.productType": "work-tool"},
                    "data": {"raw.productType": "work-tool", "raw.numericStyles": True}},
    "Q-shape-01": {"square": {"dials.roundness": 5, "overrides.radius.control": 0}, "subtle": {"dials.roundness": 40, "overrides.radius.control": 6},
                   "soft": {"dials.roundness": 55, "overrides.radius.control": 8}, "pill": {"dials.roundness": 97, "overrides.radius.control": "full"}},
    "Q-shape-04": {"circular": {"raw.cornerShape": "circular"}, "continuous": {"raw.cornerShape": "continuous"},
                   "squircle-enhance": {"raw.cornerShape": "squircle-enhance"}},
    "Q-depth-01": {"borders": {"dials.depth": 8}, "ring-shadow": {"dials.depth": 25}, "tonal": {"dials.depth": 45}, "shadow": {"dials.depth": 68},
                   "glass": {"dials.depth": 90}},
    "Q-color-25": {"brand-only": {"raw.gradients": "brand-only"}, "none": {"raw.gradients": "none"},
                   "components": {"raw.gradients": "components"}},
    "Q-depth-04": {"none": {"raw.glass": False}, "control-layer": {"raw.glass": True}, "transient": {"raw.glass": True}, "decorative": {"raw.glass": True}},
    "Q-depth-05": {"1-2-4": {"raw.borderWidths": [1, 2, 4]}, "1-2-3-4": {"raw.borderWidths": [1, 2, 3, 4]},
                   "dividers-space-first": {"overrides.border.softness": "soft"}},
    "Q-depth-06": {"scrim-fluent": {"raw.scrim": "fluent"}, "scrim-atlassian": {"raw.scrim": "atlassian"},
                   "overlays-material": {"raw.stateOpacity": "material"}, "overlays-atlassian": {"raw.stateOpacity": "atlassian"}},
    "Q-motion-01": {"none": {"dials.energy": 0, "raw.flags.motionOff": True}, "productive": {"dials.energy": 20, "raw.flags.motionOff": False},
                    "two-mode": {"dials.energy": 50, "raw.flags.motionOff": False}, "springs": {"dials.energy": 80, "raw.flags.motionOff": False}},
    "Q-motion-04": {"durations-only": {"overrides.motion.spring.spatial.dampingRatio": 1.0},
                    "spatial-effects": {"overrides.motion.spring.spatial.dampingRatio": UNSET},
                    "apple-bounce": {"overrides.motion.spring.spatial.dampingRatio": 0.85}},
    "Q-motion-07": {"replace": {"raw.reducedMotion": "replace"}, "remove": {"raw.reducedMotion": "remove"}, "per-device": {"raw.reducedMotion": "replace"}},
    "Q-motion-08": {"silent": {"hooks.H-sound.status": "not-needed"}, "rare-events": {"hooks.H-sound.status": "placeholder"},
                    "sound-forward": {"hooks.H-sound.status": "placeholder"}},
    "Q-motion-09": {"haptics-system": {"hooks.H-haptic.status": "not-needed"}, "haptics-semantic": {"hooks.H-haptic.status": "placeholder"}},
    "Q-icon-01": {"platform-native": {"hooks.H-icons.status": "open-library"}, "open-source": {"hooks.H-icons.status": "open-library"},
                  "custom": {"hooks.H-icons.status": "have"}, "extend": {"hooks.H-icons.status": "open-library"}},
    "Q-icon-02": {"outlined": {"overrides.icon.restStyle": "outline"}, "filled": {"overrides.icon.restStyle": "filled-or-colored"},
                  "duotone": {"overrides.icon.restStyle": "duotone"}, "rounded": {"overrides.icon.cornerStyle": "rounded"},
                  "sharp": {"overrides.icon.cornerStyle": "sharp"}},
    "Q-icon-03": {"2-at-24": {"raw.iconStroke": 2}, "1.5-at-24": {"raw.iconStroke": 1.5}, "1.5-at-16": {"raw.iconStroke": 2.25},
                  "variable": {"raw.iconStroke": UNSET}},
    "Q-icon-04": {"material-grid": {"overrides.icon.defaultSize": 24}, "carbon": {"overrides.icon.defaultSize": 16},
                  "fluent": {"overrides.icon.defaultSize": 20}},
    "Q-icon-06": {"yes-layered": {"hooks.H-appicon.status": "have"}, "yes-flat": {"hooks.H-appicon.status": "have"},
                  "no": {"hooks.H-appicon.status": "placeholder"}},
    "Q-img-01": {"none": {"hooks.H-photo.status": "not-needed"}, "documentary": {"hooks.H-photo.status": "placeholder"},
                 "portraiture": {"hooks.H-photo.status": "placeholder"}, "still-life": {"hooks.H-photo.status": "placeholder"}},
    "Q-img-04": {"none": {"hooks.H-illus.status": "not-needed"}, "line": {"hooks.H-illus.status": "placeholder"},
                 "flat": {"hooks.H-illus.status": "placeholder"}, "hand-drawn": {"hooks.H-illus.status": "placeholder"},
                 "mascot": {"hooks.H-illus.status": "placeholder"}},
    "Q-img-06": {"symbol-animation": {"hooks.H-motion.status": "open-library"}, "lottie": {"hooks.H-motion.status": "placeholder"},
                 "3d": {"hooks.H-motion.status": "placeholder"}, "emoji-stickers": {"hooks.H-motion.status": "placeholder"}},
    "Q-img-07": {"none": {"hooks.H-motif.status": "not-needed"}, "expressive-only": {"hooks.H-motif.status": "placeholder"},
                 "logo-shapes": {"hooks.H-motif.status": "placeholder"}},
    "Q-voice-01": {"upload": {"hooks.H-voice.status": "have"}, "plainspoken": {"hooks.H-voice.status": "placeholder", "context.voice": LABEL},
                   "warm-crisp": {"hooks.H-voice.status": "placeholder", "context.voice": LABEL},
                   "bold-optimistic": {"hooks.H-voice.status": "placeholder", "context.voice": LABEL},
                   "custom": {"hooks.H-voice.status": "placeholder"}},
    "Q-voice-03": {"sentence": {"overrides.content.capitalization": "sentence-case"}, "title-headings": {"overrides.content.capitalization": "title-case"}},
    "Q-comp-01": {k: {"components.base": k} for k in ("headless", "copy-in-styled", "web-components", "native", "adopt")},
    "Q-comp-02": {"core-25": {"components.inventory": list(DEFAULT_COMPONENTS)},
                  "extended": {"components.inventory": list(DEFAULT_COMPONENTS) + EXTENDED_COMPONENTS},
                  "logo-ai": {"components.inventory": list(DEFAULT_COMPONENTS) + AI_COMPONENTS}},
    "Q-state-02": {"strong": {"overrides.signifier.minStrength": "strong"}, "balanced": {"overrides.signifier.minStrength": "balanced"},
                   "minimal": {"overrides.signifier.minStrength": "minimal-allowed"}},
    "Q-state-03": {"outer-2-2": {"raw.focusWidth": 2, "raw.focusOffset": 2}, "material-3": {"raw.focusWidth": 3, "raw.focusOffset": 2},
                   "inset": {"raw.focusWidth": 2, "raw.focusOffset": -2}, "two-tone": {"raw.focusStyle": "two-tone"}},
    "Q-state-04": {"overlays": {"raw.stateMethod": "overlay"}, "explicit": {"raw.stateMethod": "step"},
                   "press-scale": {"raw.stateMethod": "overlay"}},  # overlays for hover; the 0.97 press scale is motion.scale.press
    "Q-form-01": {"outlined": {"raw.fieldStyle": "outlined"}, "filled": {"raw.fieldStyle": "filled"}},
    "Q-ai-01": {"none": {}, "label-button": {"components.inventory+": ["ai-label", "ai-button"]},
                "presence-mode": {"components.inventory+": ["ai-label"]}, "chat": {"components.inventory+": ["chat-message", "prompt-input"]},
                "voice": {}},
    "Q-theme-01": {"system-light-dark": {"raw.flags.darkMode": True, "raw.defaultTheme": "system"},
                   "light-dark-toggle": {"raw.flags.darkMode": True, "raw.defaultTheme": "system"},
                   "light-only": {"raw.flags.darkMode": False, "raw.defaultTheme": "system"},
                   "dark-only": {"raw.flags.darkMode": True, "raw.defaultTheme": "dark"}},
    "Q-space-01": {"4-grid-8-rhythm": {"raw.spaceUnit": 4}, "4": {"raw.spaceUnit": 4}, "8": {"raw.spaceUnit": 8}, "rem-16": {"raw.spaceUnit": 4}},
}
# Questions whose answers are recorded without changing tokens, and what they shape instead (U5: say so, never be silent).
RECORD_KINDS = {
    "rule": "recorded; this shapes DESIGN.md rules, not tokens",
    "owner": "recorded as an owner input in PRODUCT.md; it does not change tokens",
    "hook": "recorded as an asset status (DESIGN.md asset table and Open Items); it does not change tokens",
    "reference": "recorded; add the reference with the opendesigner-extract skill, then engine.py intake",
    "export": "recorded; this changes the files in build/ on the next build, not the tokens",
}
_R = {
    "rule": """Q-brand-05 Q-dir-05 Q-plat-06 Q-plat-10 Q-aud-04 Q-theme-02 Q-theme-03 Q-theme-04 Q-color-06 Q-color-07 Q-color-08 Q-color-10
               Q-color-12 Q-color-13 Q-color-16 Q-color-18 Q-color-22 Q-color-24 Q-color-26 Q-type-07 Q-type-10 Q-type-14 Q-type-15
               Q-type-16 Q-space-06 Q-space-08 Q-space-09 Q-layout-02 Q-layout-04 Q-layout-05 Q-layout-06 Q-shape-02 Q-shape-03
               Q-shape-05 Q-depth-02 Q-depth-03 Q-motion-02 Q-motion-03 Q-motion-05 Q-motion-06 Q-motion-10 Q-icon-05 Q-icon-07 Q-icon-08
               Q-img-02 Q-img-03 Q-img-05 Q-viz-01 Q-voice-02 Q-voice-04 Q-voice-05 Q-voice-06 Q-comp-03 Q-comp-04 Q-comp-05 Q-state-01
               Q-state-05 Q-state-06 Q-state-07 Q-state-08 Q-form-02 Q-form-03 Q-form-04 Q-form-05 Q-pattern-01 Q-pattern-02 Q-pattern-03
               Q-pattern-04 Q-pattern-05 Q-pattern-06 Q-token-01 Q-token-02 Q-token-03 Q-token-04 Q-token-05 Q-token-06 Q-token-07 Q-token-08
               Q-token-09 Q-token-10 Q-brand-02 Q-shape-01 Q-type-06 Q-type-09 Q-type-11 Q-space-07 Q-space-10 Q-layout-03 Q-depth-05
               Q-motion-09 Q-voice-03 Q-form-01 Q-state-04 Q-ai-01 Q-icon-02 Q-color-23 Q-state-02""",
    "owner": """Q-scope-01 Q-scope-02 Q-scope-03 Q-scope-04 Q-scope-05 Q-scope-07 Q-tool-01 Q-tool-02 Q-tool-04 Q-gov-01 Q-gov-02 Q-gov-03 Q-gov-04 Q-gov-05
                Q-gov-06 Q-gov-07 Q-dist-01 Q-dist-02 Q-dist-03 Q-dist-04 Q-pref-01 Q-pref-02 Q-pref-03 Q-plat-07 Q-plat-08 Q-plat-09
                Q-comp-01 Q-comp-02 Q-aud-02 Q-brand-07 Q-site-01 Q-site-02 Q-site-03 Q-site-04 Q-site-05""",
    "hook": "Q-brand-03 Q-brand-08 Q-icon-01 Q-icon-06 Q-img-01 Q-img-04 Q-img-06 Q-img-07 Q-motion-08 Q-voice-01 Q-type-02",
    "reference": "Q-ref-01",
    "export": "Q-type-17 Q-tool-03 Q-shape-04",
}
ANSWER_RECORDS = {q: k for k, qs in _R.items() for q in qs.split()}
ANSWER_NOTES = {  # one plain line for options the engine cannot build yet, so the reply stays honest
    ("Q-type-06", "brand-mono"): "name the code font with engine.py set raw.monoFace '\"Name\"'",
    ("Q-type-01", "open-custom"): "the open font follows the style you pick (Q-type-03); name another with engine.py set raw.textFace",
    ("Q-type-09", "hand-tuned"): "keep your own sizes by setting font.size tokens one by one (engine.py set font.size.<n> ...)",
    ("Q-color-21", "dimmed"): "the dark theme uses a dimmed base; a separate third theme is not generated",
    ("Q-shape-01", "rule-based"): "corners follow the Roundness dial; set dials.roundness to move them",
    ("Q-space-07", "negatives"): "negative spacing is not generated; use margins in code sparingly",
}


def _questions_path():
    for path in (os.path.join(REFERENCES, "questions.json"), os.path.join(SKILL_ROOT, "..", "..", "data", "questions.json")):
        if os.path.exists(path):
            return path
    return None


_QUESTIONS = None


def questions():
    """references/questions.json by id: zoom level, area, options (v, l). Empty when the file is missing."""
    global _QUESTIONS
    if _QUESTIONS is None:
        _QUESTIONS = {}
        path = _questions_path()
        if path:
            try:
                _QUESTIONS = {q["id"]: q for q in read_json(path).get("questions", [])}
            except (ValueError, KeyError):
                _QUESTIONS = {}
    return _QUESTIONS


def option_values(q):
    out = []
    for o in (q or {}).get("options") or []:
        v = o.get("v", o.get("value"))
        out += [str(x) for x in v] if isinstance(v, list) else [str(v)]
    return out


def question_default(state, qid):
    """The option to recommend for a question: the one its default_follows maps an earlier answer to (Q-dir-02 follows
    Q-aud-01, so accepting the default never undoes a dense answer), else its default_value."""
    q = questions().get(qid) or {}
    fol = q.get("default_follows") or {}
    prev = answer_value((state.get("answers") or {}).get(fol.get("question"))) if fol else None
    return (fol.get("map") or {}).get(str(prev)) or q.get("default_value")


def option_label(qid, value):
    """Plain label of an option, without its source tags; None when the value is not a listed option."""
    for o in (questions().get(qid) or {}).get("options") or []:
        v = o.get("v", o.get("value"))
        if str(v) == str(value) or (isinstance(v, list) and str(value) in [str(x) for x in v]):
            lab = o.get("l", o.get("label", str(value)))
            return re.sub(r"\s*\[[^\]]*\]\.?\s*$", "", lab).rstrip(". ").strip()
    return None


def answer_words(qid, value):
    """Plain words for an answer: the option labels, or the value itself."""
    if isinstance(value, dict):
        if qid == "Q-brand-01":
            return ", ".join(m["id"] if isinstance(m, dict) else str(m) for m in answer_effects(qid, value).get("macros", [])) or "balanced"
        return ", ".join(f"{k} {v}" for k, v in value.items() if not isinstance(v, (dict, list)))
    if qid == "Q-scope-06":
        items = surface_list(value)
        if items:
            return ", ".join(f"{x['name']} ({x['mode']})" if not x["name"].endswith(" surface") else x["mode"] for x in items)
    vals = value if isinstance(value, list) else [value]
    out = []
    for v in vals:
        if isinstance(v, dict):
            out.append(v.get("name") or json.dumps(v, ensure_ascii=False))
            continue
        out.append(option_label(qid, v) or str(v))
    return ", ".join(out)


FEEL_STOP = {"a", "an", "and", "bit", "little", "very", "really", "super", "quite", "kind", "of", "the", "but", "more", "too", "so", "not",
             "lot", "lots", "with", "feel", "feeling", "look", "looking", "like", "it", "should", "be", "i", "want", "we", "our", "my"}


def feel_words(words):
    """Plain feel words -> (macro ids in order, {word: [macros]}, unknown words). Never raises (U5 F6, F7)."""
    table = (levers().get("feelWords") or {}).get("words") or {}
    known = {m["id"] for m in levers()["macros"]}
    macros, mapping, unknown = [], {}, []

    def look(w):
        w = w.strip().lower().strip("!.?,;:'\"()")
        for cand in (w, w.replace(" ", "-"), w.replace("_", "-"), w[:-1] if w.endswith("s") else None, w[:-2] if w.endswith("ly") else None):
            if cand and (cand in known or cand in table):
                return [cand] if cand in known else table[cand]
        return None
    for phrase in words:
        phrase = str(phrase).strip()
        if not phrase:
            continue
        ids = look(phrase)
        if ids is None:
            parts = [x for x in re.split(r"[\s/+&]+", phrase.lower()) if x and x.strip("!.?,") not in FEEL_STOP]
            found = [look(x) for x in parts]
            ids = [m for f in found if f for m in f] or None
        if ids is None:
            unknown.append(phrase)
            continue
        mapping[phrase] = ids
        for m in ids:
            if m not in macros:
                macros.append(m)
    return macros, mapping, unknown


def look_words(words):
    """Plain look words -> {phrase: [style ids, best first]} from levers styleWords (references/styles.md). A whole phrase
    first ("soft buttons", "like my iPhone"), then its words one by one. Never raises."""
    table = (styles_doc().get("styleWords") or {}).get("words") or {}
    out = {}
    for phrase in words:
        phrase = str(phrase).strip()
        norm = re.sub(r"\s+", " ", phrase.lower().strip("!.?,;:'\"()"))
        cands = [norm, norm[5:] if norm.startswith("like ") else None, norm[:-1] if norm.endswith("s") else None]
        ids = next((list(table[c]) for c in cands if c and c in table), None)
        if ids is None:  # look words inside a longer answer: "really soft buttons", "frosty and calm"
            hits = sorted((m.start(), k) for k in table if " " in k for m in [re.search(rf"\b{re.escape(k)}\b", norm)] if m)
            pos = 0
            for w in re.split(r"[\s/+&,]+", norm):
                pos = norm.find(w, pos)
                if w.strip("!.?,;:'\"()") in table and w not in FEEL_STOP:
                    hits.append((pos, w.strip("!.?,;:'\"()")))
            ids = []
            for _p, k in sorted(hits):
                ids += [i for i in table[k] if i not in ids]
        if ids:
            out[phrase] = list(ids)
    return out


def style_words_line(sid, lead=None):
    """'frosty -> glassmorphism: frosted see-through panels; built on the Glass preset' for one style (no final period)."""
    st = style_list()[sid]
    head = f"{lead} -> " if lead else ""
    if st.get("kind") != "look":
        return f"{head}{st['name']}: {st['plain']}; it pairs with a style rather than being one"
    pv = {"neobrutal": "neo-brutalist"}.get(st.get("preset"), st.get("preset"))
    return f"{head}{st['name']}: {st['plain']}; built on the {option_label('Q-dir-01', pv) or pv} preset"


def feel_and_looks(phrases):
    """Split a 'how should it feel?' answer: (macros, feel mapping, unknown, looks, look-only phrases, start). A phrase that is a
    whole look phrase and not a feel word ("frosty", "soft buttons") is a look only; a shared word ("bold") keeps its feel and only
    suggests looks. start: the first look-only phrase's best style, when it is a look (the sketch starts from it, as assumed)."""
    looks = look_words(phrases)
    feel_table = (levers().get("feelWords") or {}).get("words") or {}
    look_table = (styles_doc().get("styleWords") or {}).get("words") or {}

    def norm(p):
        return re.sub(r"\s+", " ", str(p).lower().strip().strip("!.?,;:'\"()"))
    suggest_only = set((styles_doc().get("styleWords") or {}).get("suggestOnly") or [])  # moods and single traits: show, never start
    look_only = [p for p in looks if norm(p) not in feel_table and norm(p) not in suggest_only
                 and (norm(p) in look_table or norm(p).removeprefix("like ") in look_table or not feel_words([p])[1])]
    macros, mapping, unknown = feel_words([p for p in phrases if p not in look_only])
    start = next((looks[p][0] for p in look_only if style_list()[looks[p][0]].get("kind") == "look"), None)
    return macros, mapping, [u for u in unknown if u not in looks], looks, look_only, start


def _merge_effects(into, eff):
    for k, v in eff.items():
        if isinstance(v, list) and isinstance(into.get(k), list):
            into[k] = into[k] + [x for x in v if x not in into[k]]
        else:
            into[k] = v
    return into


# A typed value is stored as the value, not only as reason text ("buttons 6px", "weights 400/500", "major third"; a private
# B2B landing page kept these only in --why, 2026-11-05). Answers to these questions that the person chose are locked.
HOLD_ANSWERS = {"Q-shape-01": ("overrides.radius.control",)}


def exact_answer(qid, v):
    """Effects for a stated value that is not one of the options, or {}."""
    if isinstance(v, (dict, bool)) or v is None or str(v) in (ANSWER_TABLE.get(qid) or {}):
        return {}
    text = str(v).strip().lower()
    if qid == "Q-shape-01":
        px = radius_px(text if text.endswith("px") or text == "full" else (_px_number(f"{text}px") if re.fullmatch(r"\d+(\.\d+)?", text) else None))
        if px is None:
            return {}
        return {"overrides.radius.control": "full" if px >= FULL else px,
                "dials.roundness": _band_mid("roundness", "radius.control", "full" if px >= FULL else px)}
    if qid == "Q-type-09":
        key = re.sub(r"[\s_]+", "-", text)
        if key in ANSWER_TABLE[qid]:
            return dict(ANSWER_TABLE[qid][key])
        try:
            r = float(text)
        except ValueError:
            return {}
        return {"overrides.type.ratio": r} if 1.05 <= r <= 1.7 else {}
    if qid == "Q-type-12":
        ws = sorted({int(x) for x in re.findall(r"\b[1-9]00\b", " ".join(map(str, v)) if isinstance(v, list) else text)})
        if len(ws) < 2 or ws[0] != 400 or len(ws) > 3:  # body text is 400 in every system; three weights at most on a page
            return {}
        return {"overrides.type.weightCount": len(ws), "overrides.type.headingWeight": ws[-1]}
    return {}


def answer_effects(qid, value, state=None):
    """Engine inputs implied by a questionnaire answer (ANSWER_TABLE, plus the questions whose answers are free-form).
    UNSET removes an earlier value; LABEL stands for the option's plain label. A list answer merges its options."""
    v = value
    eff = {}
    if qid == "Q-plat-01":
        plats = v if isinstance(v, list) else [v]
        return {"raw.platforms": [str(x) for x in plats if x]} if plats else {}
    if qid == "Q-type-08":
        try:
            return {"raw.baseSize": int(v)}
        except (TypeError, ValueError):
            return {}
    if qid == "Q-dir-01":  # a preset (flat2, glass, ...) or a named look from styles.md (glassmorphism, comic, ...)
        if not isinstance(v, str):
            return {}
        st = style_list(state).get(v)
        if st and st.get("kind") == "look":
            return {"preset": st.get("preset") or DEFAULT_PRESET, "style": v}
        pid = {"neo-brutalist": "neobrutal"}.get(v, v)
        cur = style_list(state).get((state or {}).get("style") or "")
        return {"preset": pid, "style": UNSET} if cur and cur.get("preset") != pid else {"preset": pid}  # same family keeps the name
    if qid == "Q-scope-06":
        surfaces = surface_list(v)
        if surfaces:
            if any(isinstance(it, dict) or (isinstance(it, str) and ":" in it) for it in (v if isinstance(v, list) else [v])):
                eff["context.surfaces"] = surfaces
            eff["raw.productType"] = SURFACE_MODES[surfaces[0]["mode"].lower()]["productType"]
            eff["raw.marketingSurfaces"] = any(x["mode"] in ("Persuade", "Experience") for x in surfaces)
        return eff
    if qid == "Q-scope-01":
        items = [str(x) for x in (v if isinstance(v, list) else [v]) if x]
        eff["context.scope.in"] = [option_label(qid, x) or x for x in items]
        if "marketing" in items:
            eff["raw.marketingSurfaces"] = True
        return eff
    if qid == "Q-tool-03":
        plans = [FIGMA_PLAN_OF.get(x) for x in (v if isinstance(v, list) else [v]) if isinstance(x, str)]
        plan = next((pl for pl in plans if pl), None)
        return {"exports.figmaPlan": plan} if plan else {}
    if qid == "Q-brand-07":
        items = v.get("principles") if isinstance(v, dict) else v
        if isinstance(items, list) and all(isinstance(x, str) for x in items) and items:
            return {"principles": [x.strip() for x in items if x.strip()]}
        return {}
    if qid == "Q-brand-01":
        if isinstance(v, dict):
            macros = []
            for row, pos in v.items():
                row = row[:1].upper()
                left, right = BRAND_ROWS.get(row, (None, None))
                if row == "D":
                    try:
                        eff["dials.energy"] = int(pos)
                    except (TypeError, ValueError):
                        pass
                    continue
                if left is None or pos is None:
                    continue
                strength = rnd(abs(float(pos) - 50) / 50, 2)
                if strength > 0:
                    macros.append({"id": left if float(pos) < 50 else right, "strength": strength})
            eff["macros"] = macros
            return eff
        words = v if isinstance(v, list) else re.split(r"\s*,\s*", str(v))
        words = [re.sub(r"^[A-G]\s+", "", w) for w in words]            # 'A playful-serious' names a slider: its left end
        words = [w.split("-")[0] if re.fullmatch(r"[a-z]+-[a-z]+", w) and w.split("-")[0] in BRAND_ROW_WORDS else w for w in words]
        macros, _m, _u = feel_words(words)
        return {"macros": macros} if macros else {}
    if isinstance(v, list) and qid in ANSWER_TABLE:
        exact = exact_answer(qid, v) if qid == "Q-type-12" else {}  # [400, 500] names weights, not options
        if exact:
            return exact
        for item in v:
            _merge_effects(eff, answer_effects(qid, item, state))
        return eff
    exact = exact_answer(qid, v)
    if exact:
        return exact
    table = ANSWER_TABLE.get(qid) or {}
    if isinstance(v, str) and v.startswith("state-") and qid == "Q-aud-02":
        return {"context.feelings+": [v[len("state-"):]]}
    row = table.get(str(v)) if not isinstance(v, (dict, list)) else None
    if row is None and isinstance(v, (int, float)) and not isinstance(v, bool):
        row = table.get(fmt_num(v))
    if not row:
        return {}
    for k, val in row.items():
        if val == LABEL:
            val = option_label(qid, v) or str(v)
        eff[k] = copy.deepcopy(val)
    if qid == "Q-type-01" and state is not None and v in ("brand-display", "brand-everywhere"):
        raw = state.get("raw") or {}
        cur = raw.get("textFace")
        if not raw.get("brandFace") and isinstance(cur, str) and not cur.startswith("=") and not _generic_face(cur):
            eff["raw.brandFace"] = cur  # keep the face the person already named as the brand face
    return eff


BRAND_ROW_WORDS = {w for pair in BRAND_ROWS.values() for w in pair if w} | {"calm"}


def answer_outcome(qid, value, state=None):
    """(effects, record kind or None, note) for an answer: what it changes, or what it shapes when it changes no token."""
    eff = answer_effects(qid, value, state)
    vals = value if isinstance(value, list) else [value]
    note = next((ANSWER_NOTES[(qid, str(x))] for x in vals if (qid, str(x)) in ANSWER_NOTES), "")
    return eff, ANSWER_RECORDS.get(qid), note


def parse_value(text):
    try:
        return json.loads(text)
    except (ValueError, TypeError):
        return text


def set_path(state, path, value):
    parts = path.split(".")
    node = state
    for q in parts[:-1]:
        if not isinstance(node.get(q), dict):
            node[q] = {}
        node = node[q]
    old = node.get(parts[-1])
    node[parts[-1]] = value
    return old


def normalize_path(path):
    if re.match(r"^Q-[a-z]+-\d+$", path):
        return "answers." + path
    m = re.match(r"^assets\.(H-[a-z]+)$", path)
    if m:
        return f"hooks.{m.group(1)}.status"
    head = path.split(".")[0]
    if head in TOP_KEYS:
        return path
    if head in DIALS:
        return "dials." + path
    return "overrides." + path  # any derived parameter or token path can be detached and set (DC-L16-14)


def is_locked(state, path):
    if any(path == lk or path.startswith(lk + ".") for lk in state.get("locks") or []):
        return True
    parts = path.split(".")
    if parts[0] in ("dials", "answers") and len(parts) >= 2:
        node = (state.get(parts[0]) or {}).get(parts[1])
        return isinstance(node, dict) and bool(node.get("locked"))
    return False


def _decision_entries(d):
    path = os.path.join(d, "decisions.md")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        heads = re.findall(r"^## (D-\d+) · (.*)$", f.read(), flags=re.M)
    return [(did, rest.split(" = ")[0].strip() if " = " in rest else "") for did, rest in heads]


def log_decision(d, path, value, why, set_by="chosen", locked=False, source_ref=None, extra=None, title=None, supersedes=None):
    """Append one decision in the spec 7.9 shape. Returns the decision id. supersedes names the entry it replaces when
    that entry has another path (a standard's grouped decision)."""
    fp = os.path.join(d, "decisions.md")
    if not os.path.exists(fp):
        write_text(fp, DECISIONS_HEADER)
    entries = _decision_entries(d)
    did = f"D-{len(entries) + 1:04d}"
    prev = [e for e, pth in entries if pth == path]
    head = title or f"{path} = {json.dumps(value, ensure_ascii=False)}"
    lines = [f"\n## {did} · {head}\n",
             f"- set_by: {set_by} · locked: {'yes' if locked else 'no'} · date: {_dt.date.today().isoformat()} · "
             f"supersedes: {supersedes or (prev[-1] if prev else 'none')} · source_ref: {source_ref or 'none'}\n",
             f"- reason: {why or '(no reason given)'}\n"]
    for e in extra or []:
        lines.append(f"- {e}\n")
    with open(fp, "a", encoding="utf-8", newline="\n") as f:
        f.writelines(lines)
    return did


DECISIONS_HEADER = ("# Decisions\n\nAppend-only, ADR-style (spec 7.9): one entry per decision, newest last. A later entry for the same "
                    "path supersedes an earlier one; nothing is edited or deleted. set_by is chosen, confirmed_default, auto_default, "
                    "assumed, delegated, reference, asset or standard.\n")


def split_status(why, set_by):
    """R3's skills put a status word at the start of --why ('delegated: ...'); read it into set_by."""
    if set_by:
        return why, SET_BY_ALIASES.get(set_by, set_by)
    m = re.match(r"^\s*(chosen|confirmed_default|auto_default|assumed|delegated|reference|asset|confirmed|default|pending)\s*:\s*(.*)$",
                 why or "", flags=re.S)
    if m:
        return m.group(2), SET_BY_ALIASES.get(m.group(1), m.group(1))
    return why, "chosen"


def _default_at(path):
    node = default_state()
    for q in path.split("."):
        node = node.get(q) if isinstance(node, dict) else None
    return copy.deepcopy(node)


def get_path(state, path):
    node = state
    for q in path.split("."):
        node = node.get(q) if isinstance(node, dict) else None
    return node


def _store(state, path, value, set_by, did, lock, via=None):
    """Write a value; dials and answers keep {value, set_by, ...} records (spec 7.10). A path ending in '+' appends to a
    list; UNSET removes an override or puts a raw input back to its default."""
    if path.endswith("+"):
        path = path[:-1]
        cur = get_path(state, path)
        lst = list(cur) if isinstance(cur, list) else []
        for x in (value if isinstance(value, list) else [value]):
            if x not in lst:
                lst.append(x)
        value = lst
    parts = path.split(".")
    if value == UNSET and parts[0] == "overrides":
        return state.setdefault("overrides", {}).pop(path.split(".", 1)[1], None)
    if value == UNSET:
        value = None if parts[0] == "dials" else _default_at(path)
    if parts[0] == "dials" and len(parts) == 2:
        old = state["dials"].get(parts[1])
        rec = dict(old) if isinstance(old, dict) else {}
        rec.update({"value": value, "set_by": set_by, "detached": value is not None, "decision": did})
        if lock:
            rec["locked"] = True
        state["dials"][parts[1]] = rec
        return dial_value(old)
    if parts[0] == "answers" and len(parts) == 2:
        old = state["answers"].get(parts[1])
        rec = dict(old) if isinstance(old, dict) else {}
        rec.update({"value": value, "set_by": set_by, "decision": did})
        if via:
            rec["via"] = via  # 'sketch': asked in the 5-question sketch; 'repo': read from their files (detect_project); both stay at zoom 0
        else:
            rec.pop("via", None)
        rec.setdefault("locked", False)
        if lock:
            rec["locked"] = True
        state["answers"][parts[1]] = rec
        return answer_value(old)
    if parts[0] == "overrides" and len(parts) >= 2:  # overrides are keyed by the whole parameter or token path
        key = path.split(".", 1)[1]
        old = state.setdefault("overrides", {}).get(key)
        state["overrides"][key] = value
    else:
        old = set_path(state, path, value)
    if lock and path not in (state.get("locks") or []):
        state.setdefault("locks", []).append(path)
    return old


EXPORT_ONLY = ("raw.textScaling", "raw.fontLicence", "exports.")


def token_diff(old_state, new_state):
    """Token paths whose value changes between two states (every token file and the resolver's modes)."""
    if state_hash(old_state) == state_hash(new_state):
        return []
    try:
        a, _m, _c = generate_system(old_state)
        b, _m2, _c2 = generate_system(new_state)
    except Exception as ex:  # a state the generator cannot read is reported, never hidden
        return [f"(tokens could not be generated: {ex})"]

    def flat(files):
        out = {}
        for fn, tree in files.items():
            if fn.endswith(".tokens.json"):
                mode = fn.split(".")[-3] if fn.count(".") >= 3 else ""
                for pth, t in flatten(tree).items():
                    out[(pth, mode)] = json.dumps(t["$value"], sort_keys=True)
        out[("modes", "")] = json.dumps(files["opendesigner.resolver.json"].get("modifiers", {}), sort_keys=True)
        return out
    fa, fb = flat(a), flat(b)
    changed = {pth for (pth, m) in set(fa) | set(fb) if fa.get((pth, m)) != fb.get((pth, m))}
    return sorted(changed, key=lambda x: (bool(PRIMITIVE_RE.match(x)), x != "color.bg.action.primary", x))  # named roles first


def change_lines(path, value, old_state, new_state, effects=None, skipped=False, held_notes=None):
    """Plain lines saying what an answer or a setting changed: tokens, or what it shapes instead (U5: never silent).
    skipped: some of an answer's effects were not applied (locked), so the tokens do not 'already match'. held_notes:
    values a dial drives that a standard holds, said instead of 'no token changed'."""
    changed = token_diff(old_state, new_state)
    lines = []
    qid = path.split(".", 1)[1] if path.startswith("answers.") else ANSWER_PATHS.get(path, (None, None))[0]
    if changed:
        ex = ", ".join(changed[:3]) + (", ..." if len(changed) > 3 else "")
        lines.append(f"tokens: {len(changed)} value{'s' if len(changed) != 1 else ''} change ({ex}). "
                     "Run `engine.py build` to refresh the tokens, exports and preview.")
    elif path.startswith("answers."):
        kind = ANSWER_RECORDS.get(qid)
        eff = effects or {}
        if eff and all(k.startswith(EXPORT_ONLY) or k.startswith("hooks.") for k in eff) and any(k.startswith(EXPORT_ONLY) for k in eff):
            lines.append(RECORD_KINDS["export"] + ".")
        elif kind:
            lines.append(RECORD_KINDS[kind] + ".")
        elif eff and skipped:
            lines.append("recorded; no token changed, because the values it would change are locked (see skipped above).")
        elif eff:
            lines.append("recorded; the tokens already match this answer.")
        else:
            lines.append(RECORD_KINDS["rule"] + ".")
    elif path.startswith(EXPORT_ONLY):
        lines.append(RECORD_KINDS["export"] + ".")
    elif path.split(".")[0] in ("dials", "raw", "overrides", "preset", "macros") and not held_notes:
        lines.append("no token changed: the system already had this value.")
    lines += ["note: " + n for n in held_notes or []]
    if qid:
        _e, _k, note = answer_outcome(qid, value)
        if note:
            lines.append("note: " + note + ".")
    return lines


# What a dry run says differently from the real set: nothing is written, so there is nothing to build and no log entry yet
DRY_WORDS = ((" Run `engine.py build` to refresh the tokens, exports and preview.", ""),
             ("(auto_default; see decisions.md)", "(auto_default; recording it adds this to decisions.md)"))


def dry_line(line):
    for a, b in DRY_WORDS:
        line = line.replace(a, b)
    return line


def _short_value(v):
    """A resolved token value in a few characters: 12px, 200ms, a hex color, a CSS shadow, else compact JSON."""
    if isinstance(v, dict) and "colorSpace" in v:
        try:
            return hex_of(v)
        except ValueError:
            pass
    text = _css_shadow(v) if isinstance(v, (dict, list)) and '"offsetX"' in json.dumps(v) else _vw(v)
    return text if len(text) <= 60 else text[:57] + "..."


def token_changes(old_state, new_state, limit=10):
    """'path: old -> new' for each token value a change moves, resolved, for a dry run: the tokens set counts, plus named
    roles that change through an alias. A token that differs by mode shows each mode that changes. Named roles come first,
    base values (primitives) last."""
    paths = token_diff(old_state, new_state)
    if not paths or paths[0].startswith("(tokens could not"):
        return []

    def views(state):
        files = generate_system(state)[0]
        mods = resolver_contexts(files["opendesigner.resolver.json"])
        out = {(): resolve_all(files, {})}
        for m, ctxs in mods.items():
            for c in ctxs:
                out[(m, c)] = resolve_all(files, {m: c})
        return mods, out, set(flatten(files.get("primitives.tokens.json") or {}))
    try:
        mods, va, base_a = views(old_state)
        _m, vb, base_b = views(new_state)
    except Exception as ex:  # a value that breaks the tokens is said, never hidden: build would stop on it
        return [f"token values: could not be worked out ({ex}); `engine.py build` would stop on this"]
    base = base_a | base_b
    show = lambda view, p: _short_value(view[p]["resolved"]) if p in view else None
    # a named role that points at a base value changes through the alias, so its file does not change: list it too
    named = {p for key in set(va) | set(vb) for p in set(va.get(key, {})) | set(vb.get(key, {}))
             if p not in base and show(va.get(key, {}), p) != show(vb.get(key, {}), p)}
    paths = sorted(set(paths) | named, key=lambda x: (x in base, x != "color.bg.action.primary", x))
    lines = []
    for p in paths:
        if p == "modes":
            lines.append("modes: the theme, density or motion modes change")
            continue
        pair = lambda key: (show(va.get(key, {}), p), show(vb.get(key, {}), p))
        by = next((m for m in mods if len({pair((m, c)) for c in mods[m]}) > 1), None)
        cells = [(None, pair(()))] if by is None else [(c, pair((by, c))) for c in mods[by]]
        parts = [(f"{c} " if c else "") + (f"new, {n}" if o is None else f"removed (was {o})" if n is None else f"{o} -> {n}")
                 for c, (o, n) in cells if o != n]
        lines.append(f"{p}: " + ("; ".join(parts) if parts else f"stays {cells[0][1][1]}"))
    if len(lines) > limit:
        rest = paths[limit:]
        lines = lines[:limit] + [f"... and {len(rest)} more" + ((" base value" + "s" * (len(rest) != 1)) if all(p in base for p in rest) else "")]
    return lines


def check_changes(old_state, new_state, limit=5):
    """The errors and warnings validate would add or clear (floors such as contrast, targets and focus, and the standards),
    for a dry run."""
    def found(state):  # one line per finding; the same finding in several mode combinations is said once, with the count
        rep = validate_generated(generate_system(state)[0], state, Report())
        out = {}
        for i in rep.items:
            if i["severity"] in ("error", "warn"):
                key = (i["severity"], re.sub(r"^permutation \{[^}]*\}: ", "", i["message"]))
                out[key] = out.get(key, 0) + 1
        return [(sev, msg + (f" (in {n} mode combinations)" if n > 1 else "")) for (sev, msg), n in out.items()]
    try:
        before, after = found(old_state), found(new_state)
    except Exception as ex:  # a state the generator cannot read is reported, never hidden
        return [f"checks: could not run ({ex})"]
    new = [x for x in after if x not in before]
    gone = [x for x in before if x not in after]
    if not new and not gone:
        return ["checks: validate would find nothing new"]
    lines = [f"checks: new {'error' if sev == 'error' else 'warning'}: {msg}" for sev, msg in new[:limit]]
    if len(new) > limit:
        lines.append(f"checks: ... and {len(new) - limit} more new findings")
    if gone:
        lines.append(f"checks: clears {len(gone)} finding{'s' if len(gone) != 1 else ''} (first: {gone[0][1]})")
    return lines


def keep_command(path, value, set_by, lock):
    """The command that records a previewed value."""
    arg = value if isinstance(value, str) and parse_value(value) == value else json.dumps(value, ensure_ascii=False)
    head = f"pick {path.split('.', 1)[1]}" if path.startswith("answers.") else f"set {path}"
    return (f"engine.py {head} {shlex.quote(arg)} --why \"<the person's words>\""
            + (f" --set-by {set_by}" if set_by != "chosen" else "") + (" --lock" if lock else ""))


def _touch(state, path):
    """The person set this path: a value an override released is theirs now, no longer the standard's (provenance)."""
    sts = state.get("standards")
    if isinstance(sts, dict) and isinstance(sts.get("untouched"), dict):
        sts["untouched"].pop(path, None)


def _effect_result(state, epath, evalue):
    """The value an answer's effect would leave at its path ('+' appends to a list; UNSET puts the default back)."""
    path = epath.rstrip("+")
    if epath.endswith("+"):
        cur = std_current(state, path)
        lst = list(cur) if isinstance(cur, list) else []
        for x in (evalue if isinstance(evalue, list) else [evalue]):
            if x not in lst:
                lst.append(x)
        return lst
    if evalue == UNSET:
        return None if path.split(".")[0] in ("overrides", "dials") else _default_at(path)
    return evalue


def std_answer_blocks(state, qid, value, effects, house=None):
    """Why a standard refuses an answer, in plain words, or None: the question is settled by a standard, the option is
    marked as breaking one, or the answer would change a value a standard holds or forbids (R11)."""
    house = house or load_standards()
    settled = std_settled_by(state, qid, house)
    if settled:
        return (f"{qid} is settled by " + "; ".join(_std_says(state, x["id"], house) for x in settled)
                + " The interview does not ask it, and nothing was recorded. Change it only if the person explicitly asked: "
                + "; ".join(f"engine.py standard remove {x['id']} --why \"<their words>\"" if x["id"].startswith("PRJ-") else
                            f"engine.py standard override {x['id']} --why \"<their words>\"" for x in settled))
    bad = std_option_breaks(state, qid, value, house)
    if bad:
        return (f"Nothing was changed: the option {bad[0][1]} for {qid} breaks a standard.\n"
                + std_lock_message(state, [], house, value=bad[0][1],
                                   breaks=[(x["id"], f"the standard lists {v} for {qid} as an option that breaks it", x) for x, v in bad]))
    msgs = []
    for epath, evalue in effects.items():
        ep = epath.rstrip("+")
        new = _effect_result(state, epath, evalue)
        holders = std_holders(state, ep)
        if holders and not _same(new, std_current(state, ep)):
            msgs.append(std_lock_message(state, holders, house, path=ep, value=new))
        elif ep.startswith("overrides.") and new is not None:
            br = std_constraint_breaks(state, ep, new, house)
            if br:
                msgs.append(std_lock_message(state, [], house, path=ep, value=new, breaks=br))
    if msgs:
        return (f"Nothing was changed: {qid} = {json.dumps(value, ensure_ascii=False)} would change a value a standard holds.\n"
                + "\n".join(msgs))
    return None


def cmd_set(d, path, value, why=None, force=False, quiet=False, set_by=None, lock=False, source_ref=None, via=None, resync=True,
            dry_run=False):
    """Record one decision. A value a standard holds or forbids is refused, also with force (force opens only the person's
    own locks); the refusal names every standard involved and how to change it. After the platforms (Q-plat-01) or the
    stack (raw.stack) change, the house standards are re-scoped to them (resync).
    dry_run: the same checks and the same report, plus each token's old and new value and what validate would add, but
    nothing is written (state.json, decisions.md, the journey log), so the person can compare values before choosing."""
    sp = os.path.join(d, "state.json")
    if not os.path.exists(sp):
        raise SystemExit(f"no state at {sp}; run `engine.py init --dir {d}` first")
    state = merge_defaults(read_json(sp))
    old_state = copy.deepcopy(state)
    path = normalize_path(path)
    if path.startswith("profile.seen."):  # the agent's own notes (a line it has said once), not a design decision
        if dry_run:
            print(f"dry run: {path} is the agent's own note, not a design decision; nothing was written")
            return state
        state.setdefault("profile", {}).setdefault("seen", {})[path.split(".", 2)[2]] = value
        dump_json(sp, state)
        if not quiet:
            print(f"noted {path} = {json.dumps(value, ensure_ascii=False)} (not a design decision, so not in decisions.md)")
        return
    why, set_by = split_status(why, set_by)
    if set_by not in SET_BY:
        raise SystemExit(f"--set-by must be one of {', '.join(SET_BY)}")
    if (path, value) in (("answers.Q-color-01", "keep-hex"), ("answers.Q-color-03", "fidelity")):
        typed, shade_id = typed_brand(d, state)  # keep the exact hex: first undo an older sketch's readable shade (STRESS-TEST 1)
        if typed and is_locked(state, "raw.brandColor") and not force:
            print(f"raw.brandColor is locked, so the hex you typed ({typed.upper()}) was not put back. "
                  "Unlock it first: engine.py unlock raw.brandColor")
        elif typed:
            put = cmd_set(d, "raw.brandColor", typed, f"{path.split('.', 1)[1]} {value}: the hex the person typed, back in place of the "
                                                       f"readable shade an older sketch put there ({shade_id})", force=force, quiet=quiet,
                          dry_run=dry_run)
            state = merge_defaults(put if dry_run else read_json(sp))
            old_state = copy.deepcopy(state)
    if set_by == "standard":  # only the standard commands write it, so every such value traces to a real standard
        raise SystemExit("--set-by standard is written only by the standard commands, so each such value traces to a real standard. "
                         "For the person's own choice use --set-by chosen; to make it a rule: engine.py standard add --rule \"...\" "
                         "--why \"...\" --source <url> --path <path> --value <json>")
    holders = std_holders(state, path)
    if holders:  # --force is for the person's own locks, never a standard's (R05); the refusal names every rule involved (R06)
        shown_v = css_easing(value) if isinstance(value, str) and "easing" in path and css_easing(value) else value
        br = std_constraint_breaks(state, path, shown_v, exclude=holders) if path.startswith("overrides.") and shown_v is not None else []
        raise SystemExit(std_lock_message(state, holders, path=path, value=shown_v, breaks=br))
    if is_locked(state, path) and not force:
        raise SystemExit(f"{path} is locked. Ask the owner before changing it, then run `engine.py unlock {path}` (or pass --force).")
    if path == "raw.stack":  # D01: react, react-native, ... from the project's package.json or the person
        items = value.split(",") if isinstance(value, str) else value if isinstance(value, list) else None
        if items is None or not all(isinstance(x, str) for x in items):
            raise SystemExit("raw.stack takes a list of stack names, for example '[\"react\"]' or react,react-native")
        value = [x.strip().lower() for x in items if x.strip()]
    if path.startswith("dials."):
        if value is not None and not (isinstance(value, (int, float)) and 0 <= value <= 100):
            raise SystemExit("A dial takes a number from 0 to 100, or null to follow the other dials.")
    if path == "style":  # one route, so the preset and the name never disagree
        raise SystemExit("The style is set by the style question: engine.py pick Q-dir-01 <style> (for example glassmorphism or comic; "
                         "engine.py feel <words> lists names). Picking a preset such as flat2 clears it.")
    look_style = style_list(state).get(value) if path == "answers.Q-dir-01" and isinstance(value, str) else None
    if path == "answers.Q-dir-01" and isinstance(value, str) and value.startswith("x-") and not look_style:
        raise SystemExit(f"Nothing was changed: {value} is an experimental style that is not saved yet. Save it first: "
                         "engine.py style explore <the same words> --save <number> (or style define).")
    if look_style and look_style.get("kind") != "look":
        raise SystemExit(f"Nothing was changed: {look_style['name']} ({look_style['plain']}) pairs with a style; it is not a style "
                         f"on its own. {look_style.get('note', '')}".rstrip())
    limits = {"raw.borderDefault": ([None, 1, 2, 3, 4], "a width in px from 1 to 4, or null to follow the style"),
              "raw.texture": ([None, "none", "grain", "halftone", "scanlines"],
                              "grain, halftone, scanlines, none (switch off a style's texture) or null to follow the style"),
              "raw.gradients": ([None, "none", "brand-only", "components"], "brand-only, components, none or null (Q-color-25)")}
    if path in limits and value not in limits[path][0]:
        raise SystemExit(f"{path} takes {limits[path][1]}.")
    if path.startswith("zoom."):
        if isinstance(value, int) and 0 <= value < len(ZOOM_LEVELS):
            value = ZOOM_LEVELS[value]
        if value not in ZOOM_LEVELS:
            raise SystemExit(f"zoom levels are {', '.join(ZOOM_LEVELS)} (or 0-3)")
        if path == "zoom.all":
            for key, _t in ZOOM_AREAS:
                cur = (state.get("zoom") or {}).get(key)
                if cur not in ZOOM_LEVELS or ZOOM_LEVELS.index(cur) < ZOOM_LEVELS.index(value):
                    state.setdefault("zoom", {})[key] = value
            path = "zoom.all"
    if path == "profile.voice" and value not in VOICES:
        raise SystemExit(f"profile.voice is one of {', '.join(VOICES)}")
    if path in ("hooks.H-logo.clearSpace", "hooks.H-logo.minSize"):  # the logo rules on the brand page (issue 49)
        bad = logo_rule_problem(path.rsplit(".", 1)[1], value)
        if bad:
            raise SystemExit(f"Nothing was changed: {bad}")
    if path == "hooks.H-icons.library" and not (isinstance(value, str) and re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value)):
        raise SystemExit("Nothing was changed: hooks.H-icons.library takes the open icon set's short name, for example \"lucide\" or \"tabler\".")
    if path.startswith("answers.Q-site-"):  # the site brief (issue 48): one row per role, proof or page family
        bad = site_problem(path.split(".", 1)[1], value)
        if bad:
            raise SystemExit(f"Nothing was changed: {bad}")
    m = re.match(r"^hooks\.(H-[a-z]+)\.status$", path)
    if m and value not in HOOK_STATUSES:
        raise SystemExit(f"hook status must be one of {', '.join(HOOK_STATUSES)}")
    plan_note = ""
    if path.startswith("overrides.") and is_param_override(path.split(".", 1)[1]):
        try:
            value = param_value(path.split(".", 1)[1], value)  # radius.control 10 once built an alias to a step that did not exist
        except ValueError as ex:
            raise SystemExit(f"Nothing was changed: {ex}.")
    if path.startswith("overrides.") and not is_param_override(path.split(".", 1)[1]) and value is not None:
        files0, meta0, _c0 = generate_system(state)
        plan = override_plan(files0, path.split(".", 1)[1], value, meta0["params"]["space.densityMode"]["value"])
        if "error" in plan:
            raise SystemExit(f"Nothing was changed: {plan['error']}.")
        value = next(iter(plan["values"].values()))  # stored in DTCG form, so the tokens stay valid
        plan_note = plan.get("note") or ""
    if path.startswith("overrides.") and value is not None:
        breaks = std_constraint_breaks(state, path, value)
        if breaks:
            raise SystemExit("Nothing was changed. " + std_lock_message(state, [], path=path, value=value, breaks=breaks))
    hold = HOLD_ANSWERS.get(path.split(".", 1)[1], ()) if path.startswith("answers.") and set_by == "chosen" else ()
    if hold:  # the person's own button shape holds across iterations; changing it needs `engine.py unlock` first
        lock = True
    if path.startswith("answers."):
        trial = copy.deepcopy(state)
        _store(trial, path, value, set_by, "D-0000", lock, via)
        blocked = std_answer_blocks(state, path.split(".", 1)[1], value, answer_effects(path.split(".", 1)[1], value, trial))
        if blocked:
            raise SystemExit(blocked)
    held_notes = []
    if path.startswith("dials.") and std_has_records(state):  # values this dial drives that a standard holds stay (R25)
        for pid, drv in lever_index().items():
            hs = std_holders(state, "overrides." + pid) if drv.get("dial") == path.split(".")[1] else []
            if hs:
                held_notes.append(f"{pid} stays {_vw(std_current(state, 'overrides.' + pid))}: "
                                  f"{'project' if hs[0].startswith('PRJ-') else 'house'} standard {hs[0]} holds it; "
                                  "everything else this dial drives follows the new value")
    entries = _decision_entries(d)
    did = f"D-{len(entries) + 1:04d}"
    last = next((e for e, pth in reversed(entries) if pth == path), None)
    by_std = std_path_decision(state, path)  # a standard's grouped decision set this path after the last entry that names it
    sup = by_std if by_std and _dnum(by_std) > _dnum(last) else None
    prev = _store(state, path, value, set_by, did, lock, via)
    extra, skipped = [], False
    if prev is not None:
        extra.append(f"previous value: {json.dumps(prev, ensure_ascii=False)}")
    if plan_note:
        extra.append(plan_note)
    effects = {}
    if path.startswith("answers."):
        qid = path.split(".", 1)[1]
        q = questions().get(qid)
        opts = option_values(q)
        vals = value if isinstance(value, list) else [value]
        custom = [str(x) for x in vals if not isinstance(x, (dict, list)) and opts and str(x) not in opts
                  and not str(x).startswith("state-") and qid not in ("Q-brand-01", "Q-scope-06", "Q-brand-07") and not look_style]
        effects = answer_effects(qid, value, state)
        if custom:
            extra.append(f"note: {', '.join(custom)} is not one of the listed options for {qid}; "
                         + ("stored as the value itself" if effects else "kept as your own answer"))
        for epath, evalue in effects.items():
            holder = std_holder(state, epath.rstrip("+"))
            if holder:  # std_answer_blocks let it through, so the standard's value already matches
                extra.append(f"{epath.rstrip('+')} already follows standard {holder}")
                continue
            if is_locked(state, epath.rstrip("+")) and not force:
                extra.append(f"skipped {epath} (locked)")
                skipped = True
                continue
            _store(state, epath, evalue, set_by, did, epath in hold)
            _touch(state, epath.rstrip("+"))
            shown = "back to the default" if evalue == UNSET else json.dumps(evalue, ensure_ascii=False)
            extra.append(f"also set: {epath.rstrip('+')} = {shown} (from {qid})")
    _touch(state, path)
    if dry_run:
        prof_line = log_profile_change(d, old_state, state, write=False)
        if not quiet:
            print(f"dry run: {path} = {json.dumps(value, ensure_ascii=False)} ({set_by}{', locked' if lock else ''}) was not recorded. "
                  "Recording it would do this:")
            for line in extra + change_lines(path, value, old_state, state, effects, skipped, held_notes) + ([prof_line] if prof_line else []):
                print("  " + dry_line(line))
            for line in token_changes(old_state, state) + check_changes(old_state, state):
                print("  " + line)
            if resync and path in ("answers.Q-plat-01", "raw.stack") and std_state(state)["house_version"] is not None:
                print("  note: recording it also re-scopes the house standards to the new platforms or stack; a dry run cannot show that part")
            print("  nothing was written: state.json, decisions.md and the journey log are unchanged. To keep it: "
                  + keep_command(path, value, set_by, lock))
        return state
    dump_json(sp, state)
    log_decision(d, path, value, why, set_by, lock, source_ref, extra, supersedes=sup)
    prof_line = log_profile_change(d, old_state, state)
    qid, how = (path.split(".", 1)[1], None) if path.startswith("answers.") else ANSWER_PATHS.get(path, (None, None))
    if qid and journey:
        if prev not in (None, "", [], {}) and prev != value:
            track(d, "step_changed", step=qid)
        track(d, "step_answered", step=qid, how=how if how and set_by == "chosen" else journey.how_for(qid, value, set_by))
    if not quiet:
        print(f"{did} set {path} = {json.dumps(value, ensure_ascii=False)} ({set_by}{', locked' if lock else ''})")
        for e in extra:
            print("  " + e)
        for line in change_lines(path, value, old_state, state, effects, skipped, held_notes):
            print("  " + line)
        if prof_line:
            print("  " + prof_line)
    if resync and path in ("answers.Q-plat-01", "raw.stack"):
        std_rescope(d, quiet=quiet)
        state = merge_defaults(read_json(sp))
    return state


def cmd_lock(d, path, on=True):
    sp = os.path.join(d, "state.json")
    state = merge_defaults(read_json(sp))
    path = normalize_path(path)
    parts = path.split(".")
    holder = None if on else std_holder(state, path)
    if holder:  # a standard's lock opens only through an override that records the person's words
        raise SystemExit(std_lock_message(state, holder))
    if parts[0] in ("dials", "answers") and len(parts) == 2:
        node = state[parts[0]].get(parts[1])
        rec = node if isinstance(node, dict) else {"value": node}
        rec["locked"] = on
        state[parts[0]][parts[1]] = rec
    else:
        locks = state.setdefault("locks", [])
        if on and path not in locks:
            locks.append(path)
        if not on and path in locks:
            locks.remove(path)
    held = HOLD_ANSWERS.get(parts[1], ()) if parts[0] == "answers" and len(parts) == 2 else ()
    for hp in held:  # the value the answer stored (Q-shape-01: the button radius) locks and unlocks with it
        _set_lock(state, hp, on)
    dump_json(sp, state)
    cur = state
    for q in parts:
        cur = cur.get(q) if isinstance(cur, dict) else None
    log_decision(d, path, answer_value(cur), "locked: change only with the owner's consent" if on else "unlocked for change",
                 "chosen", on, title=f"{'lock' if on else 'unlock'} {path}")
    print(f"{'locked' if on else 'unlocked'} {path}" + (f" and {', '.join(held)}" if held else ""))


PROTOCOL_TEMPLATE = os.path.join(SKILL_ROOT, "assets", "output", "PROTOCOL.md")


def write_protocol(d, quiet=True):
    """opendesigner/PROTOCOL.md: the project's six steps with owner gates, and the checks every round runs. Written once
    from assets/output/PROTOCOL.md; never overwritten, because the agent keeps its gates, brief and answers there."""
    fp = os.path.join(d, "PROTOCOL.md")
    if os.path.exists(fp):
        return None
    if not os.path.exists(PROTOCOL_TEMPLATE):  # an engine copied on its own (a ChatGPT project): the agent writes it
        if not quiet:
            print(f"no PROTOCOL.md template here: write {fp} from the opendesigner skill's assets/output/PROTOCOL.md")
        return None
    with open(PROTOCOL_TEMPLATE, encoding="utf-8") as f:
        write_text(fp, f.read().replace("{{date}}", _dt.date.today().isoformat()))
    if not quiet:
        print(f"wrote {fp}: the steps, gates and checks every agent follows here")
    return fp


def cmd_init(d, src=None, name=None, force=False, standards=True, detect=True):
    sp = os.path.join(d, "state.json")
    if os.path.exists(sp) and not force:
        raise SystemExit(f"{sp} already exists (use --force to replace it)")
    os.makedirs(d, exist_ok=True)
    if src:
        state = merge_defaults(read_json(src))
    else:
        state = default_state(name or "Untitled design system")
    if name:
        state["name"] = name
    dump_json(sp, state)
    dp = os.path.join(d, "decisions.md")
    if not os.path.exists(dp) or force:
        write_text(dp, DECISIONS_HEADER)
        log_decision(d, "init", None, "Start of the design system; every default traces to references/levers.json.", "auto_default",
                     title="init" + (f" from {os.path.basename(src)}" if src else " with defaults"))
    print(f"initialized {sp}")
    write_protocol(d, quiet=False)
    if detect:  # look before you ask: what the repo already answers, each recorded as assumed (detect_project)
        record_project(d, quiet=False)
    if standards:  # house standards (docs/KNOWLEDGE.md 3): applied, locked, said once; nothing when none ship
        std_sync(d, initial=True)


def record_stack(d, quiet=True):
    """Look before you ask (D01): read the stack (react, react-native, ...) from package.json in the project root and record
    it as raw.stack, set_by assumed, unless a stack is already recorded. With no package.json nothing is recorded, and the
    agent asks once. Returns the tags, or None."""
    state = merge_defaults(load_state(d))
    if (state.get("raw") or {}).get("stack") is not None:
        return None
    tags, seen = detect_stack(doc_dir(d))
    if tags is None:
        return None
    why = (f"detected from package.json ({', '.join(seen)})" if seen else "package.json names no UI framework") + \
        "; say if the stack is different"
    cmd_set(d, "raw.stack", tags, why, quiet=True, set_by="assumed", resync=False)
    if not quiet:
        print(f"  stack: {', '.join(tags) or 'no UI framework'} (from package.json)")
    return tags


# =============================================================================================
# Standards: rules from sources an owner marked non-negotiable (docs/KNOWLEDGE.md, sections 1-6)
# =============================================================================================

def standards_file():
    """House standards ship with the skill as references/standards.json; OD_STANDARDS_FILE points elsewhere (tests)."""
    return os.environ.get("OD_STANDARDS_FILE") or os.path.join(REFERENCES, "standards.json")


STD_RESERVED = ("locks", "standards", "hashes", "$schema", "schema_version", "engine_version", "levers_version", "opendesigner")
# the fields of a house standard a system keeps with its record, so what it follows (rule text, values, review check) stays
# consistent until `standards --update`, and still reads right when the house file is missing (another install)
STD_SNAPSHOT = ("id", "theme", "area", "title", "rule", "why", "strength", "values", "applies_to", "sources", "engine", "review",
                "design_md", "since", "changed", "settles", "breaks_options", "constraints", "supersedes")
REVIEW_LINE_CAP = 2000  # characters of one line a standard's pattern reads (minified files have very long lines)
_QUANT = r"(?:[+*]|\{\d*,\d*\})"
NESTED_QUANTIFIER = re.compile(r"\((?:[^()\\]|\\.)*?" + _QUANT + r"(?:[^()\\]|\\.)*\)" + _QUANT)


def _int_or(v, default):
    if isinstance(v, bool):
        return default
    if isinstance(v, int):
        return v
    if isinstance(v, float) and math.isfinite(v) and v.is_integer():
        return int(v)
    if isinstance(v, str) and v.strip().isdigit():
        return int(v.strip())
    return default


def _dnum(did):
    m = re.match(r"^D-(\d+)$", did or "") if isinstance(did, str) else None
    return int(m.group(1)) if m else 0


def _vw(v):
    """A value in plain words: 250ms, a hex color, and everything else (cubic-bezier lists, numbers) as JSON."""
    if isinstance(v, dict) and set(v) == {"value", "unit"} and isinstance(v["value"], (int, float)) and not isinstance(v["value"], bool):
        return f"{fmt_num(v['value'])}{v['unit']}"
    if isinstance(v, dict) and isinstance(v.get("hex"), str):
        return v["hex"]
    return json.dumps(v, ensure_ascii=False)


def regex_problem(pattern):
    """Why a review pattern cannot be used, in plain words, or None."""
    if not isinstance(pattern, str) or not pattern:
        return "it is not text"
    try:
        rx = re.compile(pattern)
    except re.error as ex:
        return f"it is not a valid regular expression ({ex})"
    if rx.search("") is not None:
        return "it matches an empty line, so it would flag every line"
    if NESTED_QUANTIFIER.search(pattern):
        return "it repeats a group that already repeats (like (\\w+)+), which can take minutes on one long line"
    return None


def _clean_standard(s, version):
    """A house standard with each field the engine reads in the shape it expects: a hand-edited file may hold anything,
    and one odd field never crashes a command. Returns (standard, why its review check cannot be used, or None)."""
    s = dict(s)
    since = _int_or(s.get("since"), 0)
    changed = _int_or(s.get("changed"), since)
    if isinstance(version, int):  # nothing changes after the file's own version, or --update would never settle
        since, changed = min(since, version), min(changed, version)
    s["since"], s["changed"] = since, changed
    for k in ("title", "rule", "why", "area", "strength", "theme"):
        if s.get(k) is not None and not isinstance(s[k], str):
            s[k] = None if k == "theme" else json.dumps(s[k], ensure_ascii=False)
    to = s.get("applies_to")
    to = [to] if isinstance(to, str) else to if isinstance(to, list) else []
    s["applies_to"] = [x for x in to if isinstance(x, str) and x.strip()] or ["all"]
    s["values"] = s["values"] if isinstance(s.get("values"), dict) else {}
    s["sources"] = [x for x in s["sources"] if isinstance(x, dict)] if isinstance(s.get("sources"), list) else []
    s["design_md"] = s.get("design_md", True) is not False
    # optional fields of the shared schema: questions a standard settles, options that break it, values it forbids, and the
    # Decision Cards it replaces. A field of the wrong shape is dropped, never fatal.
    ids = lambda v: [x for x in v if isinstance(x, str) and x.strip()] if isinstance(v, list) else []
    s["settles"] = ids(s.get("settles"))
    bo = s.get("breaks_options")
    s["breaks_options"] = {q: [str(x) for x in (v if isinstance(v, list) else [v]) if isinstance(x, (str, int, float))]
                           for q, v in bo.items() if isinstance(q, str)} if isinstance(bo, dict) else {}
    s["constraints"] = [c for c in s["constraints"] if _constraint_kind(c)[0] and isinstance(c.get("path"), str) and c["path"].strip()] \
        if isinstance(s.get("constraints"), list) else []
    s["supersedes"] = ids(s.get("supersedes"))
    problem = None
    rv = s.get("review")
    if not isinstance(rv, dict) or rv.get("pattern") in (None, ""):
        s["review"] = None
    else:
        problem = regex_problem(rv["pattern"])
        if problem:
            s["review"] = None
        elif rv.get("message") is not None and not isinstance(rv["message"], str):
            s["review"] = dict(rv, message=None)
    return s, problem


def load_standards():
    """House standards: {version, updated, themes, standards, retired, error, skipped}. A missing or empty file means no
    standards, and then every command behaves exactly as it did before standards existed. skipped lists review checks
    that cannot be used (a broken or unsafe pattern); the rest of that standard still applies."""
    out = {"version": None, "updated": None, "themes": [], "standards": [], "retired": [], "error": None, "skipped": []}
    path = standards_file()
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    except OSError:
        return out
    if not text.strip():
        return out
    try:
        data = json.loads(text)
    except ValueError as ex:
        return dict(out, error=f"{path} is not valid JSON ({ex}), so no house standards were used")
    if not isinstance(data, dict):
        return dict(out, error=f"{path} is not a standards file, so no house standards were used")
    raw, seen = [], set()
    for s in data.get("standards") if isinstance(data.get("standards"), list) else []:
        if isinstance(s, dict) and isinstance(s.get("id"), str) and s["id"].strip() and s["id"] not in seen:
            seen.add(s["id"])
            raw.append(s)
    ver = data.get("version")
    ver = ver if isinstance(ver, int) and not isinstance(ver, bool) else (0 if raw else None)
    stds, skipped = [], []
    for s in raw:
        clean, problem = _clean_standard(s, ver)
        stds.append(clean)
        if problem:
            skipped.append({"id": s["id"], "path": "review", "reason": f"its review pattern cannot be used: {problem}"})
    themes = [dict(t, title=t.get("title") if isinstance(t.get("title"), str) else t["key"])
              for t in (data.get("themes") if isinstance(data.get("themes"), list) else [])
              if isinstance(t, dict) and isinstance(t.get("key"), str) and t["key"]]
    retired = [dict(r, why=r.get("why") if isinstance(r.get("why"), str) else None)
               for r in (data.get("retired") if isinstance(data.get("retired"), list) else [])
               if isinstance(r, dict) and isinstance(r.get("id"), str)]
    return {"version": ver, "updated": data.get("updated") if isinstance(data.get("updated"), str) else None, "standards": stds,
            "themes": themes, "retired": retired, "error": None, "skipped": skipped}


def std_state(state):
    """state['standards'] with every key present and of the right kind. Older states have none; a hand-edited one may hold
    anything, and a value of the wrong kind is replaced by the default rather than crash a command."""
    st = state.get("standards")
    if not isinstance(st, dict):
        st = state["standards"] = {}
    hv = st.get("house_version")
    if not (hv is None or (isinstance(hv, int) and not isinstance(hv, bool))):
        st["house_version"] = None
    st.setdefault("house_version", None)
    for k in ("applied", "retired_seen"):
        v = st.get(k)
        if not isinstance(v, list) or not all(isinstance(x, str) for x in v):
            st[k] = [x for x in v if isinstance(x, str)] if isinstance(v, list) else []
    v = st.get("overridden")
    if not isinstance(v, dict) or not all(isinstance(x, dict) for x in v.values()):
        st["overridden"] = {k: x for k, x in v.items() if isinstance(x, dict)} if isinstance(v, dict) else {}
    v = st.get("project")
    if not isinstance(v, list) or not all(isinstance(x, dict) and isinstance(x.get("id"), str) for x in v):
        st["project"] = [x for x in v if isinstance(x, dict) and isinstance(x.get("id"), str)] if isinstance(v, list) else []
    v = st.get("records")
    if not isinstance(v, dict) or not all(isinstance(x, dict) for x in v.values()):
        st["records"] = {k: x for k, x in v.items() if isinstance(x, dict)} if isinstance(v, dict) else {}
    for rec in st["records"].values():
        if not isinstance(rec.get("paths"), dict):
            rec["paths"] = {}
        if "kept" in rec and not isinstance(rec["kept"], dict):
            rec["kept"] = {}
        if "prelocked" in rec and not isinstance(rec["prelocked"], list):
            rec["prelocked"] = []
    # released: {id: {state path: {why, decision, date}}}, values the person took back from a standard one by one;
    # untouched: {state path: id}, values an override released that nobody has set since; types: {token path: $type} of
    # tokens standards added, kept when the standard is released so the token keeps exporting
    v = st.get("released")
    st["released"] = {k: {p: x for p, x in r.items() if isinstance(x, dict)} for k, r in v.items() if isinstance(r, dict)} \
        if isinstance(v, dict) else {}
    for k in ("untouched", "types"):
        v = st.get(k)
        st[k] = {p: x for p, x in v.items() if isinstance(x, str)} if isinstance(v, dict) else {}
    return st


def std_has_records(state):
    """True when standards put values in this state (a cheap check for code that runs on every build)."""
    st = state.get("standards")
    return isinstance(st, dict) and isinstance(st.get("records"), dict) and bool(st["records"])


def std_engine(s):
    """A standard's engine mappings as a list (one standard may set several values)."""
    eng = s.get("engine")
    if isinstance(eng, dict):
        return [eng]
    return [x for x in eng if isinstance(x, dict)] if isinstance(eng, list) else []


def known_platforms(state):
    """The platforms the person named (Q-plat-01), or None while nobody has said."""
    rec = (state.get("answers") or {}).get("Q-plat-01")
    if rec is None:
        return None
    v = answer_value(rec)
    return {str(x).strip().lower() for x in (v if isinstance(v, list) else [v]) if x} or None


# the applies_to tags each platform brings (owner decision D01): a desktop app is built with web tech unless the stack says more
PLATFORM_TAGS = {"web": ("web", "css"), "ios": ("ios", "swift"), "android": ("android", "compose"), "desktop": ("desktop", "web", "css")}
# package.json dependencies -> stack tags (D01: look before you ask); the first match of each tag is the evidence
STACK_DEPS = (("react-native", "react-native"), ("expo", "react-native"), ("react", "react"), ("react-dom", "react"), ("next", "react"),
              ("vue", "vue"), ("nuxt", "vue"), ("svelte", "svelte"), ("@sveltejs/kit", "svelte"), ("@angular/core", "angular"),
              ("solid-js", "solid"))


def stack_of(state):
    """The recorded stack (raw.stack: react, react-native, ...), as lowercase tags."""
    v = (state.get("raw") or {}).get("stack")
    v = [v] if isinstance(v, str) else v if isinstance(v, list) else []
    return [x.strip().lower() for x in v if isinstance(x, str) and x.strip()]


def project_tags(state):
    """The applies_to tags this project matches: its platforms mapped (web -> web, css; ios -> ios, swift; android ->
    android, compose; desktop -> desktop, web, css) plus its recorded stack. None while nobody named the platforms."""
    plats = known_platforms(state)
    if plats is None:
        return None
    tags = set()
    for p in plats:
        tags |= set(PLATFORM_TAGS.get(p, (p,)))
    return tags | set(stack_of(state))


def detect_stack(root):
    """(tags, dependencies seen) from package.json in the project root; (None, []) when there is none or it cannot be read."""
    fp = os.path.join(root, "package.json")
    try:
        with open(fp, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None, []
    if not isinstance(data, dict):
        return None, []
    deps = {}
    for k in ("dependencies", "devDependencies", "peerDependencies"):
        if isinstance(data.get(k), dict):
            deps.update(data[k])
    tags, seen = [], []
    for dep, tag in STACK_DEPS:
        if dep in deps:
            seen.append(dep)
            if tag not in tags:
                tags.append(tag)
    return tags, seen


# =============================================================================================
# Look before you ask (owner direction 2026-11-02, row 3): what the person's repo already answers
# =============================================================================================

DETECT_SKIP = {"node_modules", "dist", "build", "out", ".next", ".nuxt", ".svelte-kit", ".output", "vendor", "coverage", DEFAULT_DIR,
               "Pods", "DerivedData", "venv", "env", "__pycache__", "target", "bower_components", "tmp", "temp"}
DETECT_MAX_FILES = 5000  # a whole home folder is never walked: the scan stops here and says so
DETECT_MAX_DEPTH = 6
DETECT_MAX_STYLE = 300   # style files read for the brand colour and the font, smallest paths first
OD_OWN = {"state.json", "decisions.md", "feedback.md", "RATIONALE.md", "standards.md", "PROTOCOL.md", "RULES.md",
          "overview.html", "preview.html", "coverage.md", "assets.json", "tokens", "build", "preview", "journey", "research", "review",
          "taste-indexes", "DESIGN.md", "PRODUCT.md", "DESIGN.md.hand-edited", "PRODUCT.md.hand-edited"}  # what OpenDesigner writes
CODE_EXT = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro", ".html", ".htm", ".css", ".scss", ".sass", ".less",
            ".py", ".rb", ".php", ".go", ".rs", ".swift", ".kt", ".kts", ".java", ".dart", ".cs", ".ex", ".exs"}
STYLE_EXT = {".css", ".scss", ".sass", ".less", ".html", ".htm", ".vue", ".svelte", ".astro", ".jsx", ".tsx"}
CODE_MANIFESTS = {"package.json", "pubspec.yaml", "cargo.toml", "go.mod", "pyproject.toml", "requirements.txt", "gemfile", "composer.json",
                  "build.gradle", "build.gradle.kts", "package.swift", "setup.py", "mix.exs"}
DEPLOY_FILES = {"vercel.json", "netlify.toml", "fly.toml", "render.yaml", "dockerfile", "docker-compose.yml", "docker-compose.yaml",
                "compose.yaml", "procfile", "apphosting.yaml", "firebase.json", "wrangler.toml", "wrangler.json", "wrangler.jsonc",
                "amplify.yml", "eas.json", "railway.json", "railway.toml", "serverless.yml", "staticwebapp.config.json", "now.json"}
DEPLOY_DIRS = {"fastlane", ".vercel", ".netlify"}
DOC_EXT = {".md", ".markdown", ".txt", ".rst", ".pdf", ".doc", ".docx", ".rtf", ".pages", ".key", ".pptx", ".odt"}  # notes on an idea
WEB_DEPS = ("next", "nuxt", "@sveltejs/kit", "astro", "gatsby", "@remix-run/react", "@angular/core", "react-dom", "vue", "svelte",
            "solid-js", "preact", "lit", "@builder.io/qwik", "ember-source", "vite")  # frameworks first: their name is the clearer source
GENERIC_NAMES = {"app", "my-app", "myapp", "web", "website", "site", "client", "frontend", "front-end", "project", "my-project", "untitled",
                 "vite-project", "react-app", "my-react-app", "next-app", "nextjs", "starter", "template", "demo", "test", "example", "ui",
                 "main", "root", "monorepo", "workspace", "src", "create-next-app", "hello-world"}
TEMPLATE_TEXT = re.compile(r"bootstrapped with|create-next-app|create react app|created using create-react-app|"
                           r"this template (provides a minimal setup|should help)|welcome to your expo app|^# react \+ (typescript \+ )?vite|"
                           r"generated by create next app|a new flutter project|everything you need to build a svelte project", re.I | re.M)
TEMPLATE_TITLE = re.compile(r"^\s*(vite \+ .*|vite app|create next app|react app|expo|svelte app|my app|app|home|document|untitled)\s*$", re.I)
PHASES = ["idea", "building", "near-launch", "live"]  # Q-scope-07; zoom.md, "The project's phase", has the same order
PHASE_WORDS = {"idea": "an idea, no code yet", "building": "being built", "near-launch": "close to launch", "live": "live, with real users"}
PHASE_FIRST = {"idea": "the alignment (mission, vision, purpose, goals) and the analogous product, then the sketch",
               "building": "the sketch, then the areas the screens being built need most",
               "near-launch": "an audit of what exists, then copy and voice, then preflight before release",
               "live": "an audit of what exists, then governance (who may change the system and how)"}


def project_files(root, state_dir=None):
    """(files, dirs, capped) under root, as sorted relative paths: skips dependencies, builds, hidden folders (but .github),
    OpenDesigner's own folder and what it writes, and stops after DETECT_MAX_FILES files (capped True)."""
    root = os.path.abspath(root)
    own = os.path.abspath(state_dir) if state_dir else None
    files, dirs = [], []
    for dirpath, subdirs, names in os.walk(root):
        rel = os.path.relpath(dirpath, root)
        top = rel == "."
        depth = 0 if top else rel.count(os.sep) + 1
        keep = []
        for s in sorted(subdirs):
            r = s if top else os.path.join(rel, s)
            full = os.path.join(dirpath, s)
            if full == own or (top and own == root and s in OD_OWN):
                continue
            if s.endswith((".xcodeproj", ".xcworkspace")) or s in DEPLOY_DIRS:
                dirs.append(r)  # a marker: its contents say nothing more
                continue
            if s in DETECT_SKIP or (s.startswith(".") and s != ".github"):
                continue
            dirs.append(r)
            if depth + 1 < DETECT_MAX_DEPTH:
                keep.append(s)
        subdirs[:] = keep
        for n in sorted(names):
            if top and n in OD_OWN and (own == root or n.endswith(".hand-edited") or (n in ("DESIGN.md", "PRODUCT.md")
                                                                                     and "OpenDesigner" in _read(root, n, 600))):
                continue  # what OpenDesigner wrote; a DESIGN.md or PRODUCT.md the person wrote is their notes
            files.append(n if top else os.path.join(rel, n))
            if len(files) >= DETECT_MAX_FILES:
                return files, dirs, True
    return files, dirs, False


def _read(root, rel, limit=400_000):
    try:
        with open(os.path.join(root, rel), encoding="utf-8", errors="ignore") as f:
            return f.read(limit)
    except OSError:
        return ""


def _md_plain(s):
    """Markdown or HTML inline text as plain words: images and tags dropped, links kept as their text."""
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", s)
    s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"[`*_]{1,3}", "", s)
    return re.sub(r"\s+", " ", s).strip()


def _first_sentence(s, cap=200):
    m = re.match(r"(.+?[.!?])(\s|$)", s)
    s = m.group(1) if m else s
    if len(s) > cap:
        s = s[:cap].rsplit(" ", 1)[0].rstrip(",;:") + "..."
    return s


def _readme(root, files):
    """(heading, first paragraph, file) of the README at the root, unless it is a starter template's README."""
    rel = next((f for f in files if os.sep not in f and f.lower().startswith("readme")), None)
    if not rel:
        return None, None, None
    text = _read(root, rel, 60_000)
    if TEMPLATE_TEXT.search(text[:3000]):
        return None, None, rel
    lines = text.splitlines()
    heading, para, i = None, None, 0
    while i < len(lines) and not (heading and para):
        ln = lines[i].strip()
        nxt = lines[i + 1].strip() if i + 1 < len(lines) else ""
        i += 1
        if ln.startswith("```"):
            while i < len(lines) and not lines[i].strip().startswith("```"):
                i += 1
            i += 1
        elif not ln or re.fullmatch(r"[-=*_]{3,}", ln):
            continue
        elif ln.startswith("#"):
            if heading is None and re.match(r"#\s", ln):
                heading = _md_plain(ln.lstrip("#").strip()) or None
        elif re.fullmatch(r"=+|-+", nxt):  # a setext heading: the line under it is all = or -
            if heading is None and nxt.startswith("="):
                heading = _md_plain(ln) or None
            i += 1
        elif ln.startswith("<"):  # centred HTML headers: <h1>Name</h1> and <p>what it is</p>
            m = re.match(r"<h1[^>]*>(.*?)</h1>", ln, re.I)
            if m and heading is None:
                heading = _md_plain(m.group(1)) or None
            m = re.match(r"<p[^>]*>(.*?)</p>", ln, re.I)
            words = _md_plain(m.group(1)) if m else ""
            if para is None and len(re.findall(r"[A-Za-z]{2,}", words)) >= 4:
                para = _first_sentence(words)
        elif para is None and not re.match(r"^([-*+]\s|\d+\.\s|\|)", ln):
            block = [ln.lstrip("> ").strip()]
            while i < len(lines) and lines[i].strip() and not re.match(r"^(#{1,6}\s|```|[-*+]\s|\d+\.\s|\||<)", lines[i].strip()):
                block.append(lines[i].strip().lstrip("> ").strip())
                i += 1
            words = _md_plain(" ".join(block))
            if len(re.findall(r"[A-Za-z]{2,}", words)) >= 4:  # badge rows and lone links are not a description
                para = _first_sentence(words)
    return heading, para, rel


def _nice_name(n, text=""):
    """'@acme/budget-buddy' -> 'Budget Buddy'; None for a starter's or a folder's generic name. text (the README) gives the
    product's own capitals when it spells the same name: 'opendesigner' -> 'OpenDesigner'."""
    n = str(n or "").strip()
    if n.startswith("@") and "/" in n:
        scope, n = n[1:].split("/", 1)
        if n.lower() in GENERIC_NAMES:
            n = scope
    if not n or n.lower().replace("_", "-") in GENERIC_NAMES or not re.search(r"[A-Za-z]", n):
        return None
    if re.fullmatch(r"[a-z0-9]+([-_][a-z0-9]+)*", n):
        words = re.split(r"[-_]", n)
        spelled = (m.group(1) for m in re.finditer(r"\b(" + r"[\s_-]?".join(re.escape(w) for w in words) + r")\b", text or "", re.I))
        n = next((x for x in spelled if x != x.lower()), None) or " ".join(w.capitalize() for w in words)
    return n[:60]


def _name_part(heading):
    """A README heading as a product name: 'Acme: budgets for freelancers' -> ('Acme', 'budgets for freelancers')."""
    parts = re.split(r"\s+[—–-]\s+|:\s+|\s+\|\s+", heading, maxsplit=1)
    name = parts[0].strip()
    if not name or len(name) > 60 or name.lower() in GENERIC_NAMES or name.lower() in ("readme", "about", "overview", "introduction"):
        return None, None
    return name, (parts[1].strip() if len(parts) > 1 else None)


def _json_file(root, rel):
    try:
        data = json.loads(_read(root, rel, 2_000_000))
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def _version_tuple(v):
    m = re.match(r"\s*v?(\d+)\.(\d+)(?:\.(\d+))?", str(v or ""))
    return tuple(int(x or 0) for x in m.groups()) if m else None


_CSS_SCAN = []


def _css_scan_module():
    """opendesigner-extract's css_scan.py when that skill sits beside this one (the plugin and the repo), else None."""
    if not _CSS_SCAN:
        mod = None
        path = os.path.join(os.path.dirname(SKILL_ROOT), "opendesigner-extract", "scripts", "css_scan.py")
        if os.path.exists(path):
            try:
                import importlib.util
                spec = importlib.util.spec_from_file_location("od_css_scan", path)
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
            except Exception:  # an older or broken copy: fall back to the light scan below
                mod = None
        _CSS_SCAN.append(mod)
    return _CSS_SCAN[0]


NAMED_COLOR = re.compile(r"(?:--|\b)(?:color-)?(primary|brand|accent|tint|seed)(?:[-_]?color)?(?:[-_]?(?:500|600|default))?\b[\"']?"
                         r"\s*[:=]\s*(?:Color\(0x[fF]{2}([0-9a-fA-F]{6})\)|[\"']?(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b)", re.I)


def _brand_candidate(root, style_files, code_files):
    """(hex, why, confident) for the colour the project's own buttons, links and brand tokens use most, or None."""
    css = _css_scan_module()
    if css and style_files:
        try:
            cap = css.scan_files([os.path.join(root, f) for f in style_files])
            ranked, conf = css.measure_accent(cap["values"], False, None)
        except Exception:
            ranked, conf = [], {"confidence": "none"}
        if ranked and conf.get("confidence") in ("high", "medium"):
            top = ranked[0]
            used = ", ".join(sorted(top["sources"]))
            return (normalize_hex(top["hex"]), f"the colour the CSS uses most on {used} ({top['count']} uses, "
                                                f"{conf['confidence']} confidence)", True)
        weak = ranked[0]["hex"] if ranked else None
    else:
        weak = None
    named = {}
    for f in code_files[:DETECT_MAX_STYLE]:
        for _k, flutter, hx in NAMED_COLOR.findall(_read(root, f, 300_000)):
            h = normalize_hex("#" + flutter if flutter else hx)
            if h and hex_to_oklch(h)[1] >= 0.05 and 0.1 <= hex_to_oklch(h)[0] <= 0.97:
                named.setdefault(h, [0, f])[0] += 1
    if named:
        h, (n, f) = max(named.items(), key=lambda kv: (kv[1][0], kv[0]))
        return h, f"the colour named primary, brand or accent in {f} ({n} use{'s' if n != 1 else ''})", True
    return (normalize_hex(weak), "the most colourful value in the CSS, with no button, link or brand token behind it", False) if weak else None


def _font_name(slug):
    """'plus-jakarta-sans' or 'Plus_Jakarta_Sans' -> 'Plus Jakarta Sans', with the capitals of a known open face."""
    s = re.sub(r"\s+", " ", slug.replace("_", " ").replace("-", " ").replace("+", " ")).strip()
    return {f.lower(): f for f in OPEN_FONT_NAMES}.get(s.lower()) or " ".join(w[:1].upper() + w[1:] for w in s.split())


def _is_mono(face):
    return bool(re.search(r"\b(mono|code|courier|consol)", face, re.I))


def _not_text_face(face):
    """Icon and symbol fonts (Font Awesome, Material Icons, icomoon) are never the text font."""
    return bool(re.search(r"icon|awesome|symbol|glyph|emoji|icomoon|fontello|dashicons|codicon", face, re.I))


def _font_candidate(root, style_files, code_files, deps):
    """(face, why) for the text font the project loads, or None: next/font, @fontsource and Expo font packages, Google Fonts
    links, @font-face rules, then the most common family in font-family declarations."""
    loaded = []

    def add(face, src):
        if face and not _generic_face(face) and not _not_text_face(face) and face.lower() not in {x.lower() for x, _ in loaded}:
            loaded.append((face, src))
    for f in code_files[:DETECT_MAX_STYLE]:
        t = _read(root, f, 200_000)
        for names in re.findall(r"import\s*\{([^}]+)\}\s*from\s*[\"']next/font/google[\"']", t):
            for n in names.split(","):
                n = n.split(" as ")[0].strip()
                if n:
                    add(_font_name(n), f"next/font in {f}")
        if re.search(r"from\s*[\"']geist/font/sans[\"']", t):
            add("Geist", f"the geist package in {f}")
    for dep in sorted(deps):
        m = re.match(r"^@(?:fontsource(?:-variable)?|expo-google-fonts)/(.+)$", dep)
        if m and m.group(1) not in ("dev", "vector-icons"):
            add(_font_name(m.group(1)), f"the {dep} package")
    used = {}
    for f in style_files:
        t = _read(root, f, 300_000)
        for fam in re.findall(r"fonts\.googleapis\.com/css2?\?family=([^&\"':;)]+)", t):
            add(_font_name(fam.split(":")[0]), f"a Google Fonts link in {f}")
        for body in re.findall(r"@font-face\s*\{([^}]*)\}", t):
            m = re.search(r"font-family\s*:\s*[\"']?([^;\"'}]+)", body)
            if m:
                add(m.group(1).strip(), f"an @font-face rule in {f}")
        for decl in re.findall(r"(?<![\w-])font-family\s*:\s*([^;}\n]+)", t):
            first = decl.split(",")[0].strip().strip("\"'")
            if first and "var(" not in first and not _generic_face(first) and first.lower() not in GENERIC_FONTS \
                    and not _not_text_face(first):
                used[first] = used.get(first, 0) + 1
    text_loaded = [(x, s) for x, s in loaded if not _is_mono(x)]
    top_used = sorted(((n, x) for x, n in used.items() if not _is_mono(x)), key=lambda t: (-t[0], t[1]))
    if top_used and (top_used[0][0] >= 2 or any(x.lower() == top_used[0][1].lower() for x, _ in text_loaded)):
        n, face = top_used[0]
        return face, f"the font the CSS names most ({n} font-family rule{'s' if n != 1 else ''})"
    if text_loaded:
        return text_loaded[0][0], text_loaded[0][1]
    return None


def _dark_mode(root, style_files, code_files, deps, app_json):
    """(Q-theme-01 option, why) when the project already has a dark mode, or None. A lone .dark class (a starter's CSS often
    has one) is not enough; light-only is never inferred, because a standard may forbid it."""
    if "next-themes" in deps:
        return "light-dark-toggle", "the next-themes package (light and dark, with a switch)"
    for f in style_files + code_files[:DETECT_MAX_STYLE]:
        t = _read(root, f, 300_000)
        if re.search(r"prefers-color-scheme\s*:\s*dark", t):
            return "system-light-dark", f"prefers-color-scheme: dark in {f}"
        if re.search(r"\[data-theme=[\"']?dark", t) or re.search(r"setTheme\(|toggleTheme|theme-toggle", t):
            return "light-dark-toggle", f"a theme switch in {f}"
        if re.search(r"\buseColorScheme\(", t):
            return "system-light-dark", f"useColorScheme() in {f}"
    if str(((app_json.get("expo") or {}).get("userInterfaceStyle") or "")).lower() == "automatic":
        return "system-light-dark", "userInterfaceStyle automatic in app.json"
    return None


# The site brief's readings (issue 48): page families from route names, languages from <html lang>, locale folders and
# next.config. Recorded only for a site that persuades (record_project); detect always prints them.
SITE_FAMILY_WORDS = {
    "platform": {"product", "products", "platform", "features", "feature", "integrations", "capabilities", "modules"},
    "industry": {"industries", "industry", "solutions", "use-cases", "usecases", "sectors", "verticals"},
    "explainer": {"how-it-works", "guides", "guide", "learn", "blog", "resources", "articles", "insights", "faq", "faqs", "glossary",
                  "academy"},
    "company": {"about", "about-us", "company", "team", "careers", "jobs", "contact", "contact-us", "customers", "case-studies",
                "casestudies", "stories", "testimonials", "press", "partners"},
    "pricing": {"pricing", "plans"},
    "legal": {"privacy", "privacy-policy", "terms", "terms-of-service", "tos", "legal", "cookies", "cookie-policy", "security", "trust",
              "imprint", "impressum", "gdpr", "dpa", "accessibility"},
}
ROUTE_RX = re.compile(r"^(?:src/)?(?:app|pages|routes)/(.+?)(?:/(?:page|index|\+page)\.\w+|\.(?:tsx|jsx|ts|js|mdx|md|astro|vue|svelte))$")
LANG_RX = re.compile(r"^[a-z]{2}(?:[-_][a-z]{2,4})?$", re.I)  # two-letter codes only: a three-letter file name is rarely a language
LOCALE_DIRS = {"locales", "locale", "i18n", "messages", "lang", "langs", "translations"}


def _site_family(segment):
    s = segment.lower()
    if s.startswith("for-"):
        return "industry"
    return next((fam for fam, words in SITE_FAMILY_WORDS.items() if s in words), None)


def site_readings(root, files):
    """[(path, value, source, why)] for the site brief: page families (Q-site-05) and languages (Q-site-04)."""
    out, fams = [], {}
    for f in files:
        p = f.replace(os.sep, "/")
        m = ROUTE_RX.match(p)
        if m:
            segs = [s for s in m.group(1).split("/") if not re.fullmatch(r"\(.*\)|\[.*\]|_.*|api", s)]
        elif p.lower().endswith((".html", ".htm")) and p.count("/") <= 2:
            segs = [s for s in re.sub(r"^(public|static|site|docs|dist)/", "", p).rsplit(".", 1)[0].split("/") if s != "index"]
        else:
            continue
        fam = _site_family(segs[0]) if segs else None
        if fam:
            fams.setdefault(fam, p)
    if fams:
        order = [k for k in SITE_FAMILY_WORDS if k in fams]
        ex = ", ".join(fams[k] for k in order[:3])
        out.append(("answers.Q-site-05", order, ex, f"read from the page routes ({ex})"))
    langs, srcs = [], []

    def add(code, src):
        if LANG_RX.match(code) and code.lower() not in {x.lower() for x in langs}:
            langs.append(code)
            if src not in srcs:
                srcs.append(src)
    for f in files:
        p = f.replace(os.sep, "/")
        parts = p.split("/")
        low = [x.lower() for x in parts]
        if p.lower().endswith((".html", ".htm")) or re.search(r"(^|/)app/layout\.(t|j)sx?$", p):
            m = re.search(r"<html[^>]*\blang=[\"'{]*([A-Za-z_-]{2,8})", _read(root, f, 20_000))
            if m:
                add(m.group(1), p)
        elif re.fullmatch(r"next\.config\.(js|mjs|ts|cjs)", parts[-1]):
            m = re.search(r"\blocales\s*:\s*\[([^\]]{1,300})\]", _read(root, f, 50_000))
            for code in re.findall(r"[\"']([A-Za-z_-]{2,8})[\"']", m.group(1)) if m else []:
                add(code, p)
        for i, part in enumerate(low[:-1]):
            if part in LOCALE_DIRS and i + 1 < len(parts):
                child = parts[i + 1] if i + 2 < len(parts) else parts[i + 1].rsplit(".", 1)[0]
                if parts[-1].lower().endswith((".json", ".yml", ".yaml", ".po", ".ftl", ".ts", ".js")):
                    add(child, "/".join(parts[:i + 1]) + "/")
    if langs:
        out.append(("answers.Q-site-04", {"languages": langs}, ", ".join(srcs[:3]), f"read from {', '.join(srcs[:3])}"))
    return out


def detect_project(root, state_dir=None):
    """What the project folder already says, read-only: {findings: [{path, value, source, why}], notes: [...], readme,
    files, capped}. Each finding is a state path the agent would otherwise ask about (zoom.md, level 0); notes are weaker
    signals it can mention but that are never recorded. Reads files only: no network, nothing runs, nothing is written."""
    root = os.path.abspath(root)
    files, dirs, capped = project_files(root, state_dir)
    low = {f.lower(): f for f in files}
    tops = {f.lower(): f for f in files if os.sep not in f}
    dnames = {os.path.basename(x).lower() for x in dirs}
    found, notes = [], []

    def put(path, value, source, why):
        found.append({"path": path, "value": value, "source": source, "why": why})
    pkg = _json_file(root, tops["package.json"]) if "package.json" in tops else {}
    deps = {}
    for k in ("dependencies", "devDependencies", "peerDependencies"):
        if isinstance(pkg.get(k), dict):
            deps.update(pkg[k])
    app_json = _json_file(root, tops["app.json"]) if "app.json" in tops else {}
    pubspec = _read(root, tops["pubspec.yaml"], 50_000) if "pubspec.yaml" in tops else ""
    heading, para, readme = _readme(root, files)
    readme_text = _read(root, readme, 60_000) if readme else ""
    code = [f for f in files if os.path.splitext(f)[1].lower() in CODE_EXT]
    style = sorted((f for f in files if os.path.splitext(f)[1].lower() in STYLE_EXT or os.path.basename(f).startswith("tailwind.config")),
                   key=lambda f: (f.count(os.sep), f))[:DETECT_MAX_STYLE]
    scripts = sorted((f for f in code if os.path.splitext(f)[1].lower() in {".js", ".jsx", ".ts", ".tsx", ".mjs", ".dart", ".swift", ".kt"}),
                     key=lambda f: (f.count(os.sep), f))
    title, meta_desc = None, None
    for rel in [tops.get("index.html"), low.get(os.path.join("public", "index.html")), low.get(os.path.join("src", "index.html"))] + \
            [f for f in files if re.fullmatch(r"(src/)?app/layout\.(t|j)sx?", f.replace(os.sep, "/"))]:
        if not rel:
            continue
        t = _read(root, rel, 100_000)
        m = re.search(r"<title>([^<]{1,80})</title>", t, re.I) or re.search(r"\btitle\s*:\s*[\"'`]([^\"'`]{1,80})[\"'`]", t)
        if m and not title and not TEMPLATE_TITLE.search(m.group(1)) and not TEMPLATE_TEXT.search(m.group(1)):
            title = (_md_plain(m.group(1)), rel)
        m = re.search(r"<meta\s+name=[\"']description[\"']\s+content=[\"']([^\"']{8,300})", t, re.I) or \
            re.search(r"\bdescription\s*:\s*[\"'`]([^\"'`]{8,300})[\"'`]", t)
        if m and not meta_desc and not TEMPLATE_TEXT.search(m.group(1)):
            meta_desc = (_first_sentence(_md_plain(m.group(1))), rel)

    # the product's name and what it is (Q-scope-01's words)
    name_h, tagline = _name_part(heading) if heading else (None, None)
    flutter_name = re.search(r"^name:\s*([\w-]+)", pubspec, re.M)
    expo_name = (app_json.get("expo") or {}).get("name") if isinstance(app_json.get("expo"), dict) else None
    for cand, src in ((name_h, f"the first heading of {readme}"), (title and title[0], f"the page title in {title and title[1]}"),
                      (expo_name if expo_name and not TEMPLATE_TITLE.search(str(expo_name)) else None, "the app name in app.json"),
                      (_nice_name(pkg.get("name"), readme_text), "the name in package.json"),
                      (_nice_name(flutter_name.group(1)) if flutter_name else None, "the name in pubspec.yaml")):
        if cand:
            put("name", cand, src, f"read from {src}")
            break
    desc = str(pkg.get("description") or "").strip()
    flutter_desc = re.search(r"^description:\s*[\"']?(.+?)[\"']?\s*$", pubspec, re.M)
    named = next((f["value"] for f in found if f["path"] == "name"), "")
    if named and desc.lower().startswith(named.lower()):  # 'Acme - budgets for freelancers' -> 'budgets for freelancers'
        desc = re.sub(r"^[\s:\u2014\u2013-]+", "", desc[len(named):]).strip() or desc
    for cand, src in ((para, f"the first paragraph of {readme}"),
                      (desc if desc and not TEMPLATE_TEXT.search(desc) else None, "the description in package.json"),
                      (tagline, f"the first heading of {readme}"),
                      (meta_desc and meta_desc[0], f"the page description in {meta_desc and meta_desc[1]}"),
                      (flutter_desc.group(1) if flutter_desc and not TEMPLATE_TEXT.search(flutter_desc.group(1)) else None,
                       "the description in pubspec.yaml")):
        if cand:
            put("context.product", _first_sentence(_md_plain(cand)), src, f"read from {src}")
            break

    # where it runs (Q-plat-01)
    plats, why = [], []
    native = "react-native" in deps or "expo" in deps
    desktop = "electron" in deps or any(x.startswith("@tauri-apps/") for x in deps) or "src-tauri" in dnames
    if native:
        plats += ["ios", "android"]
        why.append("react-native" if "react-native" in deps else "expo")
    if pubspec:
        sub = [p for p, dn in (("ios", "ios"), ("android", "android"), ("web", "web")) if dn in {x.lower() for x in dirs if os.sep not in x}]
        sub += ["desktop"] if {"macos", "windows", "linux"} & {x.lower() for x in dirs if os.sep not in x} else []
        plats += sub or ["ios", "android"]
        why.append("pubspec.yaml (Flutter)" + (f" with {', '.join(sub)} folders" if sub else ""))
    if desktop:
        plats.append("desktop")
        why.append("electron" if "electron" in deps else "tauri")
    if any(x.endswith((".xcodeproj", ".xcworkspace")) for x in dirs) or "package.swift" in tops:
        if "ios" not in plats:
            plats.append("ios")
            why.append("an Xcode project")
    if not native and not pubspec and ("androidmanifest.xml" in {os.path.basename(f).lower() for f in files}
                                       or "build.gradle.kts" in tops or "build.gradle" in tops):
        if "android" not in plats:
            plats.append("android")
            why.append("an Android project")
    web_dep = next((x for x in WEB_DEPS if x in deps), None)
    if not native and not desktop and not pubspec and (web_dep or any(os.path.splitext(f)[1].lower() in (".html", ".htm") for f in files)):
        plats.insert(0, "web")
        why.insert(0, web_dep or "HTML pages")
    plats = list(dict.fromkeys(plats))
    if plats:
        put("answers.Q-plat-01", plats, ", ".join(why), f"read from the files ({', '.join(why)})")

    # brand colour candidate (Q-color-01), font (raw.textFace) and dark mode (Q-theme-01)
    brand = _brand_candidate(root, style, scripts)
    if brand and brand[2]:
        put("raw.brandColor", brand[0], brand[1], f"read from the code: {brand[1]}")
    elif brand:
        notes.append(f"a possible brand colour {brand[0].upper()}: {brand[1]}, so it was not recorded")
    font = _font_candidate(root, style, scripts, deps)
    if font:
        put("raw.textFace", font[0], font[1], f"read from {font[1]}")
    dark = _dark_mode(root, style, scripts, deps, app_json)
    if dark:
        put("answers.Q-theme-01", dark[0], dark[1], f"read from {dark[1]}")
    elif any(re.search(r"(^|[\s,}])\.dark\s*[{,]", _read(root, f, 300_000)) for f in style):
        notes.append("a .dark class in your CSS but nothing that switches it on, so the light and dark question stays open")

    # the project's phase (Q-scope-07): notes and no code, idea; code without deploy config, building; deploy config, near
    # launch; a released changelog or a version past 1.0.0, live. A folder with neither code nor notes says nothing.
    content = [f for f in files if not os.path.basename(f).startswith(".")]
    notes_files = [f for f in content if os.path.splitext(f)[1].lower() in DOC_EXT or os.path.basename(f).lower().startswith("readme")]
    has_code = bool(code) or bool({os.path.basename(f).lower() for f in files} & CODE_MANIFESTS) or \
        any(x.endswith((".xcodeproj", ".xcworkspace")) for x in dirs)
    deploy = sorted({os.path.basename(f) for f in files if os.sep not in f and f.lower() in DEPLOY_FILES} |
                    {x for x in dirs if os.sep not in x and x in DEPLOY_DIRS} |
                    {f.replace(os.sep, "/") for f in files if f.replace(os.sep, "/").startswith(".github/workflows/")
                     and re.search(r"deploy|release|publish|pages|vercel|netlify|testflight|app-?store|play-?store",
                                   os.path.basename(f) + " " + _read(root, f, 50_000), re.I)})
    changelog = next((f for f in files if os.sep not in f and re.match(r"(changelog|changes|history)(\.md|\.txt)?$", f.lower())), None)
    released = None
    if changelog:
        heads = re.findall(r"^#{1,3}\s*\[?v?(\d+\.\d+(?:\.\d+)?)\]?", _read(root, changelog, 200_000), re.M)
        if heads:
            released = f"{changelog} lists released versions (latest {heads[0]})"
    versions = [(str(pkg.get("version")), "package.json")] if pkg.get("version") else []
    m = re.search(r"^version:\s*([\w.+-]+)", pubspec, re.M)
    if m:
        versions.append((m.group(1), "pubspec.yaml"))
    defaults = []
    for v, src in versions:
        vt = _version_tuple(v)
        if vt and vt > (1, 0, 0) and not released:
            released = f"version {v} in {src}"
        elif vt == (1, 0, 0):
            defaults.append(f"version {v} in {src} is the starter's default, so it says nothing about a release")
    if not released:
        notes += defaults
    if not has_code and not notes_files:
        notes.append("the folder has no code and no notes, so the phase is asked")
    elif released:
        put("answers.Q-scope-07", "live", released, f"read from the repo: {released}")
    elif has_code and deploy:
        put("answers.Q-scope-07", "near-launch", ", ".join(deploy[:3]),
            f"read from the repo: code and deploy settings ({', '.join(deploy[:3])}), but no released version yet")
    elif has_code:
        put("answers.Q-scope-07", "building", "code without deploy settings", "read from the repo: code, but no deploy settings yet")
    else:
        n = len(notes_files)
        put("answers.Q-scope-07", "idea", "notes, no code", f"read from the repo: {n} note{'s' if n != 1 else ''} "
            f"({', '.join(notes_files[:2])}) and no code yet")
    for path, value, source, why in site_readings(root, files):  # recorded only for a site that persuades (record_project)
        put(path, value, source, why)
    if capped:
        notes.append(f"the folder has more than {DETECT_MAX_FILES} files, so only the first {DETECT_MAX_FILES} were read")
    return {"root": root, "findings": found, "notes": notes, "files": len(files), "capped": capped,
            "readme": {"file": readme, "heading": heading, "paragraph": para} if readme else None}


DETECT_LABELS = {"name": "name", "context.product": "what it is", "answers.Q-plat-01": "where it runs", "raw.stack": "code stack",
                 "raw.brandColor": "brand colour", "raw.textFace": "font", "answers.Q-theme-01": "light and dark",
                 "answers.Q-scope-07": "phase", "answers.Q-site-04": "site languages", "answers.Q-site-05": "page families"}


def detect_value_words(path, value):
    if path == "answers.Q-scope-07":
        return PHASE_WORDS.get(value, value)
    if path == "answers.Q-theme-01":
        return answer_words("Q-theme-01", value)
    if path == "raw.brandColor":
        return f"{str(value).upper()} ({color_words(value)})"
    if path == "raw.stack" and not value:
        return "no UI framework"
    if path == "answers.Q-site-04" and isinstance(value, dict):
        return ", ".join(value.get("languages") or [])
    if path == "answers.Q-site-05" and isinstance(value, list):
        return ", ".join(option_label("Q-site-05", x) or x for x in value)
    if isinstance(value, list):
        return ", ".join(str(x) for x in value)
    return str(value)


def _already_set(state, decs, path):
    """True when the person (or an earlier step) already gave this value, so a repo reading must not replace it."""
    if path == "name":
        return state.get("name") not in (None, "", "Untitled design system")
    if path.startswith("answers."):
        return path.split(".", 1)[1] in (state.get("answers") or {})
    if path == "raw.textFace":
        return (state.get("raw") or {}).get("textFace") not in (None, "system") or path in decs
    v = get_path(state, path)
    return v not in (None, "", [], {}) or path in decs


def record_project(d, quiet=True):
    """Look before you ask (zoom.md, level 0): record what detect_project reads from the project folder, each as set_by
    assumed with its source in the reason, unless it is already answered. The stack comes from record_stack. A value a
    standard or a lock holds is left alone. Returns the findings recorded (each with its plain words)."""
    state = merge_defaults(load_state(d))
    decs = _decisions(d)
    got = detect_project(doc_dir(d), d)
    done = []
    for f in got["findings"]:
        if _already_set(state, decs, f["path"]) or std_holders(state, f["path"]) or is_locked(state, f["path"]):
            continue
        if f["path"].startswith("answers.Q-site-") and not site_surface(state):
            continue  # the site brief is only for a site that persuades
        why = f["why"] + "; say if that's wrong"
        try:
            cmd_set(d, f["path"], f["value"], why, quiet=True, set_by="assumed", resync=False,
                    via="repo" if f["path"].startswith("answers.") else None)
        except SystemExit:  # a standard rules the value out: nothing recorded, the question stays open
            continue
        state = merge_defaults(load_state(d))
        done.append(dict(f, words=detect_value_words(f["path"], f["value"])))
    tags = record_stack(d)
    if tags is not None:
        done.append({"path": "raw.stack", "value": tags, "source": "package.json", "why": "detected from package.json",
                     "words": ", ".join(tags) or "no UI framework"})
    if not quiet:
        for line in detect_lines(done):
            print(line)
    return done


def detect_lines(done, lead="read from your repo (recorded as assumed; say if any is wrong):"):
    if not done:
        return []
    return [f"  {lead}"] + [f"    {DETECT_LABELS.get(f['path'], f['path'])}: {f['words']} ({f['source']})" for f in done]


def cmd_detect(d, project=None, as_json=False):
    """engine.py detect: what the project folder already answers, before any question (read-only; nothing is written)."""
    root = project or doc_dir(d)
    got = detect_project(root, d if os.path.isdir(d) else None)
    st = state_or_none(d)
    state = merge_defaults(st) if st else None
    decs = _decisions(d) if st else {}
    tags, seen = detect_stack(root)
    if tags is not None:
        got["findings"].append({"path": "raw.stack", "value": tags, "source": "package.json",
                                "why": f"detected from package.json ({', '.join(seen)})" if seen else "package.json names no UI framework"})
    for f in got["findings"]:
        f["words"] = detect_value_words(f["path"], f["value"])
        f["recorded"] = bool(state) and _already_set(state, decs, f["path"])
    if as_json:
        print(json.dumps(got, indent=2, ensure_ascii=False))
        return 0
    print(f"Read {got['files']} files in {got['root']} (nothing was written).")
    if not got["findings"]:
        print("Nothing in the folder answers a sketch question yet: ask them.")
    for f in got["findings"]:
        print(f"  {DETECT_LABELS.get(f['path'], f['path'])}: {f['words']} ({f['source']})"
              + ("  [already recorded]" if f["recorded"] else ""))
    for n in got["notes"]:
        print(f"  note: {n}")
    if got.get("readme") and got["readme"].get("paragraph"):
        print(f"  README says: \"{got['readme']['paragraph']}\" (for the line on what they're trying to do)")
    print("Confirm each in one line instead of asking it (zoom.md, level 0). init and sketch record them as assumed.")
    return 0


def std_applies(s, state):
    """False only when the standard names platforms or stacks and this project's tags are known and all outside them."""
    to = s.get("applies_to") or ["all"]
    to = {str(x).strip().lower() for x in (to if isinstance(to, list) else [to])}
    tags = project_tags(state)
    return "all" in to or tags is None or bool(to & tags)


def std_current(state, path):
    """The value a state path holds now (overrides are keyed by the whole token path; dials and answers are records)."""
    parts = path.split(".")
    if parts[0] == "overrides" and len(parts) > 1:
        return (state.get("overrides") or {}).get(path.split(".", 1)[1])
    if parts[0] == "dials" and len(parts) == 2:
        return dial_value((state.get("dials") or {}).get(parts[1]))
    if parts[0] == "answers" and len(parts) == 2:
        return answer_value((state.get("answers") or {}).get(parts[1]))
    return get_path(state, path)


def _same(a, b):
    """True when two values are equal, numbers by value (1 and 1.0 are the same), lists and objects item by item."""
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return a == b
    if isinstance(a, dict) and isinstance(b, dict):
        return set(a) == set(b) and all(_same(a[k], b[k]) for k in a)
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return len(a) == len(b) and all(_same(x, y) for x, y in zip(a, b))
    return a == b


def _finite(v):
    if isinstance(v, float):
        return math.isfinite(v)
    if isinstance(v, dict):
        return all(_finite(x) for x in v.values())
    if isinstance(v, list):
        return all(_finite(x) for x in v)
    return True


def shown_path(path):
    """overrides.motion.easing.exit -> motion.easing.exit: the name a person types with `engine.py set`."""
    return path.split(".", 1)[1] if path.startswith("overrides.") else path


OPEN_STATE_MAPS = ("references.", "taste.", "blocks.", "zoom.", "profile.", "waivers.", "components.notes.")


def _state_path_known(path):
    node = default_state()
    for q in path.split("."):
        if not isinstance(node, dict):
            return False
        if q not in node:
            return not node or path.startswith(OPEN_STATE_MAPS)
        node = node[q]
    return True


def _std_base(state, cache):
    """Tokens and validation errors of the state before a standard's value is tried (computed once per batch)."""
    if "files" not in cache:
        try:
            cache["files"] = generate_system(state)[0]
            rep = Report()
            validate_files(cache["files"], state, rep)
        except Exception as ex:  # a state the generator cannot read: every value is reported as not mapped, never a crash
            raise ValueError(f"the engine cannot build this system's tokens ({ex})")
        cache["errors"] = {i["message"] for i in rep.items if i["severity"] == "error"}
    return cache["files"]


def _trial_types(items):
    """{override key: $type} for the (state path, type) pairs of values tried before any standard record names them."""
    return {sp.split(".", 1)[1]: typ for sp, typ in items if typ and sp.startswith("overrides.")}


def _std_trial(state, sp, value, cache, types=None):
    """Build the system with the value in place: a value the generator cannot use, or one that breaks a check the engine
    enforces (accessibility floors outrank every standard, KNOWLEDGE.md 2), is refused. types: {override key: $type}
    of the values tried (see _trial_types)."""
    _std_base(state, cache)
    trial = copy.deepcopy(state)
    try:
        _store(trial, sp, value, "standard", "D-0000", False)
        files = generate_system(trial, types)[0]
        rep = Report()
        validate_files(files, trial, rep)
    except Exception as ex:  # a bad value is reported as not mapped, never a crash
        raise ValueError(f"the engine cannot build the tokens with {json.dumps(value, ensure_ascii=False)} at {shown_path(sp)} ({ex})")
    new = [i["message"] for i in rep.items if i["severity"] == "error" and i["message"] not in cache["errors"]]
    if new:
        raise ValueError(f"it would break a check the engine enforces: {new[0]}")


def std_target(state, path, value, typ=None, cache=None, trial=True):
    """Where one engine value of a standard goes: (state path, value as stored). Token paths go through the same plan as
    `engine.py set` (existing tokens keep their type; new tokens land in the files of their group), and every value is
    tried in a trial build. Raises ValueError, in plain words, when the engine cannot take it: an unknown path, a value
    of the wrong kind, or one that breaks a validation check."""
    if not isinstance(path, str) or not path.strip():
        raise ValueError("the mapping has no path")
    if not _finite(value):
        raise ValueError("the value is not a finite number")
    sp = normalize_path(path.strip())
    parts = sp.split(".")
    if parts[0] in STD_RESERVED or any(not q.strip() for q in parts):
        raise ValueError(f"{sp} is not a setting a standard can hold")
    if parts[0] in ("overrides", "dials", "answers") and len(parts) < 2:
        raise ValueError(f"{sp} is a group of settings; name one of them")
    cache = {} if cache is None else cache
    if parts[0] == "overrides" and not is_param_override(sp.split(".", 1)[1]):
        key = sp.split(".", 1)[1]
        files = _std_base(state, cache)
        try:
            plan = override_plan(files, key, value, files["opendesigner.meta.json"]["params"]["space.densityMode"]["value"], typ)
        except Exception as ex:
            raise ValueError(f"the engine cannot read {json.dumps(value, ensure_ascii=False)} for {key} ({ex})")
        if "error" in plan:
            raise ValueError(plan["error"])
        if typ and plan.get("type") and typ != plan["type"]:
            raise ValueError(f"{plan['path']} is a {plan['type']} token, but the standard gives a {typ}")
        value = next(iter(plan["values"].values()))
        if trial:
            _std_trial(state, sp, value, cache, _trial_types([(sp, typ)]))
        return sp, value
    if parts[0] == "overrides":
        value = param_value(sp.split(".", 1)[1], value)  # a lever parameter: a radius or icon size first, then the trial build
    elif parts[0] == "dials":
        if len(parts) != 2 or parts[1] not in DIALS:
            raise ValueError(f"{sp} is not a dial; the dials are {', '.join(DIALS)}")
        if value is not None and not (isinstance(value, (int, float)) and not isinstance(value, bool) and 0 <= value <= 100):
            raise ValueError("a dial takes a number from 0 to 100")
    elif parts[0] == "answers":
        if len(parts) != 2 or (questions() and parts[1] not in questions()):
            raise ValueError(f"{sp} is not a question in questions.json")
    elif not _state_path_known(sp):
        raise ValueError(f"{sp} is not a setting in state.json")
    else:
        default = _default_at(sp)
        if isinstance(default, dict) and not isinstance(value, dict):
            raise ValueError(f"{sp} is a group of settings; name one of them")
        if isinstance(default, list) and not isinstance(value, list):
            raise ValueError(f"{sp} takes a list")
    if trial:
        _std_trial(state, sp, value, cache)
    return sp, value


def _std_batch_check(state, items, cache):
    """items [(key, state path, value, $type or None)] -> {key: reason} for the values a trial build refuses. One build
    when they all pass; otherwise each is tried on top of the ones accepted before it, so a bad pair is caught too."""
    if not items:
        return {}
    try:
        _std_base(state, cache)
    except ValueError as ex:
        return {k: str(ex) for k, _sp, _v, _t in items}
    types = _trial_types([(sp, t) for _k, sp, _v, t in items])
    try:
        trial = copy.deepcopy(state)
        for _k, sp, v, _t in items:
            _store(trial, sp, v, "standard", "D-0000", False)
        rep = Report()
        validate_files(generate_system(trial, types)[0], trial, rep)
        if not [i for i in rep.items if i["severity"] == "error" and i["message"] not in cache["errors"]]:
            return {}
    except Exception:  # found one by one below
        pass
    bad, acc, seen = {}, copy.deepcopy(state), []
    for k, sp, v, t in items:
        try:
            _std_trial(acc, sp, v, cache, _trial_types(seen + [(sp, t)]))
            _store(acc, sp, v, "standard", "D-0000", False)
            seen.append((sp, t))
        except Exception as ex:
            bad[k] = str(ex)
    return bad


def std_snapshot(s):
    return {k: copy.deepcopy(s[k]) for k in STD_SNAPSHOT if k in s}


def std_copy(state, sid, house):
    """A house standard as this system follows it: the copy kept when it was last applied (so rule text and locked values
    agree until `standards --update`), else the house file's."""
    snap = (std_state(state)["records"].get(sid) or {}).get("std")
    if isinstance(snap, dict) and snap.get("id") == sid:
        return snap
    return next((s for s in house["standards"] if s["id"] == sid), None)


def std_find(state, sid, house=None):
    """(standard, kind) for an id. kind is 'project', 'house', or 'gone': a house standard this system still follows by its
    recorded copy although the house file here does not list it. (None, None) when unknown."""
    st = std_state(state)
    for s in st["project"]:
        if s.get("id") == sid:
            return s, "project"
    for s in (house or load_standards())["standards"]:
        if s["id"] == sid:
            return s, "house"
    rec = st["records"].get(sid)
    if isinstance(rec, dict) and not str(sid).startswith("PRJ-"):
        snap = rec.get("std") if isinstance(rec.get("std"), dict) else {}
        return dict(snap, id=sid, rule=snap.get("rule") or rec.get("rule") or ""), "gone"
    return None, None


def _std_rank(sid):
    """Project standards outrank house ones, and a newer project standard outranks an older one (KNOWLEDGE.md 2)."""
    m = re.match(r"^PRJ-(\d+)$", sid)
    return (0, -int(m.group(1))) if m else (1, 0)


def std_held(state, exclude=None):
    """{state path: standard id} for every path an active standard locks (house ones not overridden, project ones), less
    the values the person took back one by one; when two hold one path, the higher-ranked one is named."""
    st = std_state(state)
    held = {}
    for sid, rec in sorted(st["records"].items(), key=lambda kv: _std_rank(kv[0])):
        if sid == exclude or sid in st["overridden"] or not rec.get("locked", True):
            continue
        rel = st["released"].get(sid) or {}
        for p in rec.get("paths") or {}:
            if p not in rel:
                held.setdefault(p, sid)
    return held


def std_holders(state, path, exclude=()):
    """Every active standard that locks this path (or a path above it), highest-ranked first."""
    st = std_state(state)
    out = []
    for sid, rec in sorted(st["records"].items(), key=lambda kv: _std_rank(kv[0])):
        if sid in exclude or sid in st["overridden"] or not rec.get("locked", True):
            continue
        rel = st["released"].get(sid) or {}
        if any(p not in rel and (path == p or path.startswith(p + ".")) for p in rec.get("paths") or {}):
            out.append(sid)
    return out


def std_holder(state, path):
    """The id of the active standard that locks this path (or a path above it), else None."""
    got = std_holders(state, path)
    return got[0] if got else None


def std_beaten(state):
    """{house standard id: project standard id} for house standards a project standard beats (standard add --beats): the
    person's source always wins, so their review checks and constraints are off in this project (owner decision D03)."""
    out = {}
    for s in std_state(state)["project"]:
        for sid in s.get("beats") or [] if isinstance(s.get("beats"), list) else []:
            if isinstance(sid, str):
                out.setdefault(sid, s["id"])
    return out


def std_followed(state, house=None, all_platforms=False):
    """The house standards this system follows now, as it follows them: applied, not overridden as a whole, and (unless
    all_platforms) for its platforms."""
    house = house or load_standards()
    st = std_state(state)
    out = [std_copy(state, i, house) for i in st["applied"] if i not in st["overridden"]]
    return [s for s in out if s and (all_platforms or std_applies(s, state))]


# ---- constraints: values a token may not take while a standard applies (shared schema, R06)

def _constraint_kind(c):
    """(kind, limit) of one constraint: ('accelerating-curve', None) or ('max-duration-ms', 300.0); (None, None) when it
    cannot be read. The limit may sit in forbid ({"max-duration-ms": {"value": 300}}), in value, or next to forbid."""
    if not isinstance(c, dict):
        return None, None
    f = c.get("forbid")
    if isinstance(f, dict) and len(f) == 1:
        kind, lim = next(iter(f.items()))
    elif isinstance(f, str):
        kind, lim = f, c.get("value", c.get(f))
    else:
        kind = next((k for k in ("accelerating-curve", "max-duration-ms") if k in c), None)
        lim = c.get(kind) if kind else None
    if kind == "accelerating-curve":
        return kind, None
    if kind == "max-duration-ms":
        lim = lim.get("value") if isinstance(lim, dict) else lim
        if isinstance(lim, (int, float)) and not isinstance(lim, bool) and math.isfinite(lim):
            return kind, float(lim)
    return None, None


def _end_slope(x1, y1, x2, y2):
    for x, y in ((x2, y2), (x1, y1), (0, 0)):  # a control point on the end point leaves the slope to the one before it
        if (x, y) != (1, 1):
            return (1 - y) / (1 - x) if x != 1 else (math.inf if y < 1 else -math.inf)
    return 1.0


def _start_slope(x1, y1, x2, y2):
    for x, y in ((x1, y1), (x2, y2), (1, 1)):
        if (x, y) != (0, 0):
            return y / x if x != 0 else (math.inf if y > 0 else -math.inf)
    return 1.0


def curve_accelerates(v):
    """True for a cubic-bezier that ends faster than it starts, like ease-in [0.42, 0, 1, 1] or [0.3, 0, 1, 1]: its end
    slope is over 1 and over its start slope. ease-out, ease-in-out, ease and linear are not."""
    v = css_easing(v) if isinstance(v, str) else v
    if not (isinstance(v, list) and len(v) == 4 and all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in v)):
        return False
    end, start = _end_slope(*v), _start_slope(*v)
    return end > 1 and end > start


def duration_ms(v):
    """Milliseconds of a duration value ({value, unit}, 250, '250ms', '0.3s'), else None."""
    if isinstance(v, dict) and isinstance(v.get("value"), (int, float)) and not isinstance(v.get("value"), bool):
        return float(v["value"]) * (1000 if v.get("unit") == "s" else 1) if v.get("unit") in ("ms", "s", None) else None
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    m = re.fullmatch(r"\s*(\d+(?:\.\d+)?)(ms|s)\s*", v) if isinstance(v, str) else None
    return float(m.group(1)) * (1000 if m.group(2) == "s" else 1) if m else None


def constraint_problem(c, value):
    """Why a value breaks one constraint, in plain words, or None. A transition is read by its curve and duration."""
    kind, lim = _constraint_kind(c)
    parts = [value]
    if isinstance(value, dict) and ("timingFunction" in value or "duration" in value):
        parts = [value.get("timingFunction"), value.get("duration")]
    if kind == "accelerating-curve":
        for x in parts:
            if curve_accelerates(x):
                return f"{_vw(css_easing(x) if isinstance(x, str) else x)} speeds up as it ends, like ease-in"
    elif kind == "max-duration-ms":
        for x in parts:
            n = duration_ms(x) if not isinstance(x, list) else None
            if n is not None and n > lim:
                return f"{fmt_num(n)}ms is longer than {fmt_num(lim)}ms"
    return None


def _token_key(path):
    """overrides.dark:motion.easing.exit -> motion.easing.exit: the token path a constraint's pattern reads."""
    return split_mode_key(shown_path(path))[1]


def std_constraints(state, house=None):
    """[(standard id, constraint, standard)] for the standards this system follows now: applied house ones (not overridden,
    not beaten by a project standard) and project ones."""
    st = std_state(state)
    beaten = std_beaten(state)
    stds = [s for s in std_followed(state, house) if s["id"] not in beaten] + list(st["project"])
    out = []
    for s in stds:
        for c in s.get("constraints") or [] if isinstance(s.get("constraints"), list) else []:
            if _constraint_kind(c)[0] and isinstance(c.get("path"), str) and c["path"].strip():
                out.append((s["id"], c, s))
    return out


def std_constraint_breaks(state, path, value, house=None, exclude=(), constraints=None):
    """[(standard id, why, standard)] for every constraint the value at this path breaks. A value the person took back
    from a standard (standard override --path) is not held to that standard's constraints."""
    st = std_state(state)
    key = _token_key(path)
    out = []
    for sid, c, s in (constraints if constraints is not None else std_constraints(state, house)):
        if sid in exclude or not fnmatch.fnmatchcase(key, c["path"].strip()):
            continue
        rel = st["released"].get(sid) or {}
        if any(_token_key(p) == key for p in rel):
            continue
        why = constraint_problem(c, value)
        if why and not any(x[0] == sid for x in out):
            out.append((sid, why, s))
    return out


def std_settled_by(state, qid, house=None):
    """The standards this system follows that settle a question (their answer fixes it, so the interview does not ask it)."""
    st = std_state(state)
    return [s for s in std_followed(state, house) + list(st["project"]) if qid in (s.get("settles") or [])]


def std_option_breaks(state, qid, value, house=None):
    """[(standard, option)] for each chosen option of a question that a standard this system follows lists as breaking it."""
    st = std_state(state)
    vals = [str(x) for x in (value if isinstance(value, list) else [value]) if not isinstance(x, (dict, list))]
    out = []
    for s in std_followed(state, house) + list(st["project"]):
        bad = (s.get("breaks_options") or {}).get(qid) if isinstance(s.get("breaks_options"), dict) else None
        for v in vals:
            if isinstance(bad, list) and v in [str(x) for x in bad]:
                out.append((s, v))
    return out


def std_path_decision(state, path):
    """The latest decision in which a standard put a value at this path, or None. The grouped decisions do not name paths
    in their titles, so the supersede chain and DESIGN.md read them from the records."""
    if not std_has_records(state):
        return None
    best = None
    for rec in state["standards"]["records"].values():
        if isinstance(rec, dict) and isinstance(rec.get("paths"), dict) and path in rec["paths"] and _dnum(rec.get("decision")) > _dnum(best):
            best = rec["decision"]
    return best


def _std_says(state, sid, house):
    """'house standard STD-x: its rule. Why: its reason.' for one standard."""
    kind = "your project standard" if sid.startswith("PRJ-") else "house standard"
    s = (std_find(state, sid, house)[0] if sid.startswith("PRJ-") else std_copy(state, sid, house) or std_find(state, sid, house)[0]) or {}
    rule = (s.get("rule") or "").strip().rstrip(".")
    why = (s.get("why") or "").strip().rstrip(".")
    return f"{kind} {sid}" + (f": {rule}." if rule else ".") + (f" Why: {why}." if why else "")


def std_lock_message(state, sid=None, house=None, path=None, value=None, breaks=None):
    """Why a value cannot change, in plain words: every standard that holds the path and every standard whose rule the new
    value breaks, each with its rule and why, then the command that changes it, only when the person explicitly asks. sid
    is one id or a list of them (the holders); with path alone the holders are looked up."""
    house = house or load_standards()
    holders = [sid] if isinstance(sid, str) else list(sid or [])
    if path and not holders and not breaks:
        holders = std_holders(state, path)
    breaks = list(breaks or [])
    shown = shown_path(path) if path else None
    val = f" --value '{json.dumps(value, ensure_ascii=False)}'" if value is not None and shown else ""
    prj = [h for h in holders if h.startswith("PRJ-")]
    out = []
    if len(holders) == 1:
        out.append(f"This follows {_std_says(state, holders[0], house)}")
    elif holders:
        out.append(f"{shown or 'This value'} follows {len(holders)} standards:")
        out += [f"  - {_std_says(state, h, house)}" for h in holders]
    for bsid, why, _s in breaks:
        out.append(f"{_vw(value) if value is not None else 'This value'} breaks {_std_says(state, bsid, house)} ({why})")
    how = []
    if prj:
        how.append(f"engine.py standard remove {prj[0]} --why \"<their words>\", then set the new value"
                   + (" (the house standards above take the value back unless they are overridden too)" if len(holders) > len(prj) else ""))
    elif holders:
        how.append(f"engine.py standard override {holders[0]} --why \"<their words>\"" + (f" --path {shown}{val}" if shown else "")
                   + (" --all-holders" if len(holders) > 1 else ""))
    for bsid, _w, _s in breaks:
        how.append(f"engine.py standard remove {bsid} --why \"<their words>\"" if bsid.startswith("PRJ-") else
                   f"engine.py standard override {bsid} --why \"<their words>\"")
    out.append("Change it only if the person explicitly asked: " + "; then ".join(how) + ("." if prj else ""))
    return (" " if len(out) == 2 else "\n").join(out)


def _set_lock(state, path, on):
    locks = state.setdefault("locks", [])
    if not isinstance(locks, list):
        locks = state["locks"] = []
    if on and path not in locks:
        locks.append(path)
    elif not on and path in locks:
        locks.remove(path)
    parts = path.split(".")
    if parts[0] in ("dials", "answers") and len(parts) == 2 and isinstance((state.get(parts[0]) or {}).get(parts[1]), dict):
        state[parts[0]][parts[1]]["locked"] = on


def _release(state, paths, sid, rec=None):
    """Unlock (never revert) the paths a standard held. A path stays locked when another active standard still holds it,
    or when the person had locked it before the standard arrived; a recommended default never locked anything. Returns
    the paths it unlocked."""
    rec = rec or {}
    if rec.get("locked", True) is False:
        return []
    held = std_held(state, exclude=sid)
    mine = set(rec.get("prelocked") or [])
    out = []
    for p in paths:
        if p in held or p in mine:
            continue
        _set_lock(state, p, False)
        out.append(p)
    return out


def _next_did(d):
    return f"D-{len(_decision_entries(d)) + 1:04d}"


def _kept_words(who, sp, v, cur, recommended=False):
    """One line for a value a standard did not set because a higher rule holds it (KNOWLEDGE.md 2: said, never silent)."""
    path = shown_path(sp)
    if who.startswith(("PRJ-", "STD-")):
        kind = "project" if who.startswith("PRJ-") else "house"
        if recommended:
            return (f"{path} already holds this value under {kind} standard {who}" if _same(cur, v) else
                    f"{kind} standard {who} wins over this recommended default for {path}; it stays {_vw(cur)}")
        return f"kept {kind} standard {who}'s value for {path}; the standard gives {_vw(v)}"
    if who == "locked":
        return f"kept the person's own locked value for {path}; the standard gives {_vw(v)}"
    return f"kept the person's own value ({who}) for {path}; the standard gives {_vw(v)}"


def _kept_note(who, sp, cur):
    """The same, for listings: what holds the path instead of the standard."""
    path = shown_path(sp)
    if who.startswith("PRJ-"):
        return f"project standard {who} wins for {path} (it holds {_vw(cur)})"
    if who.startswith("STD-"):
        return f"house standard {who} wins for {path} (it holds {_vw(cur)})"
    if who == "locked":
        return f"the person's own locked value {_vw(cur)} is kept for {path}"
    return f"the person's own value {_vw(cur)} is kept for {path} ({who})"


def std_apply(d, state, stds, did, force=False, locked=True, set_by="standard", only=None, show_old=False):
    """Store each standard's engine values (locked, unless it is a recommended default) and record which decision holds
    them. Precedence follows KNOWLEDGE.md 2, and every conflict is said in a line, never settled silently:
    - a higher-ranked standard that locks the path keeps it (a newer project standard, or a project one over a house one);
    - a recommended default (locked=False) never moves a value a standard locks;
    - unless force, a value the person chose after any standard last set it, locked themselves, or took back from this
      standard (standard override --path), stays theirs.
    only: the state paths to (re)apply; the rest of each record stays as it is. show_old: say the value each one replaced
    ('= new (was old)'). Returns (lines, unmapped)."""
    st = std_state(state)
    decs = _decisions(d)
    lines, unmapped, cache = [], [], {}
    plan = {}  # (standard index, mapping index) -> ("ok", path, value) | ("kept", path, value, who) | ("bad", reason) | ("skip",)
    for si, s in enumerate(stds):
        held = std_held(state, exclude=s["id"])
        rec0 = st["records"].get(s["id"]) or {}
        own = set(rec0.get("paths") or {}) if s["id"] not in st["overridden"] else set()
        pre = set(rec0.get("prelocked") or [])
        for ei, eng in enumerate(std_engine(s)):
            try:
                sp, v = std_target(state, eng.get("path"), eng.get("value"), eng.get("type"), cache, trial=False)
            except Exception as ex:  # a bad mapping in a house file is reported as not mapped, never a crash
                plan[(si, ei)] = ("bad", str(ex) if isinstance(ex, ValueError) else f"the engine cannot use it ({ex})")
                continue
            if only is not None and sp not in only:
                plan[(si, ei)] = ("skip",)
                continue
            same = _same(std_current(state, sp), v)
            other = held.get(sp)
            mine = decs.get(sp) if (decs.get(sp) or {}).get("set_by") == "chosen" else None
            if mine and _dnum(mine["id"]) <= _dnum(std_path_decision(state, sp)):
                mine = None  # a standard set this path after the person's choice (a restore, a project standard)
            person_lock = is_locked(state, sp) and ((not other and sp not in own) or sp in pre)
            taken = (st["released"].get(s["id"]) or {}).get(sp)
            if taken and not force:
                plan[(si, ei)] = ("kept", sp, v, taken.get("decision") or "locked")
            elif other and not locked:
                plan[(si, ei)] = ("kept", sp, v, other)
            elif other and _std_rank(other) < _std_rank(s["id"]) and not same:
                plan[(si, ei)] = ("kept", sp, v, other)
            elif not force and not same and (person_lock or mine):
                plan[(si, ei)] = ("kept", sp, v, mine["id"] if mine else "locked")
            else:
                plan[(si, ei)] = ("ok", sp, v)
    ok = [(k, x[1], x[2], std_engine(stds[k[0]])[k[1]].get("type")) for k, x in plan.items() if x[0] == "ok"]
    for k, reason in _std_batch_check(state, ok, cache).items():
        plan[k] = ("bad", reason)
    for si, s in enumerate(stds):
        sid = s["id"]
        rec0 = st["records"].get(sid) or {}
        if only is None:
            rec = {"paths": {}, "decision": did, "locked": locked}
        else:
            rec = copy.deepcopy(rec0) if rec0 else {"paths": {}, "locked": locked}
            rec["decision"] = did
        if not sid.startswith("PRJ-"):
            rec["std"] = std_snapshot(s)
        pre = [p for p in rec0.get("prelocked") or [] if p in (rec0.get("paths") or {})]
        bad = []
        if not std_engine(s) and only is None:
            carriers = [x for x, on in (("DESIGN.md", s.get("design_md", True)), ("review", bool(s.get("review")))) if on]
            lines.append(f"{sid}: followed; it sets no values" + (f" ({' and '.join(carriers)} carr{'y' if len(carriers) > 1 else 'ies'} it)"
                                                                   if carriers else ""))
        for ei, eng in enumerate(std_engine(s)):
            step = plan[(si, ei)]
            if step[0] == "skip" or (step[0] == "bad" and only is not None):
                continue
            if step[0] == "bad":
                unmapped.append({"id": sid, "path": eng.get("path"), "reason": step[1]})
                bad.append({"path": eng.get("path"), "reason": step[1]})
                lines.append(f"{sid}: not mapped ({eng.get('path')}: {step[1]})")
                continue
            sp, v = step[1], step[2]
            rec["paths"].pop(sp, None)
            rec.get("kept", {}).pop(sp, None)
            cur = std_current(state, sp)
            if step[0] == "kept":
                rec.setdefault("kept", {})[sp] = step[3]
                lines.append(f"{sid}: " + _kept_words(step[3], sp, v, cur, recommended=not locked))
                continue
            if locked and sp not in pre and is_locked(state, sp) and sp not in std_held(state):
                pre.append(sp)  # the person locked it before this standard: releasing the standard leaves their lock
            _store(state, sp, v, set_by, did, False)
            st["untouched"].pop(sp, None)
            typ = eng.get("type")
            if isinstance(typ, str) and typ in DTCG_TYPES and sp.startswith("overrides.") and not is_param_override(sp.split(".", 1)[1]):
                st["types"][sp.split(".", 1)[1]] = typ  # kept after a release, so a token the standard added keeps exporting
            if sp.startswith("answers."):
                for epath, evalue in answer_effects(sp.split(".", 1)[1], v, state).items():
                    if not is_locked(state, epath.rstrip("+")):
                        _store(state, epath, evalue, set_by, did, False)
            if locked:
                _set_lock(state, sp, True)
                for osid, orec in st["records"].items():  # a recommended default this standard now outranks
                    if osid != sid and orec.get("locked", True) is False and sp in orec["paths"] and not _same(orec["paths"][sp], v):
                        orec["paths"].pop(sp)
                        orec.setdefault("kept", {})[sp] = sid
                        lines.append(f"{sid}: {shown_path(sp)} follows this standard; it outranks the recommended default {osid}")
            rec["paths"][sp] = v
            old = cur if cur is not None or not isinstance(show_old, dict) else show_old.get(sp)
            was = f" (was {_vw(old)})" if show_old is not False and old is not None and not _same(old, v) else ""
            lines.append(f"{sid}: {shown_path(sp)} = {_vw(v)}{was}{'' if locked else ' (unlocked)'}")
        if only is None:
            rec.pop("unmapped", None)
            if bad:
                rec["unmapped"] = bad
        if pre:
            rec["prelocked"] = pre
        else:
            rec.pop("prelocked", None)
        if not rec.get("kept"):
            rec.pop("kept", None)
        st["records"][sid] = rec
        if sid not in st["applied"] and not sid.startswith("PRJ-"):
            st["applied"].append(sid)
    return lines, unmapped


def _maps_now(state, s, rec, cache):
    """True when a value of this standard that was not mapped can be applied now (the engine or the mapping was fixed)."""
    failed = {str(u.get("path")) for u in rec.get("unmapped") or [] if isinstance(u, dict)}
    for eng in std_engine(s):
        if str(eng.get("path")) in failed:
            try:
                std_target(state, eng.get("path"), eng.get("value"), eng.get("type"), cache)
                return True
            except Exception:
                continue
    return False


def std_differs(snap, s):
    """True when a house standard says something different from the copy a system keeps: its rule, the values it sets, or
    what it forbids, settles or marks as breaking it. Other fields (wording of why, sources, review message) do not count."""
    if not isinstance(snap, dict):
        return True
    eng = lambda x: [(m.get("path"), m.get("value"), m.get("type")) for m in std_engine(x)]
    return not (_same(snap.get("rule"), s.get("rule")) and _same(eng(snap), eng(s))
                and all(_same(snap.get(k) or [], s.get(k) or []) for k in ("constraints", "settles"))
                and _same(snap.get("breaks_options") or {}, s.get("breaks_options") or {}))


def std_pending(state, house, retry=False):
    """What the house file asks of this system that it does not do yet:
    new      applicable standards not applied (and not overridden), for example after the platforms changed;
    changed  applied ones whose rule, values or constraints changed after the system's house version;
    refresh  applied ones the house file moved to a newer version without changing any of those (their copy is refreshed
             quietly, with no decision);
    retired  retired entries this system still follows, and (when the house file is present) ids it follows that the file
             no longer lists: a standard never simply disappears, so its lock is released;
    off      applied ones that no longer apply to the person's platforms (unlocked, not reverted);
    kept     overridden ones that changed (they stay the person's);
    retry    (retry=True only, it runs trial builds) applied ones with a value not mapped that the engine can apply now;
    older    True when the house file here is older than the one this system follows (an older skill install): then
             nothing is pending, so nothing is released or downgraded."""
    st = std_state(state)
    hv = st["house_version"] or 0
    out = {"new": [], "changed": [], "refresh": [], "retired": [], "kept": [], "off": [], "retry": [], "older": False}
    if house["version"] is not None and st["house_version"] is not None and house["version"] < st["house_version"]:
        return dict(out, older=True)
    applied, over = set(st["applied"]), st["overridden"]
    cache = {}
    for s in house["standards"]:
        rec = st["records"].get(s["id"]) or {}
        if s["id"] in over:
            if st["house_version"] is not None and max(s["since"], s["changed"]) > hv:
                out["kept"].append(s)
        elif s["id"] not in applied:
            if std_applies(s, state):
                out["new"].append(s)
        elif not std_applies(s, state):
            out["off"].append(s)
        elif s["changed"] > hv:
            out["changed" if std_differs(rec.get("std"), s) else "refresh"].append(s)
        elif retry and rec.get("unmapped") and _maps_now(state, s, rec, cache):
            out["retry"].append(s)
    live = {s["id"] for s in house["standards"]}
    listed = {r["id"] for r in house["retired"]}
    retired = [r for r in house["retired"] if r["id"] not in live and r["id"] not in st["retired_seen"]
               and (r["id"] in applied or r["id"] in over)]
    if house["version"] is not None and not house["error"]:
        retired += [{"id": sid, "why": "it is no longer in the house standards file"} for sid in list(st["applied"]) + list(over)
                    if sid not in live and sid not in listed and not sid.startswith("PRJ-") and sid not in st["retired_seen"]]
    seen = set()
    for r in retired:
        if r["id"] not in seen:
            seen.add(r["id"])
            out["retired"].append(r)
    return out


def std_older_words(hv, sv):
    return (f"Your OpenDesigner skill is older than this design system: it ships house standards v{hv}, and this system follows "
            f"v{sv}. Update the skill (AGENTS.md, \"Installing it in each host\"), then run engine.py standards --update")


def _plural(n, one, many):
    return f"{n} {one if n == 1 else many}"


def _keep_types(st, s):
    """Keep the $type of each token a standard added, so the token keeps exporting after the standard is released."""
    for eng in std_engine(s or {}):
        path, typ = eng.get("path"), eng.get("type")
        if isinstance(path, str) and path.strip() and isinstance(typ, str) and typ in DTCG_TYPES:
            sp = normalize_path(path.strip())
            if sp.startswith("overrides.") and not is_param_override(sp.split(".", 1)[1]):
                st["types"].setdefault(sp.split(".", 1)[1], typ)


def _last_decision(decs, state, sp):
    """The decision that last set a state path: its own entry in decisions.md or a standard's grouped decision."""
    a, b = (decs.get(sp) or {}).get("id"), std_path_decision(state, sp)
    return a if _dnum(a) >= _dnum(b) else b


def supersedes_words(by_path):
    """{state path: decision id} -> 'D-0002 (motion.easing.exit), D-0005 (motion.duration.medium)'; many paths of one
    decision are counted instead of listed."""
    by_id = {}
    for p, did in by_path.items():
        if did:
            by_id.setdefault(did, []).append(shown_path(p))
    if not by_id:
        return None
    if len(by_id) == 1 and len(by_path) == 1:
        return next(iter(by_id))
    return ", ".join(f"{did} ({', '.join(ps) if len(ps) <= 3 else _plural(len(ps), 'value', 'values')})"
                     for did, ps in sorted(by_id.items(), key=lambda kv: _dnum(kv[0])))


def _ids_words(ids, limit=6):
    """A short id list inline; a long one only counted (the full list goes in a folded line of the decision)."""
    return f" ({', '.join(ids)})" if ids and len(ids) <= limit else ""


def _ids_folded(ids, limit=6):
    return [f"<details><summary>{_plural(len(ids), 'standard', 'standards')}</summary> {', '.join(ids)}</details>"] \
        if len(ids) > limit else []


def _theme_of(house, st):
    """{standard id: (theme title, area)} from the house file, and from the copies kept for standards it no longer lists."""
    titles = {t["key"]: t.get("title") or t["key"] for t in house["themes"]}
    out = {}
    for sid, rec in st["records"].items():
        snap = rec.get("std") if isinstance(rec.get("std"), dict) else {}
        if snap.get("theme"):
            out[sid] = (titles.get(snap["theme"], snap["theme"]), snap.get("area"))
    for s in house["standards"]:
        key = s.get("theme") if isinstance(s.get("theme"), str) and s.get("theme") else "other"
        out[s["id"]] = (titles.get(key, key), s.get("area"))
    return out


def group_lines(lines, themes, counts):
    """Standard lines ('STD-x: ...') under one heading per theme, with its areas and counts, in the order they came."""
    order, groups, areas = [], {}, {}
    for line in lines:
        sid = line.split(":", 1)[0]
        title, area = themes.get(sid, ("Other", None))
        if title not in groups:
            order.append(title)
            groups[title], areas[title] = [], []
        groups[title].append(line)
        if area and area not in areas[title]:
            areas[title].append(area)
    out = []
    for title in order:
        words = ", ".join(f"{n} {k}" for k, n in (counts.get(title) or {}).items() if n)
        out.append(title + (f" ({', '.join(areas[title])})" if areas[title] else "") + (f": {words}" if words else ""))
        out += ["  " + x for x in groups[title]]
    return out


def std_scope_lines(state, house, now, gone):
    """After the platforms or the stack changed: one line of counts for the project, then one per theme."""
    tags = project_tags(state) or set()
    themes = _theme_of(house, std_state(state))
    per = {}
    for s in house["standards"]:
        key = themes.get(s["id"], ("Other", None))[0]
        c = per.setdefault(key, {"apply": 0, "do not": 0, "now apply": 0, "no longer apply": 0})
        c["apply" if std_applies(s, state) else "do not"] += 1
        c["now apply"] += s["id"] in now
        c["no longer apply"] += s["id"] in gone
    total = sum(c["apply"] for c in per.values())
    head = (f"House standards for {', '.join(sorted(tags)) or 'these platforms'}: {total} apply"
            + (f", {len(now)} newly applied" if now else "") + (f"; {len(gone)} no longer apply (their values stay, unlocked)" if gone else "")
            + ". By theme:")
    return [head] + [f"  {title}: " + ", ".join(f"{n} {k}" for k, n in c.items() if n) for title, c in per.items()]


def _token_values(state):
    """{state path of a token: its resolved value}, to say what a standard replaced ('was 150ms'). {} when the system cannot
    be built."""
    try:
        files = generate_system(state)[0]
        return {"overrides." + p: t.get("resolved") for p, t in resolve_all(files, {}).items()}
    except Exception:  # only the 'was' part of a line is lost, never the update
        return {}


def std_sync(d, initial=False, quiet=False, scope_only=False, result=None):
    """Bring a system up to the house standards: apply new and changed ones (locked, set_by standard), never touch an
    overridden one, unlock (not revert) retired ones and ones the person's platforms left, retry values that were not
    mapped, and record it all as one grouped decision. Returns the lines.
    scope_only: after the platforms or the stack changed, only apply the standards that now apply and release the ones that
    no longer do (a newer house file still waits for --update), and say it in one line per theme.
    result: a dict that gets changed (True when state.json changed) and summary (the lines said for scope_only)."""
    result = {} if result is None else result
    result.setdefault("changed", False)
    say = (lambda *a: None) if quiet else print
    house = load_standards()
    if house["error"] and not scope_only:
        say("Note: " + house["error"] + ".")
    if house["version"] is None:
        if not initial and not house["error"] and not scope_only:
            n = len(std_state(merge_defaults(read_json(os.path.join(d, "state.json"))))["applied"]) \
                if os.path.exists(os.path.join(d, "state.json")) else 0
            say(f"The house standards file is missing here ({standards_file()}), so there is nothing to update. This system keeps "
                f"the {_plural(n, 'standard', 'standards')} it follows." if n else
                "No house standards ship with this skill yet (references/standards.json), so there is nothing to update.")
        return []
    sp = os.path.join(d, "state.json")
    state = merge_defaults(load_state(d))
    st = std_state(state)
    if not house["standards"] and not house["retired"] and not st["applied"] and not st["overridden"]:
        if not initial and not scope_only:
            say("No house standards ship with this skill yet (references/standards.json), so there is nothing to update.")
        return []
    p = std_pending(state, house, retry=not initial and not scope_only)
    hv, sv = house["version"], st["house_version"]
    if p["older"]:
        if initial or scope_only:
            return []
        raise SystemExit(std_older_words(hv, sv) + " again. Nothing was changed.")
    if scope_only:
        p = dict(p, new=[s for s in p["new"] if s["since"] <= (sv or 0)], changed=[], refresh=[], retired=[], retry=[], kept=[])
    for s in p["refresh"]:
        st["records"][s["id"]]["std"] = std_snapshot(s)
    if not (p["new"] or p["changed"] or p["retired"] or p["off"] or p["retry"]):
        bump = not scope_only and (sv is None or sv < hv)
        if bump or p["refresh"]:
            st["house_version"] = hv if bump else sv
            dump_json(sp, state)
            result["changed"] = True
        if not initial and not scope_only:
            say(f"This system already follows OpenDesigner's house standards v{hv}."
                + (f" {_plural(len(p['refresh']), 'standard was', 'standards were')} reworded, with the same rule and values."
                   if p["refresh"] else "")
                + (f" {_plural(len(p['kept']), 'standard you overrode has', 'standards you overrode have')} changed since "
                   f"({', '.join(s['id'] for s in p['kept'])}); {'it stays' if len(p['kept']) == 1 else 'they stay'} yours."
                   if p["kept"] else ""))
        return []
    did = _next_did(d)
    todo = p["new"] + p["changed"] + p["retry"]
    before = {sid: set(rec.get("paths") or {}) for sid, rec in st["records"].items()}
    themes = _theme_of(house, st)  # before any record is dropped, so a retired standard keeps its theme
    decs = _decisions(d)
    targets, cache = set(), {}
    for s in todo:
        for eng in std_engine(s):
            try:
                targets.add(std_target(state, eng.get("path"), eng.get("value"), eng.get("type"), cache, trial=False)[0])
            except Exception:
                continue
    prev = {x: _last_decision(decs, state, x) for x in targets}
    old = {x: std_current(state, x) for x in targets}
    changed_rules = [s for s in p["changed"] if not _same((st["records"].get(s["id"], {}).get("std") or {}).get("rule"), s.get("rule"))]
    lines, unmapped = std_apply(d, state, todo, did, show_old=_token_values(state) if not initial else False)
    lines += [f"{s['id']}: the rule now reads: {s.get('rule')}" for s in changed_rules]
    for s in p["changed"] + p["retry"]:
        rec = st["records"].get(s["id"]) or {}
        _release(state, before.get(s["id"], set()) - set(rec.get("paths") or {}) - set(rec.get("kept") or {}), s["id"], rec)
    for s in p["off"]:
        rec = st["records"].pop(s["id"], {}) or {}
        _keep_types(st, rec.get("std") or s)
        _release(state, rec.get("paths") or {}, s["id"], rec)
        st["applied"].remove(s["id"])
        st["released"].pop(s["id"], None)
        lines.append(f"{s['id']}: no longer applies to your platforms ({', '.join(s.get('applies_to') or [])} only); "
                     "its values stay, unlocked")
    for r in p["retired"]:
        rec = st["records"].pop(r["id"], {}) or {}
        _keep_types(st, rec.get("std"))
        _release(state, rec.get("paths") or {}, r["id"], rec)
        if r["id"] in st["applied"]:
            st["applied"].remove(r["id"])
        st["overridden"].pop(r["id"], None)
        st["released"].pop(r["id"], None)
        st["retired_seen"].append(r["id"])
        lines.append(f"{r['id']}: retired ({r.get('why') or 'no reason given'}); its values stay, unlocked")
    for s in p["kept"]:
        lines.append(f"{s['id']}: changed in the house file, but the person overrode it, so it stays theirs")
    if not scope_only:
        st["house_version"] = hv
    dump_json(sp, state)
    result["changed"] = True
    failed = {}
    for u in unmapped:
        failed[u["id"]] = failed.get(u["id"], 0) + 1
    none_mapped = [s for s in todo if std_engine(s) and failed.get(s["id"], 0) >= len(std_engine(s))]
    k = len(todo) - len(none_mapped)
    ids = [s["id"] for s in todo] + [s["id"] for s in p["off"]] + [r["id"] for r in p["retired"]]
    sup = supersedes_words({x: prev[x] for x in sorted(targets) if prev.get(x) and not _same(old.get(x), std_current(state, x))})
    if initial:
        title = (f"House standards v{hv}: {k} applied" + (f", {len(none_mapped)} not mapped" if none_mapped else "") + _ids_words(ids))
        why = ("OpenDesigner's house standards (sources marked non-negotiable) are applied without asking and locked. Change one "
               "only when the person asks: engine.py standard override <id> --why \"<their words>\".")
        counts = ""
    elif scope_only:
        counts = (f"{len(p['new'])} now apply, {len(p['off'])} no longer apply")
        title = f"House standards v{sv} for {', '.join(sorted(project_tags(state) or [])) or 'these platforms'}: {counts}" + _ids_words(ids)
        why = ("The platforms or the stack changed, so the house standards were re-scoped: the ones that now apply are applied and "
               "locked; the ones that no longer apply are unlocked, not reverted.")
    else:
        counts = (f"{len(p['new'])} new, {len(p['changed'])} changed, {len(p['retired'])} retired"
                  + (f", {len(p['off'])} no longer for these platforms" if p["off"] else "")
                  + (f", {len(p['retry'])} now mapped" if p["retry"] else ""))
        title = f"House standards v{hv}: {counts}" + _ids_words(ids)
        why = ("House standards update (engine.py standards --update). Overridden standards stay the person's; retired ones, and "
               "ones for other platforms, are unlocked, not reverted.")
    log_decision(d, "standards", None, why, "standard", True, source_ref=f"standards.json v{hv}", extra=_ids_folded(ids) + lines,
                 title=title, supersedes=sup)
    areas = sorted({s.get("area") for s in todo if s.get("area") and s not in none_mapped})
    tcounts = {}
    for label, group in (("new", p["new"]), ("changed", p["changed"]), ("now mapped", p["retry"]),
                         ("no longer for these platforms", p["off"]), ("retired", p["retired"])):
        for x in group:
            c = tcounts.setdefault(themes.get(x["id"], ("Other", None))[0], {})
            c[label] = c.get(label, 0) + 1
    if initial:
        say(f"Applied {_plural(k, 'OpenDesigner house standard', 'OpenDesigner house standards')} (v{hv})"
            + (f" for {', '.join(areas)}" if areas else "") + ". They are locked; say if you want to change one "
            "(`engine.py standards` lists them).")
    elif scope_only:
        result["summary"] = [f"{did}: " + x if i == 0 else x
                             for i, x in enumerate(std_scope_lines(state, house, {s["id"] for s in p["new"]}, {s["id"] for s in p["off"]}))]
        for line in result["summary"]:
            say(line)
    else:
        say(f"{did} house standards v{hv}: {counts}" + (f" ({', '.join(areas)})" if areas else "") + ". By theme:")
        for line in group_lines(lines, themes, tcounts):
            say("  " + line)
        say("  Run `engine.py build` to put the new values in the tokens and exports.")
    if unmapped:
        say(f"  {_plural(len(unmapped), 'standard value', 'standard values')} could not be applied; "
            "`engine.py standards` lists them as not mapped.")
    return lines


def std_refit(d, state):
    """After the platforms or the stack changed (issue 68): a token value a standard holds that a check now refuses, such
    as a 44 px touch target once Android needs 48, goes back to the engine's own value and is recorded as not mapped,
    as a fresh sketch for these platforms does. A value the person set or locked is never changed; the conflict is said.
    Changes state in place and returns (lines, conflicts)."""
    try:
        rep = Report()
        validate_files(generate_system(state)[0], state, rep)
    except Exception:  # a state the generator cannot read is validate's to report
        return [], []
    errors = [i for i in rep.items if i["severity"] == "error" and i.get("where")]
    st, held, decs = std_state(state), std_held(state), _decisions(d)
    lines, conflicts = [], []
    for i in errors:
        sp = "overrides." + i["where"]
        if std_current(state, sp) is None:
            continue  # the engine's own value: nothing stored to give back
        sid = held.get(sp)
        rec = st["records"].get(sid) or {}
        mine = decs.get(sp) if (decs.get(sp) or {}).get("set_by") == "chosen" else None
        if mine and sid and _dnum(mine["id"]) <= _dnum(std_path_decision(state, sp)):
            mine = None  # the standard set it after the person's choice
        if not sid or mine or sp in (rec.get("prelocked") or []):
            if mine or is_locked(state, sp):
                conflicts.append(f"{shown_path(sp)} stays {_vw(std_current(state, sp))}, as "
                                 + (f"you set it ({mine['id']})" if mine else "you locked it") + f", but these platforms refuse it: "
                                 f"{i['message']}. Nothing was changed. {i.get('fix') or ''}".rstrip()
                                 + (f" It is locked: engine.py unlock {sp}, then set it." if is_locked(state, sp) else ""))
            continue
        trial = copy.deepcopy(state)
        _store(trial, sp, UNSET, "standard", "D-0000", False)
        try:
            rep2 = Report()
            validate_files(generate_system(trial)[0], trial, rep2)
        except Exception:
            continue
        left = {x["message"] for x in rep2.items if x["severity"] == "error"}
        if i["message"] in left or left - {x["message"] for x in errors}:
            continue  # giving the value back does not clear this error, or breaks another check
        v = rec["paths"].pop(sp)
        _store(state, sp, UNSET, "standard", "D-0000", False)
        _set_lock(state, sp, False)
        rec["unmapped"] = [u for u in rec.get("unmapped") or [] if u.get("path") != i["where"]] + [
            {"path": i["where"], "reason": f"it would break a check the engine enforces: {i['message']}"}]
        lines.append(f"{sid}: {shown_path(sp)} went back to the engine's own value for these platforms; "
                     f"{_vw(v)} would break a check ({i['message']})")
    return lines, conflicts


def std_rescope(d, quiet=False):
    """After Q-plat-01 or raw.stack is recorded: re-scope the house standards to the project's tags (only when the system
    already follows them), quietly, and return the per-theme lines to say. Then std_refit: a value a standard holds that
    the new platforms refuse goes back to the engine's own, and a value of the person's that they refuse is said."""
    state = merge_defaults(load_state(d))
    if std_state(state)["house_version"] is None:
        return []
    res = {}
    std_sync(d, quiet=True, scope_only=True, result=res)
    lines = res.get("summary") or []
    state = merge_defaults(load_state(d))
    refit, conflicts = std_refit(d, state)
    if refit:
        dump_json(os.path.join(d, "state.json"), state)
        did = _next_did(d)
        log_decision(d, "standards", None, "The platforms changed, so a value a standard held no longer passes a check the engine "
                     "enforces (accessibility floors outrank every standard, KNOWLEDGE.md 2). It went back to the engine's own "
                     "value, as a fresh sketch for these platforms does.", "standard", False, extra=refit,
                     title=f"House standards: {_plural(len(refit), 'value', 'values')} back to the engine's own for these platforms")
        lines += [f"{did}: " + refit[0]] + refit[1:]
    lines += conflicts
    if not quiet:
        for line in lines:
            print("  " + line)
    return lines


def std_unmapped(state, house):
    """Dry run: every engine value (house and project) the engine cannot take now, as {id, path, reason}. Values already
    applied at this house version are not tried again."""
    st = std_state(state)
    out, cache, items = [], {}, []
    followed = [s for s in (std_copy(state, i, house) for i in st["applied"]) if s]
    ids = {s["id"] for s in followed}
    for s in followed + [s for s in house["standards"] if s["id"] not in ids] + st["project"]:
        rec = st["records"].get(s["id"]) or {}
        for eng in std_engine(s):
            try:
                sp, v = std_target(state, eng.get("path"), eng.get("value"), eng.get("type"), cache, trial=False)
            except Exception as ex:
                out.append({"id": s["id"], "path": eng.get("path"), "reason": str(ex)})
                continue
            done = sp in (rec.get("paths") or {}) or sp in (rec.get("kept") or {})
            if not (done and _int_or(s.get("changed"), 0) <= (st["house_version"] or 0)):
                items.append(((s["id"], eng.get("path")), sp, v, eng.get("type")))
    for (sid, path), reason in _std_batch_check(state, items, cache).items():
        out.append({"id": sid, "path": path, "reason": reason})
    return out


def _values_words(values, limit=4):
    items = list((values or {}).items()) if isinstance(values, dict) else []
    words = ", ".join(f"{k} `{v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)}`" for k, v in items[:limit])
    return words + (", ..." if len(items) > limit else "")


def std_by_theme(house, stds):
    """[(theme title, [standards])] in the order of the house file's themes."""
    order = [(t["key"], t.get("title") or t["key"]) for t in house["themes"]]
    known = {k for k, _t in order}
    key_of = lambda s: s.get("theme") if isinstance(s.get("theme"), str) and s.get("theme") else "other"
    order += [(k, k) for k in sorted({key_of(s) for s in stds} - known)]
    return [(title, [s for s in stds if key_of(s) == key]) for key, title in order if any(key_of(s) == key for s in stds)]


def cmd_standards(d, as_json=False, update=False, show_all=False, result=None):
    """engine.py standards: the person's project standards and overrides first, then the house standards this system
    follows (only the ones for its platforms, unless show_all), values the engine could not map, and house updates still
    to apply. update: apply them (result gets changed: True when state.json changed)."""
    if update:
        std_sync(d, result=result)
        return 0
    state = merge_defaults(load_state(d))
    st = std_state(state)
    house = load_standards()
    by_id = {s["id"]: s for s in house["standards"]}
    pending = std_pending(state, house, retry=True)
    no_file = house["version"] is None
    followed = [s for s in (std_copy(state, i, house) for i in st["applied"] if i not in st["overridden"]) if s]
    hidden = [] if show_all else [s for s in followed if not std_applies(s, state)]
    followed = [s for s in followed if s not in hidden]
    gone = [i for i in st["applied"] if i not in by_id and i not in st["overridden"]] if no_file else []
    unmapped = std_unmapped(state, house) + list(house["skipped"])
    rec, held, beaten = st["records"], std_held(state), std_beaten(state)

    def locked_of(sid):  # the values this standard holds now
        return {shown_path(p): v for p, v in ((rec.get(sid) or {}).get("paths") or {}).items() if held.get(p) == sid}

    def notes_of(sid):  # paths where a higher rule holds the value instead
        r = rec.get(sid) or {}
        out = [_kept_note(held[p], p, std_current(state, p)) for p in r.get("paths") or {} if held.get(p) not in (None, sid)
               and p not in (st["released"].get(sid) or {})]
        out += [f"the person took back {shown_path(p)} ({x.get('decision')}): \"{x.get('why')}\"; it holds {_vw(std_current(state, p))}"
                for p, x in (st["released"].get(sid) or {}).items()]
        if sid in beaten:
            out.append(f"project standard {beaten[sid]} wins over it in this project, so review and validate do not check it")
        return out + [_kept_note(held.get(p, who) if str(who).startswith(("PRJ-", "STD-")) else who, p, std_current(state, p))
                      for p, who in (r.get("kept") or {}).items() if p not in (st["released"].get(sid) or {})]

    out = {"house": {"version": house["version"], "updated": house["updated"], "file": standards_file(), "error": house["error"]},
           "systemVersion": st["house_version"], "skillOlder": pending["older"],
           "followed": [{"id": s["id"], "theme": s.get("theme"), "area": s.get("area"), "title": s.get("title"), "rule": s.get("rule"),
                         "why": s.get("why"), "sources": s.get("sources") or [], "strength": s.get("strength"),
                         "values": s.get("values") or {}, "locked": locked_of(s["id"]), "notes": notes_of(s["id"]),
                         "kept": (rec.get(s["id"]) or {}).get("kept") or {},
                         "released": {shown_path(p): x for p, x in (st["released"].get(s["id"]) or {}).items()},
                         "beatenBy": beaten.get(s["id"])} for s in followed],
           "overridden": [dict({"id": sid, "title": (std_copy(state, sid, house) or {}).get("title"),
                                "rule": (std_copy(state, sid, house) or {}).get("rule")}, **o) for sid, o in st["overridden"].items()],
           "project": [dict(s, locked=locked_of(s["id"]), notes=notes_of(s["id"])) for s in st["project"]],
           "notForPlatforms": [s["id"] for s in hidden], "notInHouseFile": gone, "unmapped": unmapped,
           "pending": {"new": [s["id"] for s in pending["new"]], "changed": [s["id"] for s in pending["changed"]],
                       "retired": [r["id"] for r in pending["retired"]], "keptOverrides": [s["id"] for s in pending["kept"]],
                       "notForPlatforms": [s["id"] for s in pending["off"]], "nowMapped": [s["id"] for s in pending["retry"]]}}
    if as_json:
        print(json.dumps(out, indent=2, ensure_ascii=False))
        return 0
    if house["error"]:
        print("Note: " + house["error"] + ".")
    if no_file and not st["project"] and not st["applied"] and not st["overridden"]:
        if not house["error"]:
            print("No standards yet. No house standards ship with this skill (references/standards.json), and there are no "
                  "project standards.")
        print("Add one the person marks non-negotiable with: engine.py standard add --rule \"...\" --why \"...\" --source <url>")
        return 0
    if not no_file:
        print(f"OpenDesigner house standards: v{house['version']}" + (f" ({house['updated']})" if house["updated"] else "")
              + f". This system follows {'v' + str(st['house_version']) if st['house_version'] is not None else 'none of them yet'}.")
    if pending["older"]:
        print(std_older_words(house["version"], st["house_version"]) + ". Until then nothing is released or changed.")
    if st["project"]:
        print("Project standards (the person's own; house updates never touch them):")
        for s in st["project"]:
            src = ", ".join(x.get("url") or x.get("id") or "" for x in s.get("sources") or [] if isinstance(x, dict))
            print(f"  {s['id']}  {s.get('authority', 'non-negotiable')}: {s.get('rule')}" + (f"  (source: {src})" if src else ""))
            if s.get("beats"):
                print(f"        wins over house standard{'s' if len(s['beats']) > 1 else ''} {', '.join(s['beats'])} in this project")
            if s.get("authority", "non-negotiable") == "non-negotiable":
                vals = locked_of(s["id"])
                label = "        locked: "
            else:
                vals = {shown_path(p): v for p, v in ((rec.get(s["id"]) or {}).get("paths") or {}).items()}
                label = "        recommended: "
            if vals:
                print(label + "; ".join(f"{p} = {_vw(v)}" for p, v in vals.items()))
            for n in notes_of(s["id"]):
                print("        " + n)
    if st["overridden"]:
        print("Overridden by the person (their choice outranks a standard):")
        for sid, o in st["overridden"].items():
            print(f"  {sid}  {(std_copy(state, sid, house) or {}).get('title') or ''}: \"{o.get('why')}\" ({o.get('decision')}, "
                  f"{o.get('date')}). To follow it again: engine.py standard restore {sid}")
    part = [(sid, r) for sid, r in st["released"].items() if r and sid not in st["overridden"]]
    if part:
        print("Values the person took back from a standard it otherwise follows:")
        for sid, r in part:
            for p, x in r.items():
                print(f"  {sid}  {shown_path(p)} = {_vw(std_current(state, p))}: \"{x.get('why')}\" ({x.get('decision')}). "
                      f"To follow it again: engine.py standard restore {sid}")
    if followed:
        print(f"Followed ({len(followed)}; locked, change one only when the person asks):")
        for title, group in std_by_theme(house, followed):
            print(f"  {title}")
            for s in group:
                print(f"    {s['id']}  {s.get('title') or ''}: {s.get('rule') or ''}".rstrip()
                      + ("" if std_applies(s, state) else f"  (for {', '.join(s.get('applies_to') or [])} only; not these platforms)"))
                lk = locked_of(s["id"])
                if lk:
                    print("        locked: " + "; ".join(f"{p} = {_vw(v)}" for p, v in lk.items()))
                for n in notes_of(s["id"]):
                    print("        " + n)
    if hidden:
        print(f"{_plural(len(hidden), 'standard is', 'standards are')} for other platforms and not shown (engine.py standards --all lists them).")
    if show_all and not no_file:
        other = [s for s in house["standards"] if not std_applies(s, state)]
        if other:
            print(f"House standards for other platforms or stacks ({len(other)}; not followed here):")
            for s in other:
                print(f"  {s['id']}  ({', '.join(s.get('applies_to') or [])}) {s.get('title') or ''}".rstrip())
    if gone:
        print(f"The house standards file is missing here ({standards_file()}), so these cannot be checked against it: "
              f"{', '.join(gone)}. They stay as recorded; to change one: engine.py standard override <id> --why \"<their words>\".")
    if unmapped:
        print("Not mapped (the engine could not put these values in the tokens; each line says why. Accessibility floors outrank "
              "every standard, so a value that would break one stays out on purpose):")
        for u in unmapped:
            print(f"  {u['id']}  {u['path']}: {u['reason']}")
    n, c, r = len(pending["new"]), len(pending["changed"]), len(pending["retired"])
    o, a = len(pending["off"]), len(pending["retry"])
    if n or c or r or o or a:
        print(f"House updates to apply: {n} new, {c} changed, {r} retired" + (f", {o} no longer for these platforms" if o else "")
              + (f", {a} now mapped" if a else "") + ". Run `engine.py standards --update`.")
        for label, items in (("new", pending["new"]), ("changed", pending["changed"]), ("not for these platforms", pending["off"]),
                             ("now mapped", pending["retry"])):
            for s in items:
                print(f"  {label}: {s['id']}  {s.get('title') or s.get('rule') or ''}")
        for x in pending["retired"]:
            print(f"  retired: {x['id']}  ({x.get('why') or 'no reason given'})")
    elif not no_file and st["house_version"] == house["version"]:
        print("Up to date with the house standards.")
    if pending["kept"]:
        print("Changed in the house file but overridden here (they stay the person's): " + ", ".join(s["id"] for s in pending["kept"]))
    return 0


def _std_project_id(d, state):
    nums = [int(m) for s in std_state(state)["project"] for m in re.findall(r"^PRJ-(\d+)$", s.get("id") or "")]
    fp = os.path.join(d, "decisions.md")
    if os.path.exists(fp):
        with open(fp, encoding="utf-8") as f:
            nums += [int(m) for m in re.findall(r"\bPRJ-(\d+)\b", f.read())]  # ids are never reused after a removal
    return f"PRJ-{max(nums, default=0) + 1:02d}"


def std_restore_needed(state, s):
    """True when restoring a standard would change something: it is not applied, the person took values back from it, a
    value it sets is not in place or not locked by it, or the person's own value was kept. A project standard that wins
    is not undone by a restore, and a standard that is already in place gives False, so a second restore is a no-op."""
    st = std_state(state)
    sid = s["id"]
    if not sid.startswith("PRJ-") and sid not in st["applied"]:
        return True
    if st["released"].get(sid):
        return True
    rec = st["records"].get(sid) or {}
    if any(not str(w).startswith(("PRJ-", "STD-")) for w in (rec.get("kept") or {}).values()):
        return True
    cache = {}
    for eng in std_engine(s):
        try:
            sp, v = std_target(state, eng.get("path"), eng.get("value"), eng.get("type"), cache, trial=False)
        except Exception:
            continue
        hs = std_holders(state, sp)
        if hs and hs[0].startswith("PRJ-") and hs[0] != sid:
            continue
        if sid not in hs or not _same(std_current(state, sp), v):
            return True
    return False


def _pairs(pairs, path=None, value=None):
    """[[path, value], ...] from repeated --path/--value (value may be None), or from one path and value."""
    if pairs is not None:
        return [list(x) for x in pairs]
    if isinstance(path, (list, tuple)):
        vals = list(value) if isinstance(value, (list, tuple)) and len(value) == len(path) else [None] * len(path)
        return [[p, v] for p, v in zip(path, vals)]
    return [[path, value]] if path is not None or value is not None else []


def _others_on(state, sid, paths):
    """{path: [ids]} of the other standards that set these paths and are overridden, or that the person took the path
    back from: a restore of this standard leaves them as they are unless --all-holders."""
    st = std_state(state)
    out = {}
    for osid, rec in st["records"].items():
        if osid == sid:
            continue
        for p in paths:
            if p in (rec.get("paths") or {}) and (osid in st["overridden"] or p in (st["released"].get(osid) or {})):
                out.setdefault(p, []).append(osid)
    return out


def cmd_standard(d, action, sid=None, why=None, value=None, rule=None, source=None, authority="non-negotiable", area=None,
                 values=None, path=None, review_pattern=None, review_message=None, title=None, quiet=False, pairs=None,
                 all_holders=False, beats=None):
    """engine.py standard override|restore|add|remove: change one standard, always with a recorded decision.
    override --path P [--value V] (repeatable) takes back only those values; without --path the whole standard. restore
    follows it again (--why records the person's words). --all-holders applies either to every standard that sets the same
    values. add --path P --value V (repeatable, paired) and --beats STD-a,STD-b (the project's rule always wins over them)."""
    sp = os.path.join(d, "state.json")
    if not os.path.exists(sp):
        raise SystemExit(f"no state at {sp}; run `engine.py init --dir {d}` first")
    state = merge_defaults(read_json(sp))
    st = std_state(state)
    house = load_standards()
    today = _dt.date.today().isoformat()
    say = (lambda *a: None) if quiet else print
    pairs = _pairs(pairs, path, value)
    decs = _decisions(d)
    if action in ("override", "restore", "remove"):
        s, kind = std_find(state, sid, house)
        retired = {r["id"]: r for r in house["retired"]}
        if not s and not (action == "restore" and sid in st["overridden"]):
            hint = f" It was retired ({retired[sid].get('why') or 'no reason given'})." if sid in retired else ""
            raise SystemExit(f"There is no standard {sid}.{hint} `engine.py standards` lists them.")
    if action == "override":
        return _std_override(d, state, st, house, sid, s, kind, why, pairs, all_holders, decs, today, say)
    if action == "restore":
        return _std_restore(d, state, st, house, sid, s, kind, why, all_holders, decs, say)
    if action == "remove":
        if kind in ("house", "gone") or (sid or "").startswith("STD-"):
            raise SystemExit(f"{sid} is a house standard. House standards cannot be removed, only overridden, and only when the person "
                             f"explicitly asks: engine.py standard override {sid} --why \"<their words>\"")
        if not (why or "").strip():
            raise SystemExit("Give the person's own words with --why.")
        did = _next_did(d)
        rec = st["records"].pop(sid, {}) or {}
        _keep_types(st, s)
        st["project"] = [x for x in st["project"] if x.get("id") != sid]
        paths = list(rec.get("paths") or {})
        unlocked = _release(state, paths, sid, rec)
        # the next rule in line takes the paths back: a standard that still holds one, or one that kept it for this standard
        heirs, held = {}, std_held(state)
        for p in paths:
            if held.get(p):
                heirs.setdefault(held[p], set()).add(p)
        for osid, orec in st["records"].items():
            if osid not in st["overridden"] and orec.get("locked", True):
                for p, who in (orec.get("kept") or {}).items():
                    if who == sid:
                        heirs.setdefault(osid, set()).add(p)
        back = []
        for osid in sorted(heirs, key=_std_rank):
            so = std_find(state, osid, house)[0]
            if so:
                back += std_apply(d, state, [so], did, force=True, only=heirs[osid])[0]
        mine = [p for p in paths if p not in unlocked and p in set(rec.get("prelocked") or [])]
        extra = [f"rule was: {s.get('rule')}"]
        if unlocked:
            extra.append("unlocked (values stay): " + ", ".join(shown_path(p) for p in unlocked))
        if mine:
            extra.append("still locked by the person: " + ", ".join(shown_path(p) for p in mine))
        if back:
            extra.append("back to the next rule in line:")
            extra += ["  " + b for b in back]
        again = [b for b in s.get("beats") or [] if b not in std_beaten(state)]
        if again:
            extra.append(f"house standard{'s' if len(again) > 1 else ''} {', '.join(again)} {'are' if len(again) > 1 else 'is'} "
                         "checked again (review and validate)")
        if not paths and not back:
            extra.append("it set no values" if rec.get("locked", True) else "it recommended no values")
        elif not rec.get("locked", True):
            extra.append("its recommended values stay, as they were never locked")
        dump_json(sp, state)
        log_decision(d, "standards." + sid, None, why.strip(), "chosen", False, title=f"remove {sid} (project standard)",
                     supersedes=rec.get("decision") or s.get("decision"), extra=extra)
        say(f"{did} removed project standard {sid}: {s.get('rule')}")
        for e_ in extra[1:]:
            say("  " + e_)
        return did
    if action != "add":
        raise SystemExit("engine.py standard takes override, restore, add or remove")
    return _std_add(d, state, st, house, rule, why, source, authority, area, values, pairs, review_pattern, review_message,
                    title, beats, today, say)


def _std_override(d, state, st, house, sid, s, kind, why, pairs, all_holders, decs, today, say):
    """standard override: the person takes back the whole standard, or only the values named with --path."""
    if not (why or "").strip():
        raise SystemExit("Give the person's own words with --why: a standard changes only when they explicitly ask.")
    if kind == "project":
        raise SystemExit(f"{sid} is the person's own project standard. To change it: engine.py standard remove {sid} --why \"...\", "
                         "then add the new rule with engine.py standard add.")
    if sid in st["overridden"]:
        raise SystemExit(f"{sid} is already overridden ({st['overridden'][sid].get('decision')}); its values are unlocked, so change "
                         "them with engine.py set, or follow it again with engine.py standard restore " + sid)
    s = std_copy(state, sid, house) or s  # the rule as this system follows it
    rec = st["records"].get(sid) or {}
    paths = [p for p in rec.get("paths") or {} if p not in (st["released"].get(sid) or {})]
    did = _next_did(d)
    extra = [f"house standard {sid}: {s.get('rule')}", "why the house follows it: " + (s.get("why") or "not given")]
    named = [x for x in pairs if x[0] is not None]
    if named and any(x[0] is None for x in pairs):
        raise SystemExit("Give each --value after its --path, for example --path motion.easing.exit --value '[0.23, 1, 0.32, 1]'.")
    if not named and len(pairs) == 1:  # --value alone: a standard that sets one value
        targets = paths or [normalize_path(x["path"].strip()) for x in std_engine(s) if isinstance(x.get("path"), str) and x["path"].strip()]
        if not targets:
            raise SystemExit(f"{sid} sets no values (only code review checks it), so there is nothing for --value to change. "
                             "Override it without --value.")
        if len(targets) != 1:
            raise SystemExit(f"{sid} sets {len(targets)} values, so --value cannot say which one. Name it with --path, for example: "
                             f"engine.py standard override {sid} --why \"<their words>\" --path {shown_path(targets[0])} --value <new value>")
        named = [[shown_path(targets[0]), pairs[0][1]]]
        whole = True
    else:
        whole = not named
    # the values to take back, as state paths, and the new value for each (None: keep the value, only unlock it)
    want = {}
    for pth, val in named:
        tp = normalize_path(str(pth).strip())
        if tp in (rec.get("kept") or {}):
            who = rec["kept"][tp]
            if str(who).startswith(("PRJ-", "STD-")):
                who = std_holder(state, tp) or who
            raise SystemExit(f"{sid} does not hold {shown_path(tp)} in this project: {_kept_note(who, tp, std_current(state, tp))}. "
                             "Nothing was changed.")
        if tp not in (rec.get("paths") or {}) and not (whole and not paths):
            if tp in (st["released"].get(sid) or {}):
                raise SystemExit(f"{shown_path(tp)} was already taken back from {sid} "
                                 f"({st['released'][sid][tp].get('decision')}); change it with engine.py set.")
            held_now = ", ".join(shown_path(x) for x in paths) or "no values in this system"
            raise SystemExit(f"{sid} does not set {shown_path(tp)}; it sets {held_now}.")
        if val is not None:
            try:
                tp, val = std_target(state, shown_path(tp), val)
            except ValueError as ex:
                raise SystemExit(f"Nothing was changed: {ex}.")
        want[tp] = val
    scope = paths if whole else list(want)
    others = {p: std_holders(state, p, exclude=(sid,)) for p in scope}
    others = {p: hs for p, hs in others.items() if hs}
    prj = sorted({h for hs in others.values() for h in hs if h.startswith("PRJ-")})
    if prj and any(v is not None for v in want.values()):
        p0 = next(p for p, hs in others.items() if any(h.startswith("PRJ-") for h in hs))
        raise SystemExit(f"Nothing was changed: {shown_path(p0)} follows project standard {prj[0]}, which wins in this project. "
                         + std_lock_message(state, prj[0], house))
    if others and not all_holders and any(v is not None for v in want.values()):
        p0 = next(iter(others))
        raise SystemExit("Nothing was changed.\n" + std_lock_message(state, [sid] + others[p0], house, path=p0, value=want.get(p0)))
    free = sorted({h for hs in others.values() for h in hs if not h.startswith("PRJ-")}) if all_holders else []
    for tp, val in want.items():
        if val is not None:
            br = std_constraint_breaks(state, tp, val, house, exclude=(sid, *free))
            if br:
                raise SystemExit("Nothing was changed. " + std_lock_message(state, [], house, path=tp, value=val, breaks=br))
    sup = supersedes_words({p: _last_decision(decs, state, p) for p in scope})
    if whole:
        st["released"].pop(sid, None)
        unlocked = _release(state, paths, sid, rec) if paths else []
        st["overridden"][sid] = {"why": why.strip(), "decision": did, "date": today}
    else:
        for tp in want:
            st["released"].setdefault(sid, {})[tp] = {"why": why.strip(), "decision": did, "date": today}
        unlocked = []
    for osid in free:  # --all-holders: the same values are taken back from every other standard that sets them
        for p, hs in others.items():
            if osid in hs:
                st["released"].setdefault(osid, {})[p] = {"why": why.strip(), "decision": did, "date": today}
    if not whole or free:
        unlocked = sorted(set(unlocked) | set(_release(state, [p for p in scope if p not in unlocked], sid, rec)))
    set_now = []
    for tp, val in want.items():
        if val is not None:
            prev = std_current(state, tp)
            _store(state, tp, val, "chosen", did, False)
            _touch(state, tp)
            extra.append(f"previous value of {shown_path(tp)}: {json.dumps(prev, ensure_ascii=False)}")
            set_now.append((tp, val))
    for p in unlocked:
        if p not in want or want[p] is None:
            st["untouched"][p] = sid  # still the standard's value until the person sets one (provenance)
    held, mine = std_held(state, exclude=sid), set(rec.get("prelocked") or [])
    still = [f"{shown_path(p)} ({'the person locked it themselves' if p in mine else 'standard ' + held[p] + ' holds it'})"
             for p in scope if p not in unlocked and (p in mine or p in held)]
    if paths or not std_engine(s):
        freed = ", ".join(shown_path(p) for p in unlocked) or ("nothing (it sets no values)" if not paths else "nothing")
    else:
        freed = "nothing yet (its values were not applied in this system)"
    extra.append("unlocked: " + freed)
    if free:
        extra.append(f"also taken back from {', '.join(free)} (--all-holders)")
    if still:
        extra.append("still locked: " + "; ".join(still))
    dump_json(os.path.join(d, "state.json"), state)
    if len(set_now) == 1 and len(want) == 1:
        head = f"{set_now[0][0]} = {json.dumps(set_now[0][1], ensure_ascii=False)}"
    elif whole:
        head = f"override {sid} (house standard)"
    else:
        head = f"override {sid} for {', '.join(shown_path(p) for p in want)} (house standard)"
    for tp, val in set_now if len(set_now) > 1 else []:
        extra.append(f"set: {shown_path(tp)} = {json.dumps(val, ensure_ascii=False)}")
    log_decision(d, "standards." + sid, set_now[0][1] if len(set_now) == 1 and len(want) == 1 else None, why.strip(), "chosen",
                 False, extra=extra, title=head, supersedes=sup or rec.get("decision"))
    say(f"{did} overrode house standard {sid}" + ("" if whole else f" for {', '.join(shown_path(p) for p in want)}") + f": {s.get('rule')}")
    say(f"  The person's reason is recorded: \"{why.strip()}\". Unlocked: {freed}." + (f" Still locked: {'; '.join(still)}." if still else ""))
    for tp, val in set_now:
        say(f"  set {shown_path(tp)} = {_vw(val)}")
    if free:
        say(f"  Also taken back from {', '.join(free)}, which set the same value{'s' if len(scope) > 1 else ''}.")
    elif others and not prj:
        say(f"  {'; '.join(shown_path(p) + ' is also set by ' + ', '.join(hs) for p, hs in others.items())}. "
            "Add --all-holders to take it back from them too.")
    if whole:
        say(f"  To follow it again: engine.py standard restore {sid}")
    else:
        say(f"  The rest of {sid} still applies. To follow it fully again: engine.py standard restore {sid}")
    return did


def _std_restore(d, state, st, house, sid, s, kind, why, all_holders, decs, say):
    """standard restore: follow a standard again (house), or put a project standard's values back after a hand edit."""
    if kind == "project":
        if not std_restore_needed(state, s):
            raise SystemExit(f"{sid} is a project standard and its values are in place; it is never overridden, so there is "
                             "nothing to restore.")
    elif not s or kind == "gone":
        reason = ({r["id"]: r for r in house["retired"]}.get(sid) or {}).get("why") or "it is not in this skill's house standards file"
        raise SystemExit(f"{sid} is no longer a house standard ({reason}), so there is nothing to restore.")
    if sid not in st["overridden"] and not std_restore_needed(state, s):
        say(f"{sid} is already followed: its values are in place and locked, so there is nothing to restore.")
        return None
    did = _next_did(d)
    todo = [(sid, s)]
    targets = set((st["records"].get(sid) or {}).get("paths") or {}) | set((st["records"].get(sid) or {}).get("kept") or {})
    others = _others_on(state, sid, targets)
    if all_holders:
        for osid in sorted({x for xs in others.values() for x in xs}):
            so = std_copy(state, osid, house) or std_find(state, osid, house)[0]
            if so:
                todo.append((osid, so))
    lines, olds, sup = [], {}, {}
    for xid, xs in todo:
        old = st["overridden"].pop(xid, None)
        olds[xid] = old
        st["released"].pop(xid, None)
        rec0 = st["records"].get(xid) or {}
        before = set(rec0.get("paths") or {})
        for p in before | set(rec0.get("kept") or {}):
            sup[p] = _last_decision(decs, state, p)
        soft = xid.startswith("PRJ-") and xs.get("authority", "non-negotiable") != "non-negotiable"
        got, _u = std_apply(d, state, [xs], did, force=True, show_old=True, locked=not soft, set_by="reference" if soft else "standard")
        lines += got
        rec = st["records"].get(xid) or {}
        _release(state, before - set(rec.get("paths") or {}) - set(rec.get("kept") or {}), xid, rec)
    left = {p: [x for x in xs if x not in dict(todo)] for p, xs in others.items()}
    left = {p: xs for p, xs in left.items() if xs}
    note = [f"{shown_path(p)} is also set by {', '.join(xs)}, which stay{'s' if len(xs) == 1 else ''} overridden or taken back for it; "
            f"the value now follows {sid}" for p, xs in left.items()]
    dump_json(os.path.join(d, "state.json"), state)
    reason = (why or "").strip() or ("The person asked to follow the house standard again." if olds.get(sid) else
                                     "Put the standard's values back and locked them again.")
    log_decision(d, "standards." + sid, None, reason, "standard", True, extra=lines + ["note: " + n for n in note],
                 title=f"restore {sid} ({'project' if kind == 'project' else 'house'} standard)"
                       + (f" and {', '.join(x for x, _s in todo[1:])}" if len(todo) > 1 else ""),
                 supersedes=supersedes_words(sup) or (olds.get(sid) or {}).get("decision"))
    say(f"{did} restored {'project' if kind == 'project' else 'house'} standard {sid}: {s.get('rule')}")
    for line in lines:
        say("  " + line)
    for n in note:
        say("  note: " + n + ". To follow those too: engine.py standard restore " + sid + " --all-holders")
    return did


def _std_add(d, state, st, house, rule, why, source, authority, area, values, pairs, review_pattern, review_message, title,
             beats, today, say):
    """standard add: a project standard from a source the person trusts (non-negotiable: locked; good-to-have: recommended)."""
    sp = os.path.join(d, "state.json")
    missing = [f for f, v in (("--rule", rule), ("--why", why), ("--source", source)) if not (v or "").strip()]
    if missing:
        raise SystemExit(f"engine.py standard add needs {', '.join(missing)}: the rule in plain words, why it matters, and where it "
                         "comes from (a URL, a file, or the person's own words and the date, such as \"person, 2026-09-27\").")
    if authority not in ("non-negotiable", "good-to-have"):
        raise SystemExit("--authority is non-negotiable (a locked standard) or good-to-have (a recommended default)")
    if isinstance(values, str):
        try:
            values = json.loads(values)
        except ValueError:
            values = False
    if values is not None and not isinstance(values, dict):
        raise SystemExit("--values takes a JSON object, for example '{\"exit-easing\": \"ease-out\"}'")
    if any(p is None or v is None for p, v in pairs):
        raise SystemExit("--path and --value go together: give each --path the value it must hold, right after it, for example "
                         "--path focus.ring.width --value 2 --path focus.ring.offset --value 2")
    if review_pattern:
        problem = regex_problem(review_pattern)
        if problem:
            raise SystemExit(f"--review-pattern cannot be used: {problem}. Nothing was written.")
    beats = [x.strip() for x in (beats.split(",") if isinstance(beats, str) else beats or []) if isinstance(x, str) and x.strip()]
    for b in beats:
        if std_find(state, b, house)[1] not in ("house", "gone"):
            raise SystemExit(f"--beats takes house standard ids (`engine.py standards` lists them); {b} is not one. Nothing was written.")
    must = authority == "non-negotiable"
    if beats and not must:
        raise SystemExit("--beats is for a non-negotiable rule: a recommended default never wins over a house standard.")
    nid = _std_project_id(d, state)
    targets = []
    for pth, val in pairs:
        try:
            targets.append(std_target(state, pth, val))
        except ValueError as ex:
            raise SystemExit(f"Nothing was written: {ex}.")
    if len({t[0] for t in targets}) != len(targets):
        raise SystemExit("Each --path may appear once. Nothing was written.")
    for tp, tv in targets if must else []:
        br = [x for x in std_constraint_breaks(state, tp, tv, house) if x[0] not in beats]
        if br:
            raise SystemExit(f"Nothing was written: {_vw(tv)} for {shown_path(tp)} breaks "
                             + "; ".join(_std_says(state, x[0], house) + f" ({x[1]})" for x in br)
                             + f" If the person's source always wins over it (their brand, always): add --beats {','.join(x[0] for x in br)}. "
                             f"For just this value: engine.py standard override {br[0][0]} --why \"<their words>\" --path {shown_path(tp)} "
                             f"--value '{json.dumps(tv, ensure_ascii=False)}'")
    did = _next_did(d)
    engine = [{"path": p, "value": v} for p, v in pairs]
    std = {"id": nid, "title": title or rule.strip()[:80], "rule": rule.strip(), "why": why.strip(), "authority": authority,
           "strength": "must" if must else "should", "area": area, "values": values or {}, "applies_to": ["all"],
           "sources": [{"url": source} if re.match(r"^https?://", source) else {"id": source}],
           "engine": engine[0] if len(engine) == 1 else engine or None,
           "review": {"pattern": review_pattern, "message": review_message or rule.strip()} if review_pattern else None,
           "design_md": True, "added": today, "decision": did}
    if beats:
        std["beats"] = beats
    st["project"].append(std)
    lines = []
    outranked = {tp: std_held(state).get(tp) for tp, _v in targets} if must else {}
    if targets:
        lines, _u = std_apply(d, state, [std], did, force=must, locked=must, set_by="standard" if must else "reference")
    else:
        st["records"][nid] = {"paths": {}, "decision": did, "locked": must}
    for tp, other in outranked.items():
        if other and tp in (st["records"].get(nid) or {}).get("paths", {}):
            so = std_find(state, other, house)[0] or {}
            lines.append(f"wins over {'your older project' if other.startswith('PRJ-') else 'house'} standard {other} for "
                         f"{shown_path(tp)} in this project ({'its' if other.startswith('PRJ-') else 'house'} rule: {so.get('rule')})")
    if beats:
        lines.append(f"wins over house standard{'s' if len(beats) > 1 else ''} {', '.join(beats)} in this project (project wins): "
                     "their review checks and constraints are off here until this standard is removed")
    dump_json(sp, state)
    log_decision(d, "standards." + nid, None, why.strip(), "standard" if must else "reference", must and bool(targets), source_ref=source,
                 title=f"project standard {nid} ({authority}): {rule.strip()}", extra=lines)
    say(f"{did} added project standard {nid} ({authority}): {rule.strip()}")
    for line in lines:
        say("  " + line)
    if must and targets:
        say("  It is locked like a house standard, written into DESIGN.md and checked by validate" + (" and review" if review_pattern else "") + ".")
    elif must:
        say("  It locks no value; it is written into DESIGN.md" + (" and checked by review" if review_pattern else
                                                                   " (add --review-pattern so review can check code against it)") + ".")
    else:
        say("  It is a recommended default: unlocked, so the person may change it" + (", and review checks it" if review_pattern else "") + ".")
    return nid


def _source_ids(s):
    """A standard's source ids, each once."""
    out = []
    for x in s.get("sources") or []:
        v = (x.get("id") or x.get("url") or "") if isinstance(x, dict) else ""
        if v and v not in out:
            out.append(v)
    return ", ".join(out)


def std_validate(state, rep, files=None):
    """validate: an advisory when the house standards file is broken, when it moved past this system's version (or is
    older, from an older skill install), or when standards now apply (or no longer apply) to the person's platforms; a
    warning when a value a standard locked no longer holds it (drift), and when a token takes a value a standard forbids
    (its constraints). files: the tokens to check the constraints against (else the values stored in state.json)."""
    house = load_standards()
    st = std_state(state)
    if house["error"]:
        rep.add("advisory", "standards", house["error"] + ". Reinstall the skill or fix the file", "House standards (docs/KNOWLEDGE.md 6)",
                standards_file())
    hv, sv = house["version"], st["house_version"]
    if hv is not None and (house["standards"] or house["retired"] or st["applied"] or st["overridden"]):
        p = std_pending(state, house)
        n, c, r, off = len(p["new"]), len(p["changed"]), len(p["retired"]), len(p["off"])
        kept = (f"; {_plural(len(p['kept']), 'standard you overrode has', 'standards you overrode have')} changed, and "
                f"{'it stays' if len(p['kept']) == 1 else 'they stay'} yours" if p["kept"] else "")
        msg, fix = None, "engine.py standards --update"
        if p["older"]:
            msg, fix = std_older_words(hv, sv) + ". Until then nothing is released or changed", "update the OpenDesigner skill"
        elif sv is None or hv > sv:
            msg = (f"OpenDesigner's house standards moved to v{hv} (this system follows {'v' + str(sv) if sv is not None else 'none yet'}): "
                   + (f"{n} new, {c} changed, {r} retired" if n or c or r else "none of the changes touch it")
                   + (f", {off} no longer for your platforms" if off else "") + kept + ". Run `engine.py standards --update`")
        elif n or r or off:
            msg = "; ".join(x for x in (
                f"{_plural(n, 'house standard applies', 'house standards apply')} to this system but {'is' if n == 1 else 'are'} not "
                "applied yet (for example after the platforms changed)" if n else "",
                f"{_plural(off, 'house standard no longer applies', 'house standards no longer apply')} to your platforms" if off else "",
                f"{_plural(r, 'standard', 'standards')} this system follows left the house file" if r else "") if x) \
                + ". Run `engine.py standards --update`"
        if msg:
            rep.add("advisory", "standards", msg, "House standards (docs/KNOWLEDGE.md 6)", f"standards.json v{hv}", fix=fix)
    for sid, path in sorted((sid, p) for p, sid in std_held(state).items()):
        want = st["records"][sid]["paths"][path]
        cur = std_current(state, path)
        if _same(cur, want):
            continue
        s = (std_find(state, sid, house)[0] if sid.startswith("PRJ-") else std_copy(state, sid, house)) or {}
        kind = "project" if sid.startswith("PRJ-") else "house"
        rep.add("warning", "standards",
                f"{kind.capitalize()} standard {sid} sets {shown_path(path)} to {_vw(want)}, but it is now {_vw(cur)}"
                + (f" ({(s.get('rule') or '').rstrip('.')})" if s.get("rule") else ""),
                f"{kind} standard {sid}", _source_ids(s), where=path, measured=cur, threshold=want,
                fix=(f"engine.py standard restore {sid}, or if the person asked for this change: "
                     f"engine.py standard override {sid} --why \"<their words>\" --path {shown_path(path)}") if kind == "house"
                else f"put it back: engine.py standard restore {sid}, or engine.py standard remove {sid} --why \"<their words>\"")
    if files:
        std_motion_budget(state, rep, files, house)
        std_white_black(state, rep, files, house)
    cons = std_constraints(state, house)
    if not cons:
        return
    if files:
        pats = [c["path"].strip() for _sid, c, _s in cons]
        seen, values = set(), []
        for fn in files:
            if fn.endswith(".tokens.json"):
                for pth, v in _flat_resolved(files, fn, pats):
                    key = (pth, json.dumps(v, sort_keys=True))
                    if key not in seen:
                        seen.add(key)
                        values.append(("overrides." + pth, v))
    else:
        values = [("overrides." + k, v) for k, v in (state.get("overrides") or {}).items()]
    found = set()
    for pth, v in values:
        for sid, why, s in std_constraint_breaks(state, pth, v, house, constraints=cons):
            key = (sid, _token_key(pth))
            if key in found:
                continue
            found.add(key)
            kind = "project" if sid.startswith("PRJ-") else "house"
            rep.add("warning", "standards",
                    f"{_token_key(pth)} breaks {kind} standard {sid}: {why} ({(s.get('rule') or '').rstrip('.')})",
                    f"{kind} standard {sid}", _source_ids(s), where=_token_key(pth), measured=v,
                    fix=(f"set a value the rule allows (engine.py set {_token_key(pth)} <value>), or if the person asked for it: "
                         + (f"engine.py standard override {sid} --why \"<their words>\"" if kind == "house"
                            else f"engine.py standard remove {sid} --why \"<their words>\"")
                         + ("; for their own rule that always wins: engine.py standard add ... --beats " + sid if kind == "house" else "")))


WHITE_BLACK_RULE = "STD-visual-details-66"  # house standard (owner): never pure white and pure black in one product
WHITE_BLACK_ROLES = ("color.bg.", "color.surface.", "color.text.", "color.icon.", "color.border.")
# opaque pure white and pure black written in code (CSS, Tailwind, SwiftUI, Compose); 8-digit hex, rgba and /alpha don't count
_WB_PROPS = r"(?:color|background(?:-color)?|fill|stroke|border(?:-[a-z]+)?-?color|border|outline)\s*:\s*[^;{}]*?"
RX_PURE = {k: re.compile(r"(?i)(?:#" + hx + r"(?![0-9a-z])|\brgb\(\s*" + rgb + r"\s*\)|" + _WB_PROPS + r"\b" + w + r"\b"
                         r"|\b(?:bg|text|fill|stroke|border|from|to|via)-" + w + r"\b(?!/)|\bColor\." + w + r"\b|\(\s*\." + w + r"\s*\))")
           for k, hx, rgb, w in (("white", r"(?:fff|ffffff)", r"255\s*,\s*255\s*,\s*255", "white"),
                                 ("black", r"(?:000|000000)", r"0\s*,\s*0\s*,\s*0", "black"))}


def white_black_roles(files):
    """{theme: ({role paths that are opaque #ffffff}, {role paths that are opaque #000000})}. Only the colours people see as
    surfaces, text, icons and borders count: the black and white primitives, the ramps, shadows, scrims and overlays don't."""
    res = files.get("opendesigner.resolver.json") or {}
    themes = list(((res.get("modifiers") or {}).get("theme") or {}).get("contexts") or {}) or [None]
    out = {}
    for th in themes:
        w, b = set(), set()
        for pth, t in resolve_all(files, {"theme": th} if th else {}).items():
            v = t.get("resolved")
            if t.get("type") != "color" or not isinstance(v, dict) or not pth.startswith(WHITE_BLACK_ROLES):
                continue
            if v.get("alpha") not in (None, 1, 1.0):
                continue
            hx = str(v.get("hex") or "").lower()
            (w if hx == "#ffffff" else b if hx == "#000000" else set()).add(pth)
        out[th or "default"] = (w, b)
    return out


def std_white_black(state, rep, files, house=None):
    """validate: an error when one theme of this system uses pure white and pure black as role colours together, while
    this system follows STD-visual-details-66."""
    s = next((x for x in std_followed(state, house) if x.get("id") == WHITE_BLACK_RULE), None)
    if not s:
        return
    for th, (w, b) in white_black_roles(files).items():
        if w and b:
            rep.add("error", "standards",
                    f"the {th} theme uses pure white ({', '.join(sorted(w)[:3])}) and pure black ({', '.join(sorted(b)[:3])}) "
                    f"together; house standard {WHITE_BLACK_RULE}: {s.get('rule', '').split('. ')[0]}",
                    f"house standard {WHITE_BLACK_RULE}", _source_ids(s), where=sorted(b)[0], measured="#000000", threshold="not with #ffffff",
                    fix=f"make one side an off-shade (for example engine.py set {sorted(b)[0]} '\"#111111\"'), or if the person asked "
                        f"for both: engine.py standard override {WHITE_BLACK_RULE} --why \"<their words>\"")


UI_MOTION_RULE = "STD-easing-duration-06"  # house standard: UI motion under 300ms unless a stated reason justifies it
UI_MOTION_MAX_MS = 300


def transition_ms(t, flat):
    """(milliseconds, 'response' or 'duration') of a resolved transition token. A spring is judged by its response
    (2 pi / sqrt(stiffness / mass), Apple's duration), not by the time it takes to settle completely (R19)."""
    sp = spring_ext(t, flat)
    sp = (sp or {}).get("spring")
    if isinstance(sp, dict) and isinstance(sp.get("stiffness"), (int, float)) and sp["stiffness"] > 0:
        return 2 * math.pi / math.sqrt(sp["stiffness"] / (sp.get("mass") or 1)) * 1000, "response"
    v = t.get("resolved")
    return (duration_ms(v.get("duration")) if isinstance(v, dict) else None), "duration"


def _timing_sources(path, flat, depth=0):
    """The token paths a transition's timing comes from: itself, the token it aliases whole or the duration it names
    (recursively) and, for a spring built from the lever parameters, those parameters (motion.spring.spatial.stiffness
    and dampingRatio). Its easing is left out: a curve does not make motion slower."""
    out = [path]
    m = re.match(r"^(motion\.spring\.[a-z]+)\.(fast|default|slow)$", path)
    if m:
        out += [f"{m.group(1)}.stiffness", f"{m.group(1)}.dampingRatio"]
    v = (flat.get(path) or {}).get("$value")
    nxt = v if isinstance(v, str) else v.get("duration") if isinstance(v, dict) else None
    if depth < 6 and isinstance(nxt, str) and nxt.startswith("{") and nxt.endswith("}"):
        out += [x for x in _timing_sources(nxt[1:-1], flat, depth + 1) if x not in out]
    return out


def std_motion_budget(state, rep, files, house=None):
    """validate (R19): a warning for each semantic transition over 300ms that no standard justifies, while this system
    follows STD-easing-duration-06. A standard that sets the transition, a token it points to or the spring behind it (a
    drawer's 500ms, a sheet spring) is the stated reason the rule asks for."""
    house = house or load_standards()
    if UI_MOTION_RULE not in {s["id"] for s in std_followed(state, house)} or UI_MOTION_RULE in std_beaten(state):
        return
    try:
        flat = resolve_all(files, {"motion": "standard"})
    except Exception:  # broken tokens are validate's own errors elsewhere
        return
    held = std_held(state)
    for path in sorted(p for p in flat if p.startswith("motion.transition.") and flat[p]["type"] == "transition"):
        v, how = transition_ms(flat[path], flat)
        if v is None or v <= UI_MOTION_MAX_MS + 0.5:
            continue
        why = next((held["overrides." + x] for x in _timing_sources(path, flat) if held.get("overrides." + x)), None)
        if why:
            continue
        rep.add("warning", "standards", f"{path} takes {fmt_num(rnd(v, 0))}ms ({'spring response' if how == 'response' else 'duration'}); "
                f"UI motion stays under {UI_MOTION_MAX_MS}ms unless a standard gives a reason (house standard {UI_MOTION_RULE})",
                f"house standard {UI_MOTION_RULE}", "", where=path, measured=rnd(v, 0), threshold=UI_MOTION_MAX_MS,
                fix=(f"stiffen the spring: engine.py set {next((x for x in _timing_sources(path, flat) if x.endswith('.stiffness')), 'motion.spring.spatial.stiffness')} "
                     f"{fmt_num(rnd((2 * math.pi / (UI_MOTION_MAX_MS / 1000)) ** 2, 0))} gives a {UI_MOTION_MAX_MS}ms response"
                     if how == "response" else "use a step of 150 to 250ms for UI motion (for example engine.py set motion.duration.long 250ms)")
                + f", or if the person asked for slower motion: engine.py standard override {UI_MOTION_RULE} --why \"<their words>\"")


def _flat_resolved(files, fn, patterns):
    """(token path, resolved value) for the tokens of one token file whose path matches one of the patterns, aliases
    resolved across the foundation files and this one."""
    flat = {}
    for f2, tree in files.items():
        if f2.endswith(".tokens.json") and (f2 == fn or not re.search(r"\.(light|dark|spacious|comfortable|compact|standard|reduced)\.", f2)):
            flatten(tree, "", None, flat)
    mine = {}
    flatten(files[fn], "", None, mine)
    out = []
    for pth, t in mine.items():
        if not any(fnmatch.fnmatchcase(pth, x) for x in patterns):
            continue
        try:
            out.append((pth, deep_resolve(t["$value"], flat, [pth])))
        except Exception:  # a broken alias is validate's own error elsewhere
            continue
    return out


def std_review_rules(state):
    """[(compiled pattern, standard)] for review: applied house standards not overridden (as this system follows them), and
    project standards. A pattern that cannot be used safely is skipped, never fatal."""
    house = load_standards()
    st = std_state(state)
    beaten = std_beaten(state)  # a project standard that always wins turns the house one's check off (D03)
    stds = [s for s in std_followed(state, house) if s["id"] not in beaten]
    out = []
    for s in stds + list(st["project"]):
        rv = s.get("review")
        if isinstance(rv, dict) and not regex_problem(rv.get("pattern")):
            out.append((re.compile(rv["pattern"]), s))
    return out


def std_locked_literals(state):
    """[(token path, component regex, property regex, value, standard)] for component values a standard locks that code
    writes as a number (toast.success(msg, { duration: 3000 }) while component.toast.duration is locked at 4000ms). Only
    durations and plain numbers, read in milliseconds; anything else is left to the standard's own review pattern."""
    out = []
    if not std_has_records(state):
        return out
    house = load_standards()
    for sp, sid in std_held(state).items():
        m = re.match(r"^overrides\.component\.([a-z0-9]+(?:-[a-z0-9]+)*)\.([a-z0-9]+(?:-[a-z0-9]+)*)$", sp)
        val = std_current(state, sp)
        want = duration_ms(val) if isinstance(val, (dict, int, float)) and not isinstance(val, bool) else None
        if not m or want is None:
            continue
        comp = re.compile(r"\b" + re.escape(m.group(1).replace("-", "")) + r"\b", re.I)
        prop = re.compile(r"\b" + re.escape(camel(m.group(2).split("-"))) + r"\s*[:=]\s*(\d+(?:\.\d+)?)\b(?!\s*(?:s|ms)\b)")
        std = (std_find(state, sid, house)[0] if sid.startswith("PRJ-") else std_copy(state, sid, house)) or {"id": sid}
        out.append((shown_path(sp), comp, prop, want, std))
    return out


def std_design_md_lead(state):
    if any(s.get("authority") == "good-to-have" for s in std_state(state)["project"]):
        return ("**Follow these rules when you build.** Rules from sources marked non-negotiable lock their values; rules marked "
                "recommended are defaults the person may change. `engine.py review` checks the ones it can.")
    return ("**Follow these rules when you build.** They come from sources marked non-negotiable, their values are locked, and "
            "`engine.py review` checks the ones it can.")


def std_notes(state, sid, st, held):
    """' Your project standard PRJ-01 wins here.' and the like: where a higher rule holds a standard's value instead."""
    r = st["records"].get(sid) or {}
    taken = st["released"].get(sid) or {}
    kept = {p: (held.get(p, w) if str(w).startswith(("PRJ-", "STD-")) else w) for p, w in (r.get("kept") or {}).items() if p not in taken}
    beaten = sorted({held[p] for p in r.get("paths") or {} if held.get(p, sid) != sid and held[p].startswith("PRJ-")}
                    | {w for w in kept.values() if str(w).startswith("PRJ-")})
    over = std_beaten(state).get(sid)
    if over and over not in beaten:
        beaten.append(over)
    out = [f"Your project standard {', '.join(beaten)} wins here."] if beaten else []
    for p, x in taken.items():
        out.append(f"The person took `{shown_path(p)}` back ({x.get('decision')}): \"{x.get('why')}\"; it is `{_vw(std_current(state, p))}`.")
    wins = sorted({w for w in kept.values() if str(w).startswith("STD-")})
    if wins:
        out.append(f"House standard {', '.join(wins)} wins here.")
    for p, w in kept.items():
        if not str(w).startswith(("PRJ-", "STD-")):
            out.append(f"Your own value `{_vw(std_current(state, p))}` for `{shown_path(p)}` is kept here"
                       + (f" ({w})." if str(w).startswith("D-") else "."))
    return (" " + " ".join(out)) if out else ""


STD_MD_FILE = "standards.md"  # the full list, next to state.json; DESIGN.md carries the summary


def _values_full(values):
    """Every value of a standard, in full (standards.md never cuts one short, R22)."""
    items = list((values or {}).items()) if isinstance(values, dict) else []
    return "; ".join(f"{k} `{v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)}`" for k, v in items)


def std_version_words(state, house=None):
    """'house standards v3' for the version this system follows (else the installed file's), or ''."""
    house = house or load_standards()
    hv = std_state(state)["house_version"] or house["version"]
    return f"house standards v{hv}" if hv is not None else ""


def std_now_words(state, sid, st):
    """' Now: `motion.easing.exit` [0.4, 0, 1, 1].' for the values an overridden standard used to set (R23)."""
    paths = list(((st["records"].get(sid) or {}).get("paths") or {}))
    return (" Now: " + "; ".join(f"`{shown_path(p)}` {_vw(std_current(state, p))}" for p in paths) + ".") if paths else ""


def std_lock_words(state, group, st, held, full=False):
    """The values a theme's standards lock, each as it is in force: '`component.toast.duration` 5000ms (PRJ-01 wins)'.
    full: composite values in full too (standards.md), not pointed to."""
    locked = {}
    for g in group:
        for p, v in ((st["records"].get(g["id"]) or {}).get("paths") or {}).items():
            if p in (st["released"].get(g["id"]) or {}) or shown_path(p) in locked:
                continue  # the person took this value back (standard override --path), or a rule above already named it
            holder = held.get(p)
            cur = std_current(state, p) if holder and holder != g["id"] else v
            words = "a composite value (see standards.md)" if not full and isinstance(cur, dict) and "value" not in cur and "hex" not in cur \
                else _vw(cur)
            locked[shown_path(p)] = words + (f" ({holder} wins)" if holder and holder != g["id"] else "")
    return [f"`{p}` {v}" for p, v in locked.items()]


PROHIBIT = re.compile(r"^(Never|No|Don't|Do not|Avoid)\b")


def std_donts(state, followed, limit=5):
    """3 to 5 rules for the top of DESIGN.md's Standards section: the 'never' rules first (one per theme, then the rest),
    those review can check before the others, then other must rules with a check."""
    beaten = std_beaten(state)
    cands = [s for s in followed if s.get("strength") != "should" and s["id"] not in beaten and s.get("design_md", True)]
    ranked = sorted(cands, key=lambda s: (not PROHIBIT.match(s.get("title") or ""), not s.get("review")))
    ranked = [s for s in ranked if PROHIBIT.match(s.get("title") or "") or s.get("review")]
    out, themes = [], set()
    for s in ranked:  # one per theme first, so the list covers the ground
        if len(out) < limit and s.get("theme") not in themes:
            out.append(s)
            themes.add(s.get("theme"))
    out += [s for s in ranked if s not in out][:limit - len(out)]
    return out


def std_design_md(state, md_path=None):
    """DESIGN.md 'Standards' body, or '' when there are none (R23). DESIGN.md is read before every UI task, so it stays
    short: one plain line with the counts and the house version, 3 to 5 rules not to break, what is different in this
    project (another rule wins, overrides with the value now in force, the person's own standards), and every theme in one
    line folded under <details>. md_path: where the full list is, as seen from DESIGN.md."""
    house = load_standards()
    st = std_state(state)
    held = std_held(state)
    followed = std_followed(state, house)
    over = [s for s in (std_copy(state, i, house) for i in st["overridden"]) if s]
    proj_all = list(st["project"])
    if not followed and not over and not proj_all:
        return ""
    md_path = md_path or f"opendesigner/{STD_MD_FILE}"
    ver = std_version_words(state, house)
    shown = [s for s in followed if s.get("design_md", True)]
    head = (f"{ver[:1].upper() + ver[1:]}: " if ver and (followed or over) else "") + \
        (f"{len(followed)} rule{'s' if len(followed) != 1 else ''} followed in this project" if followed else "none followed in this project" if over else "")
    mine = f"{len(proj_all)} of your own" if followed or over else f"{len(proj_all)} project standard{'s' if len(proj_all) != 1 else ''} of your own"
    lines = [head + (", plus " if head and proj_all else "") + (mine if proj_all else "") + (f"; {len(over)} overridden" if over else "") + "."]
    donts = std_donts(state, followed)
    if donts:
        lines += ["", "**Don't break these:**"] + [f"- {s.get('title') or s['id']} ({s['id']})." for s in donts]
    exc = [(g, std_notes(state, g["id"], st, held)) for g in shown]
    exc = [(g, n) for g, n in exc if n]
    if exc:
        lines += ["", "**Where another rule wins in this project**"]
        lines += [f"- {g.get('title') or g['id']} ({g['id']}).{n}" for g, n in exc]
    if over:
        lines += ["", "**Overridden in this project**"]
        for s in over:
            o = st["overridden"][s["id"]]
            lines.append(f"- ~~{s.get('title') or s['id']}~~ Overridden in this project: \"{o.get('why')}\" ({o.get('decision')}). "
                         f"The house rule: {s.get('rule')} ({s['id']}).{std_now_words(state, s['id'], st)}")
    proj = [s for s in proj_all if s.get("design_md", True)]
    if proj:
        lines += ["", "**Project standards** (from sources the owner chose)"]
        for s in proj:
            vals = _values_words(s.get("values"))
            locks = std_lock_words(state, [s], st, held)
            lines.append(f"- {s.get('rule')}" + (f" Values: {vals}." if vals else "") + (f" Locks {', '.join(locks)}." if locks else "")
                         + f" ({s['id']}{', recommended' if s.get('authority') == 'good-to-have' else ''})" + std_notes(state, s["id"], st, held))
    if shown:
        lines += ["", f"<details><summary>Every theme ({len(shown)} rule{'s' if len(shown) != 1 else ''})</summary>", ""]
        for title, group in std_by_theme(house, shown):
            must = [g.get("title") or g["id"] for g in group if g.get("strength") != "should"]
            cnt = f"{len(group)} rule{'' if len(group) == 1 else 's'}" + ("" if len(must) == len(group) else f", {len(must)} must")
            names = ("; ".join(must[:8]) + (f"; and {len(must) - 8} more must rule{'s' if len(must) > 9 else ''}" if len(must) > 8 else "")) if must \
                else "recommended practice only"
            locks = std_lock_words(state, group, st, held)
            lines.append(f"- **{title}** ({cnt}): {names}." + (f" Locks {', '.join(locks)}." if locks else ""))
        lines += ["", "</details>"]
    rest = len(followed) - len(shown)
    lines += ["", f"Every rule, with its values, reasons and sources: `{md_path}`"
              + (f" (it also has the {rest} rule{'s' if rest != 1 else ''} this file leaves out)" if rest > 0 else "")
              + ". Read the themes you touch before you build."]
    return "\n".join(lines).rstrip()


def std_full_md(state):
    """The full standards list (opendesigner/standards.md), or '' when there are none (R22): every house standard this
    system follows, grouped by theme, with its rule, every value, why and sources (design_md only filters DESIGN.md);
    overridden ones with the person's reason and the value now in force; then the project standards. A value a higher
    rule holds instead (a project standard, the person's own value) is said next to the rule."""
    house = load_standards()
    st = std_state(state)
    followed = std_followed(state, house)
    shown = list(followed)
    for sid in st["overridden"]:
        s = std_copy(state, sid, house)
        if s and s not in shown:
            shown.append(s)
    proj = list(st["project"])
    if not shown and not proj:
        return ""
    ver = std_version_words(state, house)
    lines, held = [], std_held(state)
    notes = lambda sid: std_notes(state, sid, st, held)
    parts = ([f"{len(followed)} house rule{'s' if len(followed) != 1 else ''}"] if followed else []) \
        + ([f"{len(st['overridden'])} overridden"] if st["overridden"] else []) \
        + ([f"{len(proj)} project standard{'s' if len(proj) != 1 else ''} of its own"] if proj else [])
    lines += [(f"This system follows OpenDesigner's {ver}: " if ver and (followed or st["overridden"]) else "This system follows ")
              + (", ".join(parts[:-1]) + " and " + parts[-1] if len(parts) > 1 else parts[0]) + ".", ""]

    def more(s):
        out = []
        sets = std_lock_words(state, [s], st, held, full=True) if s["id"] not in st["overridden"] else []
        if sets:
            out.append(f"  - Sets: {', '.join(sets)}.")
        if s.get("why"):
            out.append(f"  - Why: {s['why']}")
        src = _source_ids(s)
        if src:
            out.append(f"  - Sources: {src}.")
        return out
    for title, group in std_by_theme(house, shown):
        lines += [f"**{title}**"]
        for s in group:
            vals = _values_full(s.get("values"))
            if s["id"] in st["overridden"]:
                o = st["overridden"][s["id"]]
                lines.append(f"- ~~{s.get('title') or s['id']}~~ Overridden in this project: \"{o.get('why')}\" ({o.get('decision')}). "
                             f"The house rule: {s.get('rule')}" + (f" Values: {vals}." if vals else "") + f" ({s['id']}).{std_now_words(state, s['id'], st)}")
            else:
                lines.append(f"- **{s.get('title') or s['id']}.** {s.get('rule')}" + (f" Values: {vals}." if vals else "")
                             + f" ({s['id']}{', should' if s.get('strength') == 'should' else ''})" + notes(s["id"]))
            lines += more(s)
        lines.append("")
    if proj:
        lines.append("**Project standards** (from sources the owner chose)")
        for s in proj:
            vals = _values_full(s.get("values"))
            src = ", ".join(x.get("url") or x.get("id") or "" for x in s.get("sources") or [] if isinstance(x, dict))
            lines.append(f"- {s.get('rule')}" + (f" Values: {vals}." if vals else "")
                         + f" ({s['id']}{', recommended' if s.get('authority') == 'good-to-have' else ''}" + (f"; source: {src}" if src else "") + ")"
                         + notes(s["id"]))
            sets = std_lock_words(state, [s], st, held, full=True)
            if sets:
                lines.append(f"  - Sets: {', '.join(sets)}.")
            if s.get("why"):
                lines.append(f"  - Why: {s['why']}")
        lines.append("")
    return "\n".join(lines).rstrip()


def std_decision_rows(state, decs):
    """decisions.md's latest entry per path, plus the values standards put in place after it: grouped decisions do not name
    paths in their titles, so DESIGN.md's Decisions lines and table read them from the records."""
    if not std_has_records(state):
        return decs
    st = std_state(state)
    house = load_standards()
    held, out = std_held(state), dict(decs)
    for sid, rec in st["records"].items():
        if sid in st["overridden"]:
            continue
        soft = rec.get("locked", True) is False
        for p, v in (rec.get("paths") or {}).items():
            if (not soft and held.get(p) != sid) or _dnum((out.get(p) or {}).get("id")) >= _dnum(rec.get("decision")):
                continue
            s = (std_find(state, sid, house)[0] if sid.startswith("PRJ-") else std_copy(state, sid, house)) or {}
            out[p] = {"id": rec.get("decision"), "value": json.dumps(v, ensure_ascii=False), "set_by": "reference" if soft else "standard",
                      "locked": not soft, "reason": f"{'project' if sid.startswith('PRJ-') else 'house'} standard {sid}: "
                                                    + (s.get("rule") or "").strip()}
    return out


# =============================================================================================
# Commands that write outputs
# =============================================================================================

def load_state(d):
    sp = os.path.join(d, "state.json")
    if not os.path.exists(sp):
        raise SystemExit(f"no state at {sp}; run `engine.py init --dir {d}` first")
    return read_json(sp)


def cmd_generate(d, quiet=False):
    state = load_state(d)
    files, meta, ctx = generate_system(state)
    tokdir = os.path.join(d, "tokens")
    os.makedirs(tokdir, exist_ok=True)
    for fn in os.listdir(tokdir):  # drop stale token files (for example color.dark after dark mode is turned off)
        if fn.endswith(".json") and fn not in files:
            os.remove(os.path.join(tokdir, fn))
    for fn, data in files.items():
        dump_json(os.path.join(tokdir, fn), data)
    if not quiet:
        print(f"generated {len(files)} files in {tokdir}")
        dl = ", ".join(f"{k} {v}" for k, v in meta["dials"].items())
        print(f"  dials: {dl}")
        print(f"  type: base {meta['type']['base']}px x {meta['type']['ratio']} -> {meta['type']['sizes']}")
        print(f"  accent: {' '.join(meta['ramps']['accent']['light']['hex'])}")
    return files, meta, ctx


# =============================================================================================
# Exporters
# =============================================================================================

def kebab(seg):
    return re.sub(r"(?<=[a-z0-9])([A-Z])", r"-\1", str(seg)).lower()


def css_var(prefix, path):
    return f"--{prefix}-" + "-".join(kebab(s) for s in path.split("."))


def fmt_num(x):
    if isinstance(x, float) and x.is_integer():
        return str(int(x))
    return f"{x:g}" if isinstance(x, (int, float)) else str(x)


def css_color(v):
    hx = hex_of(v)
    a = v.get("alpha") if isinstance(v, dict) else None
    if a is not None and a < 1:
        r, g, b = hex_to_rgb8(hx)
        return f"rgb({r} {g} {b} / {fmt_num(rnd(a, 3))})"
    return hx


def css_dim(v, rem=False):
    if v["unit"] == "px" and rem:
        return f"{fmt_num(rnd(v['value'] / 16, 4))}rem"
    return f"{fmt_num(v['value'])}{v['unit']}"


def css_duration(v):
    return f"{fmt_num(v['value'])}{v['unit']}"


def css_bezier(v):
    return "cubic-bezier(" + ", ".join(fmt_num(x) for x in v) + ")"


def spring_ext(tokinfo, flat):
    """Follow an alias chain to a spring's $extensions, if any."""
    seen = 0
    t = tokinfo
    while t is not None and seen < 10:
        ext = (t.get("$extensions") or {}).get(NS, {})
        if "spring" in ext:
            return ext
        v = t.get("$value")
        if isinstance(v, str) and v.startswith("{"):
            t = flat.get(v[1:-1])
            seen += 1
        else:
            return None
    return None


def css_decls(flat, prefix, paths, rem_fonts=True):
    """CSS declarations for the given token paths. Aliases become var() so modes cascade."""
    out = []
    for path in paths:
        t = flat[path]
        typ, raw, val = t["type"], t["$value"], t["resolved"]
        name = css_var(prefix, path)
        if isinstance(raw, str) and raw.startswith("{") and typ not in ("transition",):
            out.append(f"  {name}: var({css_var(prefix, raw[1:-1])});")
            if typ == "typography":
                pass
            continue
        css_lit = ((t.get("$extensions") or {}).get(NS) or {}).get("css")  # a fluid size or a ch measure that DTCG cannot hold
        if typ == "color":
            out.append(f"  {name}: {css_color(val)};")
        elif typ == "dimension" and isinstance(css_lit, str):
            out.append(f"  {name}: {css_lit};")
        elif typ == "dimension":
            out.append(f"  {name}: {css_dim(val, rem=rem_fonts and path.startswith('font.size.'))};")
        elif typ == "number" and path.startswith("font.tracking."):
            out.append(f"  {name}: {fmt_num(val)}em;")
        elif typ == "duration":
            out.append(f"  {name}: {css_duration(val)};")
        elif typ == "cubicBezier":
            out.append(f"  {name}: {css_bezier(val)};")
        elif typ == "number":
            out.append(f"  {name}: {fmt_num(val)};")
        elif typ == "fontWeight":
            out.append(f"  {name}: {fmt_num(val)};")
        elif typ == "fontFamily":
            fams = val if isinstance(val, list) else [val]
            out.append(f"  {name}: " + ", ".join(f'"{f}"' if " " in f else f for f in fams) + ";")
        elif typ == "shadow":
            layers = raw if isinstance(raw, list) else [raw]
            parts = []
            for lay, rl in zip(layers, val if isinstance(val, list) else [val]):
                if isinstance(lay, str):  # alias to another shadow token
                    parts.append(f"var({css_var(prefix, lay[1:-1])})")
                    continue
                col = lay["color"]
                cs = f"var({css_var(prefix, col[1:-1])})" if isinstance(col, str) and col.startswith("{") else css_color(rl["color"])
                parts.append(("inset " if lay.get("inset") else "") + " ".join(css_dim(rl[k]) for k in ("offsetX", "offsetY", "blur", "spread")) + " " + cs)
            out.append(f"  {name}: {', '.join(parts)};")
        elif typ == "gradient":  # kind, angle and interpolation come from $extensions (DC-L01-25)
            ext = (t.get("$extensions") or {}).get(NS, {})
            stops = []
            for st_raw, st_val in zip(raw, val):
                c = st_raw["color"]
                cs = f"var({css_var(prefix, c[1:-1])})" if isinstance(c, str) and c.startswith("{") else css_color(st_val["color"])
                stops.append(f"{cs} {fmt_num(rnd(st_val['position'] * 100, 2))}%")
            how = f"in {ext.get('interpolation', 'oklab')}"
            if ext.get("kind") == "radial":
                x, y = ext.get("at") or [50, 50]
                head = f"radial-gradient({ext.get('shape', 'circle')} at {fmt_num(x)}% {fmt_num(y)}% {how}"
            else:
                head = f"linear-gradient({fmt_num(ext.get('angle', 180))}deg {how}"
            out.append(f"  {name}: {head}, {', '.join(stops)});")
        elif typ == "typography":
            fam = raw["fontFamily"]
            famv = f"var({css_var(prefix, fam[1:-1])})" if isinstance(fam, str) and fam.startswith("{") else ", ".join(val["fontFamily"])
            size = raw["fontSize"]
            sizev = f"var({css_var(prefix, size[1:-1])})" if isinstance(size, str) else css_dim(val["fontSize"], rem=True)
            wt = raw["fontWeight"]
            wv = f"var({css_var(prefix, wt[1:-1])})" if isinstance(wt, str) and wt.startswith("{") else fmt_num(val["fontWeight"])
            em = (t.get("$extensions") or {}).get(NS, {}).get("letterSpacingEm", 0)
            lh = fmt_num(val["lineHeight"])
            out.append(f"  {name}-size: {sizev};")
            out.append(f"  {name}-line-height: {lh};")
            out.append(f"  {name}-weight: {wv};")
            out.append(f"  {name}-tracking: {fmt_num(em)}em;")
            out.append(f"  {name}-family: {famv};")
            out.append(f"  {name}: {wv} {sizev}/calc({lh} * var(--{prefix}-script-line-height-scale, 1)) {famv};")
        elif typ == "transition":
            sp = spring_ext(t, flat)
            if sp and "css" in sp:
                out.append(f"  {name}-duration: {sp['css']['durationMs']}ms;")
                out.append(f"  {name}-easing: {sp['css']['easing']};")
            else:
                out.append(f"  {name}-duration: {css_duration(val['duration'])};")
                out.append(f"  {name}-easing: {css_bezier(val['timingFunction'])};")
            out.append(f"  {name}-delay: {css_duration(val['delay'])};")
    mesh = [p for p in paths if re.fullmatch(r"gradient\.mesh\.\d+", p)]
    if mesh:  # the layers as one background, declared beside them so each theme gets its own
        out.append(f"  {css_var(prefix, 'gradient.mesh')}: " + ", ".join(f"var({css_var(prefix, p)})" for p in mesh) + ";")
    return out


def token_paths_in(files, fnames):
    paths = []
    for fn in fnames:
        paths += list(flatten(files[fn]))
    return paths


def export_css(files, meta, prefix):
    res = files["opendesigner.resolver.json"]
    mods = res.get("modifiers", {})
    foundation_files = [s["$ref"] for s in res["sets"]["foundation"]["sources"]]
    theme_ctx = mods.get("theme", {}).get("contexts") or {meta["modes"][0]: res["sets"]["theme"]["sources"]}
    default_theme = mods.get("theme", {}).get("default", meta["modes"][0])
    dens = mods["density"]
    mot = mods["motion"]
    head = [f"/* {meta.get('name')} design tokens. Generated by the OpenDesigner engine {ENGINE_VERSION} from state.json;",
            "   do not edit by hand. Source of truth: tokens/*.tokens.json (DTCG 2025.10) + opendesigner.resolver.json.",
            "   Themes: prefers-color-scheme with a [data-theme] override. Density: [data-density]. Motion: prefers-reduced-motion",
            "   with a [data-motion] override. Font sizes are rem so browser text zoom works (WCAG 1.4.4).",
            f"   Text: use the .{prefix}-text-* classes, or set font and letter-spacing together; the font shorthand alone drops tracking. */", ""]
    lines = list(head)

    def block(selector, choice, fnames, indent=""):
        flat = resolve_all(files, choice)
        paths = token_paths_in(files, fnames)
        body = css_decls(flat, prefix, paths)
        return [f"{indent}{selector} {{"] + [indent + b for b in body] + [f"{indent}}}"]

    base_choice = {"theme": default_theme, "density": dens["default"], "motion": mot["default"]}
    lines += block(":root", base_choice, foundation_files)
    lines.append("")
    for mode, srcs in theme_ctx.items():
        fn = [s["$ref"] for s in srcs]
        sel = f':root, [data-theme="{mode}"]' if mode == default_theme else f'[data-theme="{mode}"]'
        blk = block(sel, dict(base_choice, theme=mode), fn)
        blk.insert(1, f"  color-scheme: {mode};")
        lines += blk + [""]
    if "dark" in theme_ctx and default_theme != "dark":
        blk = block(':root:not([data-theme="light"])', dict(base_choice, theme="dark"),
                    [s["$ref"] for s in theme_ctx["dark"]], indent="  ")
        blk.insert(1, "    color-scheme: dark;")
        lines += ["@media (prefers-color-scheme: dark) {"] + blk + ["}", ""]
    for dname, srcs in dens["contexts"].items():
        sel = f':root, [data-density="{dname}"]' if dname == dens["default"] else f'[data-density="{dname}"]'
        lines += block(sel, dict(base_choice, density=dname), [s["$ref"] for s in srcs]) + [""]
    for cname, srcs in mot["contexts"].items():
        sel = f':root, [data-motion="{cname}"]' if cname == mot["default"] else f'[data-motion="{cname}"]'
        lines += block(sel, dict(base_choice, motion=cname), [s["$ref"] for s in srcs]) + [""]
    if mot["default"] != "reduced":
        lines += ["@media (prefers-reduced-motion: reduce) {"]
        lines += block(':root:not([data-motion="standard"])', dict(base_choice, motion="reduced"),
                       [s["$ref"] for s in mot["contexts"]["reduced"]], indent="  ") + ["}", ""]
    base_flat = resolve_all(files, base_choice)
    if "color.surface.glass" in base_flat:  # reduced transparency and more contrast get the solid twin (STD-accessibility-motion-11, DC-L04-16)
        # :root:not(...) ties the dark-scheme block's specificity, so the solid twin still wins when the device is in dark mode
        sel = ':root, :root:not([data-theme="light"]), [data-theme]'
        lines += ["/* Glass turns solid for people who reduce transparency or ask for more contrast. */",
                  "@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {",
                  f"  {sel} {{ {css_var(prefix, 'color.surface.glass')}: var({css_var(prefix, 'color.surface.glass-fallback')});"
                  + (f" {css_var(prefix, 'material.glass.blur')}: 0px;" if "material.glass.blur" in base_flat else "") + " }", "}", ""]
    ink = f"var({css_var(prefix, 'color.text.primary')})"
    paint = {  # textures are image assets, drawn here (DC-L19-12); static and behind content
        "grain": ("url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E"
                  "%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E"
                  "%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", "overlay"),
        "halftone": (f"radial-gradient({ink} 1.5px, transparent 1.6px) 0 0 / 8px 8px", "normal"),  # normal: light dots show on dark too
        "scanlines": (f"repeating-linear-gradient(0deg, {ink} 0 1px, transparent 1px 3px)", "normal"),
    }
    for kind, (image, blend) in paint.items():
        if f"texture.{kind}.opacity" in base_flat:
            lines += [f"/* {kind.title()}: brand surfaces only, never over body text or controls. Off with more contrast or forced colors. */",
                      f".{prefix}-{kind} {{ position: relative; isolation: isolate; }}",
                      f".{prefix}-{kind}::before {{ content: \"\"; position: absolute; inset: 0; z-index: -1; pointer-events: none; "
                      f"background: {image}; opacity: var({css_var(prefix, f'texture.{kind}.opacity')}); mix-blend-mode: {blend}; }}",
                      f"@media (prefers-contrast: more), (forced-colors: active) {{ .{prefix}-{kind}::before {{ display: none; }} }}", ""]
    tg = meta["space"]["targets"]
    if "touch" in tg and "pointer" in tg:
        lines += ["/* Hit-area floor per input (L14 I-1, DC-L03-12): pointer 24px (WCAG 2.5.8), touch 44/48. */",
                  "@media (pointer: fine) {", f"  :root {{ {css_var(prefix, 'size.target.min')}: {tg['pointer']}px; }}", "}",
                  "@media (pointer: coarse) {", f"  :root {{ {css_var(prefix, 'size.target.min')}: {tg['touch']}px; }}", "}", ""]
    # Display P3 upgrades where sRGB clipped chroma (luminance kept within 1.5%, so contrast pairs hold)
    p3 = []
    prim = flatten(files["primitives.tokens.json"])
    for path, t in prim.items():
        ext = (t.get("$extensions") or {}).get(NS, {})
        if "p3" in ext:
            c = ext["p3"]["components"]
            p3.append(f"    {css_var(prefix, path)}: color(display-p3 {' '.join(fmt_num(x) for x in c)});")
    if p3:
        lines += ["@media (color-gamut: p3) {", "  :root {"] + p3 + ["  }", "}", ""]
    scripts = meta["type"].get("scripts") or {}
    lang = {"Arab": "ar", "Beng": "bn", "Hans": "zh-Hans", "Hant": "zh-Hant", "Deva": "hi", "Jpan": "ja", "Kore": "ko", "Thai": "th",
            "Viet": "vi", "Mymr": "my", "Telu": "te", "Aran": "ur"}
    for code, info in sorted(scripts.items()):
        if code in lang:
            f = info.get("lineHeightFactor", 1)
            if code in ("Hans", "Hant", "Jpan", "Kore"):
                f = rnd(info["cjk"]["lineHeight"]["body"] / 1.5, 3)
            lines += [f":lang({lang[code]}) {{ --{prefix}-script-line-height-scale: {fmt_num(f)}; }}"
                      + (" /* zero tracking for this script (DC-L02-14) */" if info.get("zeroTracking") else "")]
    if scripts:
        lines.append("")
    # utility classes for text styles and focus
    lines.append("/* Text style classes (one per typography token). */")
    for path, t in resolve_all(files, base_choice).items():
        if t["type"] == "typography":
            v = css_var(prefix, path)
            cls = "." + prefix + "-" + "-".join(kebab(s) for s in path.split("."))
            ext_ = (t.get("$extensions") or {}).get(NS, {})
            extra = (" text-transform: uppercase;" if ext_.get("textTransform") else "") + \
                (f" font-variant-numeric: {ext_['fontVariantNumeric']};" if ext_.get("fontVariantNumeric") else "")
            lines.append(f"{cls} {{ font: var({v}); letter-spacing: var({v}-tracking);{extra} }}")
    lines += ["", f".{prefix}-focus-ring:focus-visible {{",
              f"  outline: var({css_var(prefix, 'focus.ring.width')}) solid var({css_var(prefix, 'color.border.focus')});",
              f"  outline-offset: var({css_var(prefix, 'focus.ring.offset')});"]
    if any(k.endswith("focus-inner") for k in flatten(files[[s['$ref'] for s in theme_ctx[default_theme]][0]])):
        lines.append(f"  box-shadow: 0 0 0 var({css_var(prefix, 'focus.ring.offset')}) var({css_var(prefix, 'color.border.focus-inner')});")
    lines += ["}", "@media (forced-colors: active) {", f"  .{prefix}-focus-ring:focus-visible {{ outline-color: Highlight; }}", "}", ""]
    lines += corner_shape_css(meta, prefix)
    return "\n".join(lines)


def corner_shape_css(meta, prefix):
    """Q-shape-04 squircle-enhance (DC-L04-04): Apple's continuous corner on the web where the browser can draw corner-shape.
    superellipse(K) at radiusScale times the radius follows SwiftUI's curve within 0.4% of the radius (levers
    formulas.radius.continuous, measured with tools/fit_corner.py); the plain squircle keyword is squarer than iOS. corner-shape
    is CSS Borders 4, not Baseline yet, so it sits behind @supports and other browsers keep the circular arc at the token radius,
    which is within 1.4% of the radius of Apple's curve. A surface sets --{p}-corner-radius instead of border-radius and takes the
    class; the radius is registered as not inherited, so the boxes inside keep their own. Capsules and circles keep round ends."""
    if ((meta.get("shape") or {}).get("cornerShape")) != "squircle-enhance":
        return []
    c = levers()["formulas"]["radius"]["continuous"]
    k, scale, p = c["superellipse"], c["radiusScale"], prefix
    return ["/* Corner shape (Q-shape-04 squircle-enhance): Apple's continuous corner where the browser draws corner-shape,",
            f"   the same radius as a circular arc elsewhere. Use: .card {{ --{p}-corner-radius: var(--{p}-radius-container); }} with class=\"{p}-corners\".",
            f"   superellipse({k}) at {scale} times the radius follows Apple's curve within {round(c['maxError'] * 100, 1):g}% of the radius. */",
            f"@property --{p}-corner-radius {{ syntax: \"<length-percentage>\"; inherits: false; initial-value: 0px; }}",
            f":root {{ --{p}-corner-scale: 1; --{p}-corner-shape: round; }}",
            f"@supports (corner-shape: superellipse({k})) {{ :root {{ --{p}-corner-scale: {scale}; --{p}-corner-shape: superellipse({k}); }} }}",
            f".{p}-corners {{ border-radius: calc(var(--{p}-corner-radius) * var(--{p}-corner-scale)); corner-shape: var(--{p}-corner-shape); }}", ""]


TW_COLOR_MAP = [("color.surface.", "surface-"), ("color.text.", "fg-"), ("color.bg.", ""), ("color.border.", "line-"),
                ("color.icon.", "icon-"), ("color.overlay.", "overlay-"), ("color.chart.", "chart-"), ("color.workflow.", "workflow-")]


def export_tailwind(files, meta, prefix, reset=True):
    """Tailwind CSS v4 theme (U5 F7, F8, F15): imports tokens.css itself, so one @import is enough; optionally switches off
    Tailwind's default colors, text sizes, radii and shadows so only the design system's values compile."""
    flat = resolve_all(files, {})
    unit = meta["space"]["unit"]
    lines = [f"/* Tailwind CSS v4 theme for {meta.get('name')}. Generated by the OpenDesigner engine {ENGINE_VERSION}.",
             "   Usage, in your main CSS file (one import is enough; this file imports tokens.css itself):",
             "     @import \"tailwindcss\";",
             "     @import \"<path from your CSS file>/opendesigner/build/tailwind/theme.css\";",
             "   @theme inline points utilities at the design-system variables, so light/dark, density and reduced",
             "   motion keep working through data-theme / data-density / data-motion and the media queries in tokens.css."
             + (" Tailwind's default colors, text sizes, radii and shadows are switched off (exports.tailwindReset); "
                "set it to false to keep them." if reset else "") + " */",
             "@import \"../css/tokens.css\";", ""]
    if reset:
        lines += ["@theme {", "  --color-*: initial;", "  --text-*: initial;", "  --radius-*: initial;", "  --shadow-*: initial;", "}", ""]
    bps = (meta.get("space") or {}).get("breakpoints") or {}
    if bps:  # media queries cannot read var(), so breakpoints are literal values
        lines += ["@theme {"] + (["  --breakpoint-*: initial;"] if reset else []) + \
                 [f"  --breakpoint-{k}: {fmt_num(rnd(v / 16, 4))}rem; /* {v}px */" for k, v in bps.items()] + ["}", ""]
    lines += ["@theme inline {", f"  --spacing: {unit}px; /* p-1 = one base unit (LEVERS B8) */"]
    for path in sorted(flat):
        t = flat[path]
        v = f"var({css_var(prefix, path)})"
        if t["type"] == "color" and not re.match(r"color\.(neutral|accent|action|success|warning|danger|info|discovery|neutral-alpha|accent2|accent3|white|black|brand|focus)\b", path):
            for src, dst in TW_COLOR_MAP:
                if path.startswith(src):
                    rest = "-".join(kebab(s_) for s_ in path[len(src):].split("."))
                    lines.append(f"  --color-{dst}{rest}: {v};")
                    break
    lines.append("  --color-white: #fff;")
    lines.append("  --color-transparent: transparent;")
    lines.append("  --color-current: currentColor;")
    for fam in ("text", "display", "mono"):
        name = {"text": "sans", "display": "display", "mono": "mono"}[fam]
        lines.append(f"  --font-{name}: var({css_var(prefix, 'font.family.' + fam)});")
    for path in sorted(flat):
        if path.startswith("font.weight."):
            lines.append(f"  --font-weight-{kebab(path.split('.')[-1])}: var({css_var(prefix, path)});")
    for path in sorted(flat):
        t = flat[path]
        if t["type"] == "typography":
            n = "-".join(kebab(s_) for s_ in path.split(".")[1:])
            v = css_var(prefix, path)
            lines += [f"  --text-{n}: var({v}-size);", f"  --text-{n}--line-height: var({v}-line-height);",
                      f"  --text-{n}--letter-spacing: var({v}-tracking);", f"  --text-{n}--font-weight: var({v}-weight);"]
    for path in sorted(flat):  # tracking-caps-label, tracking-display (Tailwind's tracking-* namespace)
        if path.startswith("font.tracking."):
            lines.append(f"  --tracking-{kebab(path.split('.')[-1])}: var({css_var(prefix, path)});")
    if "layout.container.max" in flat:  # max-w-page, max-w-prose, max-w-lead (Tailwind's container-* namespace)
        lines += [f"  --container-page: var({css_var(prefix, 'layout.container.max')});"] + \
                 [f"  --container-{k}: var({css_var(prefix, 'layout.measure.' + k)});" for k in ("prose", "lead") if f"layout.measure.{k}" in flat]
    for path in sorted(flat):
        if re.match(r"space\.(inset|stack|inline|section)\.", path):
            lines.append(f"  --spacing-{'-'.join(kebab(s_) for s_ in path.split('.')[1:])}: var({css_var(prefix, path)});")
        elif re.match(r"size\.(control|target|icon|row)\.", path):  # h-control-md, size-icon-sm (no doubled size- prefix)
            lines.append(f"  --spacing-{'-'.join(kebab(s_) for s_ in path.split('.')[1:])}: var({css_var(prefix, path)});")
    for r in ("detail", "control", "control-sm", "container", "overlay", "person", "full"):
        lines.append(f"  --radius-{kebab(r)}: var({css_var(prefix, 'radius.' + r)});")
    pressed = ("pressed",) if "elevation.pressed" in flatten(files["semantic.tokens.json"]) else ()
    for e in ("raised", "floating", "overlay") + pressed:
        lines.append(f"  --shadow-{e}: var({css_var(prefix, 'elevation.' + e)});")
    first = ("standard", "enter", "exit", "linear")
    curves = sorted((p_ for p_ in flat if p_.startswith("motion.easing.") and flat[p_]["type"] == "cubicBezier"),
                    key=lambda p_: (first.index(p_[14:]) if p_[14:] in first else len(first), p_))
    for path in curves:  # every curve, so hover, drawer and toast get classes too (R09)
        lines.append(f"  --ease-{'-'.join(kebab(s_) for s_ in path[14:].split('.'))}: var({css_var(prefix, path)});")
    lines += ["}", ""]
    lines += ["/* Semantic motion helpers (durations follow the reduced-motion mode automatically). */",
              "@utility transition-feedback {", f"  transition-duration: var({css_var(prefix, 'motion.transition.feedback')}-duration);",
              f"  transition-timing-function: var({css_var(prefix, 'motion.transition.feedback')}-easing);", "}", ""]
    num = [p for p in flat if p.startswith("text.numeric.")]
    if num:
        lines += ["/* Tabular figures for amounts and tables (text.numeric.*). */", "@utility tabular {", "  font-variant-numeric: tabular-nums;", "}", ""]
    if (meta.get("shape") or {}).get("cornerShape") == "squircle-enhance":  # the variable comes from tokens.css (corner_shape_css)
        lines += ["/* Apple's continuous corner where the browser draws corner-shape (Q-shape-04 squircle-enhance).",
                  f"   Set the radius with [--{prefix}-corner-radius:var(--{prefix}-radius-container)], not rounded-*. */",
                  "@utility corners {", f"  border-radius: calc(var(--{prefix}-corner-radius) * var(--{prefix}-corner-scale));",
                  f"  corner-shape: var(--{prefix}-corner-shape);", "}", ""]
    return "\n".join(lines)


def _figma_rgba(v):
    r, g, b = (c / 255 for c in hex_to_rgb8(hex_of(v)))
    return {"r": rnd(r, 4), "g": rnd(g, 4), "b": rnd(b, 4), "a": rnd(v.get("alpha", 1) if isinstance(v, dict) else 1, 3)}


def figma_scopes(path, typ):
    if typ == "color":
        if path.startswith("color.text."):
            return ["TEXT_FILL"]
        if path.startswith(("color.surface.", "color.bg.", "color.overlay.")):
            return ["FRAME_FILL", "SHAPE_FILL"]
        if path.startswith("color.border."):
            return ["STROKE_COLOR"]
        if path.startswith("color.icon."):
            return ["SHAPE_FILL", "STROKE_COLOR"]
        if path.startswith("color.shadow."):
            return ["EFFECT_COLOR"]
        if path.startswith("color.chart."):  # marks are shapes and lines; labels are text
            return ["TEXT_FILL"] if path == "color.chart.label" else ["SHAPE_FILL", "STROKE_COLOR"]
        return []
    if path.startswith(("space.", "layout.gutter", "layout.margin")):
        return ["GAP"]
    if path.startswith(("size.control", "size.target", "size.icon", "layout.container", "layout.measure")):
        return ["WIDTH_HEIGHT"]
    if path.startswith("radius."):
        return ["CORNER_RADIUS"]
    if path.startswith(("border.width", "focus.ring", "icon.stroke")):
        return ["STROKE_FLOAT"]
    if path.startswith("font.size."):
        return ["FONT_SIZE"]
    if path.startswith("font.line-height."):
        return ["LINE_HEIGHT"]
    if path.startswith("font.weight."):
        return ["FONT_WEIGHT"]
    if path.startswith("font.family."):
        return ["FONT_FAMILY"]
    if path.startswith("opacity."):
        return ["OPACITY"]
    return []


def code_syntax(prefix, path):
    """Figma code syntax that matches the names the Swift and Compose exports actually define (DC-L07-20)."""
    parts = path.split(".")
    P, K = prefix.upper(), prefix.capitalize()
    out = {"WEB": f"var({css_var(prefix, path)})"}
    if re.match(r"color\.(surface|text|bg|border|icon|overlay|shadow)\.", path):
        out["iOS"] = f"{P}.Colors.{camel(parts[1:])}"
        out["ANDROID"] = f"Local{K}Colors.current.{camel(parts[1:])}"
    elif re.match(r"(space|size)\.", path):
        out["iOS"] = f"{P}.Space.{camel(parts)}"
        out["ANDROID"] = f"{K}Space.{camel(parts)}"
    elif re.match(r"(radius|border|focus)\.", path):
        out["iOS"] = f"{P}.Radius.{camel(parts)}"
        out["ANDROID"] = f"{K}Space.{camel(parts)}"
    elif path.startswith("motion.duration."):
        out["iOS"] = f"{P}.Motion.{camel(parts[1:])}"
        out["ANDROID"] = f"{K}Motion.{camel(parts[1:])}Ms"
    return out


GENERIC_FONTS = {"system-ui", "-apple-system", "blinkmacsystemfont", "ui-sans-serif", "ui-monospace", "ui-serif", "sans-serif",
                 "serif", "monospace", "segoe ui", "helvetica neue", "arial", "sf mono", "menlo", "consolas", "liberation mono"}


def figma_font(fams):
    """Figma needs a real family name: the first non-generic family, else Inter / Roboto Mono (both on Google Fonts)."""
    fams = fams if isinstance(fams, list) else [fams]
    for f in fams:
        if f.lower() not in GENERIC_FONTS:
            return f
    return "Roboto Mono" if any("mono" in f.lower() for f in fams) else "Inter"


FIGMA_STYLE = {100: "Thin", 200: "Extra Light", 300: "Light", 400: "Regular", 500: "Medium", 600: "Semi Bold", 700: "Bold",
               800: "Extra Bold", 900: "Black"}


def export_figma(files, meta, state, prefix):
    res = files["opendesigner.resolver.json"]
    mods = res.get("modifiers", {})
    plan = (state.get("exports") or {}).get("figmaPlan", "professional")
    limit = FIGMA_MODE_LIMITS.get(plan, 10)
    flat0 = resolve_all(files, {})
    primitive_paths = {p for p in token_paths_in(files, ["primitives.tokens.json"])
                       if flat0.get(p, {}).get("type") in ("color", "dimension", "number", "fontWeight", "fontFamily")}

    def var_entry(path, t, collection, modes_vals):
        typ = t["type"]
        ftype = {"color": "COLOR", "dimension": "FLOAT", "number": "FLOAT", "fontWeight": "FLOAT", "fontFamily": "STRING",
                 "duration": "TIMING", "cubicBezier": "EASING"}.get(typ)
        if not ftype:
            return None
        e = {"name": path.replace(".", "/"), "type": ftype, "valuesByMode": modes_vals,
             "scopes": [] if path in primitive_paths else figma_scopes(path, typ),
             "codeSyntax": code_syntax(prefix, path), "description": (t.get("$description") or "")[:500]}
        if ftype == "TIMING":
            e["fallback"] = {"type": "FLOAT", "unit": "ms"}
        if ftype == "EASING":
            e["fallback"] = {"type": "STRING", "format": "cubic-bezier(x1, y1, x2, y2)"}
        return e

    def value_for(path, t, flatc, primitive_names):
        raw = t["$value"]
        if isinstance(raw, str) and raw.startswith("{") and raw[1:-1] in primitive_names:
            return {"type": "VARIABLE_ALIAS", "name": raw[1:-1].replace(".", "/"), "collection": primitive_names[raw[1:-1]]}
        v = t["resolved"]
        typ = t["type"]
        if typ == "color":
            return _figma_rgba(v)
        if typ == "dimension":
            return rnd(_px(v), 3)
        if typ == "duration":
            return rnd(v["value"] / (1000 if v["unit"] == "ms" else 1), 4)  # plugin API timing is in seconds (L07)
        if typ == "cubicBezier":
            return {"type": "CUBIC_BEZIER", "x1": v[0], "y1": v[1], "x2": v[2], "y2": v[3]}
        if typ == "fontFamily":
            return v[0] if isinstance(v, list) else v
        return v

    collections = []
    names = {}
    # 1. Primitives (hidden from publishing)
    prim_vars = []
    for p in sorted(primitive_paths):
        t = flat0[p]
        ent = var_entry(p, t, "Primitives", {"Value": value_for(p, t, flat0, {})})
        if ent:
            prim_vars.append(ent)
            names[p] = "Primitives"
    collections.append({"name": "Primitives", "modes": ["Value"], "hiddenFromPublishing": True, "variables": prim_vars})

    def moded(collection, modifier, fnames_by_ctx):
        ctxs = list(fnames_by_ctx)
        per = {c: resolve_all(files, {modifier: c}) if modifier else flat0 for c in ctxs}
        paths = token_paths_in(files, fnames_by_ctx[ctxs[0]])
        vars_ = []
        for p in paths:
            t0 = per[ctxs[0]][p]
            vals = {c.title(): value_for(p, per[c][p], per[c], names) for c in ctxs}
            ent = var_entry(p, t0, collection, vals)
            if ent:
                vars_.append(ent)
        return {"name": collection, "modes": [c.title() for c in ctxs], "variables": vars_}
    theme_srcs = {c: [s["$ref"] for s in v] for c, v in mods["theme"]["contexts"].items()} if "theme" in mods else \
        {meta["modes"][0]: [s["$ref"] for s in res["sets"]["theme"]["sources"]]}
    collections.append(moded("Color", "theme" if "theme" in mods else None, theme_srcs))
    collections.append(moded("Density", "density", {c: [s["$ref"] for s in v] for c, v in mods["density"]["contexts"].items()}))
    # motion: transitions become duration + easing variables per mode
    mvars = []
    for c in mods["motion"]["contexts"]:
        pass
    per = {c: resolve_all(files, {"motion": c}) for c in mods["motion"]["contexts"]}
    for p in sorted(k for k in per["standard"] if k.startswith("motion.transition.")):
        for part in ("duration", "easing"):
            vals = {}
            for c, fl in per.items():
                sp = spring_ext(fl[p], fl)
                v = fl[p]["resolved"]
                if part == "duration":
                    vals[c.title()] = rnd((sp["css"]["durationMs"] if sp and c == "standard" else v["duration"]["value"]) / 1000, 4)
                else:
                    if sp and c == "standard" and sp["spring"]["dampingRatio"] < 1:
                        vals[c.title()] = {"type": "SPRING", "damping": sp["spring"]["dampingRatio"], "stiffness": sp["spring"]["stiffness"],
                                           "mass": 1, "bounce": sp["apple"]["bounce"]}
                    else:
                        tf = v["timingFunction"]
                        vals[c.title()] = {"type": "CUBIC_BEZIER", "x1": tf[0], "y1": tf[1], "x2": tf[2], "y2": tf[3]}
            mvars.append({"name": p.replace(".", "/") + "/" + part, "type": "TIMING" if part == "duration" else "EASING",
                          "valuesByMode": vals, "scopes": [], "codeSyntax": code_syntax(prefix, p + "." + part),
                          "fallback": {"type": "FLOAT", "unit": "ms"} if part == "duration" else {"type": "STRING"}})
    collections.append({"name": "Motion", "modes": [c.title() for c in mods["motion"]["contexts"]], "variables": mvars})
    # 4. mode-independent semantic tokens (radius roles, sizes, weights, families, opacity, durations, easings)
    sem = []
    for p in sorted(flat0):
        if p in primitive_paths or p in names or re.match(r"(color\.|space\.(inset|stack|inline|section)|size\.control|motion\.transition|text\.|elevation\.)", p):
            continue
        ent = var_entry(p, flat0[p], "Tokens", {"Value": value_for(p, flat0[p], flat0, names)})
        if ent:
            sem.append(ent)
    collections.append({"name": "Tokens", "modes": ["Value"], "variables": sem})
    warnings = []
    final = []
    for col in collections:
        if len(col["modes"]) > limit:
            warnings.append(f"{col['name']}: {len(col['modes'])} modes exceed the {plan} limit of {limit}; split into one collection per mode.")
            for m in col["modes"]:
                final.append({"name": f"{col['name']} ({m})", "modes": ["Value"],
                              "variables": [dict(v, valuesByMode={"Value": v["valuesByMode"][m]}) for v in col["variables"]]})
        else:
            final.append(col)
        if len(col["variables"]) > 5000:
            warnings.append(f"{col['name']}: more than 5,000 variables per collection (Figma limit).")
    # text and effect styles (composites are styles in Figma, not variables)
    light = resolve_all(files, {"theme": "light"} if "theme" in mods else {})
    text_styles, effect_styles = [], []
    for p, t in sorted(light.items()):
        if t["type"] == "typography":
            v = t["resolved"]
            ext = (t.get("$extensions") or {}).get(NS, {})
            raw = t["$value"]
            text_styles.append({"name": p.replace(".", "/"), "fontFamily": figma_font(v["fontFamily"]),
                                "fontStyle": FIGMA_STYLE[min(900, max(100, int(round(v["fontWeight"] / 100) * 100)))],
                                "fontSize": _px(v["fontSize"]), "fontWeight": v["fontWeight"],
                                "lineHeight": {"unit": "PIXELS", "value": ext.get("lineHeightPx")},
                                "letterSpacing": {"unit": "PERCENT", "value": rnd(ext.get("letterSpacingEm", 0) * 100, 2)},
                                "textCase": "UPPER" if ext.get("textTransform") else "ORIGINAL",
                                "boundVariables": {"fontSize": raw["fontSize"][1:-1].replace(".", "/"),
                                                   "fontWeight": raw["fontWeight"][1:-1].replace(".", "/"),
                                                   "fontFamily": raw["fontFamily"][1:-1].replace(".", "/")}})
        if t["type"] == "shadow" and p.startswith("elevation.") and p.count(".") == 1:
            layers = t["resolved"] if isinstance(t["resolved"], list) else [t["resolved"]]
            eff = []
            for lay in layers:
                if isinstance(lay, list):
                    for sub in lay:
                        eff.append(sub)
                else:
                    eff.append(lay)
            effect_styles.append({"name": p.replace(".", "/"), "effects": [
                {"type": "INNER_SHADOW" if l.get("inset") else "DROP_SHADOW", "color": _figma_rgba(l["color"]),
                 "offset": {"x": _px(l["offsetX"]), "y": _px(l["offsetY"])},
                 "radius": _px(l["blur"]), "spread": _px(l["spread"]), "visible": True, "blendMode": "NORMAL"} for l in eff]})
    cs = (meta.get("shape") or {}).get("cornerShape") or "circular"
    corners = {"shape": cs, "cornerSmoothing": 0.6 if cs in ("continuous", "squircle-enhance") else 0,
               "about": "Corner smoothing is a layer property in Figma, not a variable (DC-L04-04, Q-shape-04). Set cornerSmoothing to this "
                        "value on every frame and component that has a radius: 0.6 is Figma's iOS preset for continuous corners, 0 is a "
                        "plain circular arc. Capsules and circles keep 0."}
    return {"$schema": "opendesigner/figma-variables/1", "generatedBy": f"OpenDesigner engine {ENGINE_VERSION}",
            "about": "Payload for the Figma MCP use_figma write flow (or a plugin): create collections in order, primitives first, "
                     "then alias semantic variables by name. Colors are sRGB 0-1. TIMING values are seconds and EASING values are "
                     "cubic-bezier or spring objects (plugin API, 5 Aug 2026, L07); if the file rejects them, use each variable's "
                     "fallback. Composite tokens become text styles and effect styles (light values; bind colors to the Color collection).",
            "plan": plan, "limits": {"modesPerCollection": limit, "variablesPerCollection": 5000, "codeSyntaxPlatforms": 3},
            "warnings": warnings, "collections": final, "textStyles": text_styles, "effectStyles": effect_styles, "corners": corners}


PAPER_TYPES = [("color", None), ("spacing", "space."), ("radius", "radius."), ("fontSize", "font.size."), ("lineHeight", "font.line-height."),
               ("fontWeight", "font.weight."), ("fontFamily", "font.family."), ("opacity", "opacity.")]


def export_paper(files, meta, prefix):
    """Paper has no modes yet: one flat token list per theme, literal values in create_tokens order
    (semantic colors first, neutral before accents; other types smallest first)."""
    res = files["opendesigner.resolver.json"]
    mods = res.get("modifiers", {})
    themes = list(mods["theme"]["contexts"]) if "theme" in mods else meta["modes"]
    out = {}
    css = {}
    for theme in themes:
        flat = resolve_all(files, {"theme": theme} if "theme" in mods else {})
        entries = []
        sem = [p for p in flat if flat[p]["type"] == "color" and re.match(r"color\.(surface|text|bg|border|icon|chart)\.", p)]
        sem.sort(key=lambda p: (0 if ("neutral" in p or p.startswith(("color.surface", "color.text.primary", "color.text.secondary"))) else 1, p))
        prim = [p for p in flat if flat[p]["type"] == "color" and re.match(rf"color\.(neutral|accent|action|accent2|accent3|success|warning|danger|info)\.{theme}\.", p)]
        order = {"neutral": 0, "accent": 1, "action": 2, "accent2": 3, "accent3": 4}
        prim.sort(key=lambda p: (order.get(p.split(".")[1], 5), p.split(".")[1],
                             int(p.split(".")[-1]) if p.split(".")[-1].isdigit() else 99))
        for p in sem + prim:
            t = flat[p]
            entries.append({"type": "color", "name": css_var(prefix, p), "value": css_color(t["resolved"]), "description": (t["$description"] or "")[:200]})
        for ptype, pre in PAPER_TYPES[1:]:
            group = []
            for p, t in flat.items():
                if not p.startswith(pre) or t["type"] not in ("dimension", "fontWeight", "fontFamily", "number"):
                    continue
                v = t["resolved"]
                if t["type"] == "dimension":
                    num, val = _px(v), f"{fmt_num(_px(v))}px"
                elif t["type"] == "fontFamily":
                    num, val = 0, ", ".join(v) if isinstance(v, list) else v
                else:
                    num, val = v, v
                group.append((num, p, val, t["$description"]))
            group.sort(key=lambda x: (x[0], x[1]))
            for num, p, val, desc in group:
                entries.append({"type": ptype, "name": css_var(prefix, p), "value": val, "description": (desc or "")[:200]})
        out[theme] = entries
        css[theme] = ":root {\n" + "\n".join(f"  {e['name']}: {e['value']};" for e in entries) + "\n}\n"
    payload = {"$about": "Tokens for Paper's create_tokens MCP tool (Paper has no modes yet, so each theme is a separate list; "
                         "use one theme per file or page). Values are literal, not var() aliases, so creation order cannot break references.",
               "generatedBy": f"OpenDesigner engine {ENGINE_VERSION}", "themes": out}
    return payload, css


IOS_TEXT_STYLES = {  # our text style -> (SwiftUI text style, its default size in pt) (Apple HIG type sizes, S-L02-001)
    "display": (".largeTitle", 34), "headline.lg": (".title", 28), "headline.md": (".title2", 22), "headline.sm": (".title3", 20),
    "title.lg": (".title3", 20), "title.md": (".headline", 17), "title.sm": (".headline", 17), "body.lg": (".body", 17),
    "body.md": (".body", 17), "body.sm": (".subheadline", 15), "label.lg": (".body", 17), "label.md": (".subheadline", 15),
    "label.sm": (".caption", 12), "code.md": (".body", 17), "code.sm": (".footnote", 13), "numeric.md": (".body", 17),
    "numeric.lg": (".title2", 22)}


def export_swift(files, meta, prefix):
    res = files["opendesigner.resolver.json"]
    mods = res.get("modifiers", {})
    P = prefix.upper()
    light = resolve_all(files, {"theme": "light"} if "theme" in mods else {})
    dark = resolve_all(files, {"theme": "dark"}) if "theme" in mods and "dark" in mods["theme"]["contexts"] else light
    base = resolve_all(files, {})
    L = [f"// {meta.get('name')} design tokens for SwiftUI. Generated by the OpenDesigner engine {ENGINE_VERSION}; do not edit.",
         "// Colors switch with the system appearance. Spacing uses the default density; text uses Dynamic Type text styles.",
         "import SwiftUI", "#if canImport(UIKit)", "import UIKit", "#elseif canImport(AppKit)", "import AppKit", "#endif", "",
         f"public enum {P} {{}}", "",
         "private func dsColor(_ light: UInt32, _ dark: UInt32, _ la: Double = 1, _ da: Double = 1) -> Color {",
         "    func comps(_ v: UInt32) -> (Double, Double, Double) {",
         "        (Double((v >> 16) & 0xFF) / 255, Double((v >> 8) & 0xFF) / 255, Double(v & 0xFF) / 255)",
         "    }",
         "    let (lr, lg, lb) = comps(light), (dr, dg, db) = comps(dark)",
         "    #if canImport(UIKit)",
         "    return Color(UIColor { $0.userInterfaceStyle == .dark",
         "        ? UIColor(red: dr, green: dg, blue: db, alpha: da) : UIColor(red: lr, green: lg, blue: lb, alpha: la) })",
         "    #elseif canImport(AppKit)",
         "    return Color(NSColor(name: nil) { $0.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua",
         "        ? NSColor(red: dr, green: dg, blue: db, alpha: da) : NSColor(red: lr, green: lg, blue: lb, alpha: la) })",
         "    #else",
         "    return Color(red: lr, green: lg, blue: lb, opacity: la)",
         "    #endif",
         "}", "", f"public extension {P} {{", "    enum Colors {"]
    for p in sorted(light):
        if light[p]["type"] == "color" and re.match(r"color\.(surface|text|bg|border|icon|overlay|shadow|chart)\.", p):
            lv, dv = light[p]["resolved"], dark[p]["resolved"]
            la, da = lv.get("alpha", 1), dv.get("alpha", 1)
            L.append(f"        public static let {camel(p.split('.')[1:])} = dsColor(0x{hex_of(lv)[1:].upper()}, 0x{hex_of(dv)[1:].upper()}"
                     + (f", {fmt_num(la)}, {fmt_num(da)})" if (la != 1 or da != 1) else ")"))
    L += ["    }", "", "    enum Space {"]
    for p in sorted(base, key=lambda x: (x.split(".")[:2], _px(base[x]["resolved"]) if base[x]["type"] == "dimension" else 0)):
        t = base[p]
        if t["type"] == "dimension" and re.match(r"(space|size)\.", p):
            L.append(f"        public static let {camel(p.split('.'))}: CGFloat = {fmt_num(_px(t['resolved']))}")
    L += ["    }", "", "    enum Radius {"]
    for p in sorted(base):
        t = base[p]
        if t["type"] == "dimension" and p.startswith(("radius.", "border.width.", "focus.ring.")):
            L.append(f"        public static let {camel(p.split('.'))}: CGFloat = {fmt_num(_px(t['resolved']))}")
    L += ["        /// Continuous corners, as iOS draws its own controls (DC-L04-04, Q-shape-04): the same radii, a smoother curve.",
          f"        /// Use {P}.Radius.shape({P}.Radius.radiusContainer) instead of a plain RoundedRectangle.",
          "        public static let cornerStyle: RoundedCornerStyle = .continuous",
          "        public static func shape(_ radius: CGFloat) -> RoundedRectangle { RoundedRectangle(cornerRadius: radius, style: cornerStyle) }"]
    faces = (meta.get("type") or {}).get("faces") or {}
    scaling = (meta.get("textScaling") or "full")
    notes = []
    for role, f in faces.items():
        if f and not f.get("open") and f.get("face") not in (None, "=textFace") and f.get("app") is not True:
            why = "is not licensed for apps" if f.get("app") is False else "has no recorded app licence (raw.fontLicence.app)"
            notes.append(f"    // {f['face']} {why}, so the {role} styles use the system font (San Francisco) here.")
    L += ["    }", "", "    /// Text styles use Dynamic Type (U5 F22): iOS sizes come from the text style (body 17 pt), not the web scale,",
          "    /// and follow the person's text size setting" + {"full": ".", "capped": "; cap chrome text such as tab labels with "
                                                              ".dynamicTypeSize(...DynamicTypeSize.accessibility2) (Q-type-17).",
                                                              "none": "; Q-type-17 'none' keeps fixed sizes."}.get(scaling, "."),
          *notes, "    enum Typography {"]
    wname_of = {100: "ultraLight", 200: "thin", 300: "light", 400: "regular", 500: "medium", 600: "semibold", 700: "bold", 800: "heavy", 900: "black"}
    for p in sorted(base):
        t = base[p]
        if t["type"] != "typography":
            continue
        v = t["resolved"]
        rawv = t["$value"]
        role_fam = rawv["fontFamily"][1:-1].split(".")[-1] if isinstance(rawv.get("fontFamily"), str) and rawv["fontFamily"].startswith("{") else "text"
        key = ".".join(p.split(".")[1:])
        key = key[len("emphasized."):] if key.startswith("emphasized.") else key
        style, size = IOS_TEXT_STYLES.get(key) or IOS_TEXT_STYLES.get(key.split(".")[0], (".body", 17))
        wt = int(v["fontWeight"])
        wname = wname_of[min(900, max(100, int(round(wt / 100) * 100)))]
        f = faces.get("display" if role_fam == "display" else "text") or {}
        face_name = f.get("face") if isinstance(f.get("face"), str) else "system"
        if role_fam == "display" and face_name == "=textFace":
            f = faces.get("text") or {}
            face_name = f.get("face") if isinstance(f.get("face"), str) else "system"
        mono = key.startswith("code.")
        if mono:
            mf = v["fontFamily"][0] if isinstance(v["fontFamily"], list) else v["fontFamily"]
            custom = None if _generic_face(mf) or mf.lower() not in OPEN_FONTS else mf
            design = ".monospaced"
        else:
            custom = None if (_generic_face(face_name) or (not f.get("open") and f.get("app") is not True)) else face_name
            design = {"=serif": ".serif", "=rounded": ".rounded"}.get(face_name, ".default")
        if custom:
            expr = (f"Font.custom(\"{custom}\", fixedSize: {size}).weight(.{wname})" if scaling == "none"
                    else f"Font.custom(\"{custom}\", size: {size}, relativeTo: {style}).weight(.{wname})")
        else:
            expr = (f"Font.system(size: {size}, weight: .{wname}, design: {design})" if scaling == "none"
                    else f"Font.system({style}, design: {design}, weight: .{wname})")
        L.append(f"        public static let {camel(p.split('.')[1:])} = {expr}")
    L += ["    }", "", "    enum Motion {"]
    for p in sorted(base):
        t = base[p]
        if t["type"] == "duration":
            L.append(f"        public static let {camel(p.split('.')[1:])}: Double = {fmt_num(rnd(t['resolved']['value'] / 1000, 3))}")
        if t["type"] == "number" and p.startswith("motion."):  # scales and gesture constants (motion.scale.press, STD-mobile-touch-05)
            L.append(f"        public static let {camel(p.split('.')[1:])}: Double = {fmt_num(t['resolved'])}")
        sp = (t.get("$extensions") or {}).get(NS, {}).get("apple") if t["type"] == "transition" and p.startswith("motion.spring.") else None
        if sp:
            L.append(f"        public static let {camel(p.split('.')[1:])} = Animation.spring(duration: {fmt_num(sp['duration'])}, bounce: {fmt_num(sp['bounce'])})")
    L += ["    }", "}", ""]
    return "\n".join(L)


def export_compose(files, meta, prefix):
    res = files["opendesigner.resolver.json"]
    mods = res.get("modifiers", {})
    P = prefix.capitalize()
    light = resolve_all(files, {"theme": "light"} if "theme" in mods else {})
    dark = resolve_all(files, {"theme": "dark"}) if "theme" in mods and "dark" in mods["theme"]["contexts"] else light
    base = resolve_all(files, {})
    cols = [p for p in sorted(light) if light[p]["type"] == "color" and re.match(r"color\.(surface|text|bg|border|icon|overlay|shadow|chart)\.", p)]

    def argb(v):
        a = round_half_up((v.get("alpha", 1) if isinstance(v, dict) else 1) * 255)
        return f"Color(0x{a:02X}{hex_of(v)[1:].upper()})"
    K = [f"// {meta.get('name')} design tokens for Jetpack Compose. Generated by the OpenDesigner engine {ENGINE_VERSION}; do not edit.",
         f"package {slug(prefix).replace('-', '')}.tokens", "",
         "import androidx.compose.animation.core.spring", "import androidx.compose.runtime.Immutable",
         "import androidx.compose.runtime.staticCompositionLocalOf", "import androidx.compose.ui.graphics.Color",
         "import androidx.compose.ui.text.TextStyle", "import androidx.compose.ui.text.font.FontFamily",
         "import androidx.compose.ui.text.font.FontWeight",
         "import androidx.compose.ui.unit.dp", "import androidx.compose.ui.unit.em", "import androidx.compose.ui.unit.sp", "",
         "@Immutable", f"data class {P}Colors("]
    K += [f"    val {camel(p.split('.')[1:])}: Color," for p in cols]
    K += [")", ""]
    for name, fl in (("Light", light), ("Dark", dark)):
        K.append(f"val {P}{name}Colors = {P}Colors(")
        K += [f"    {camel(p.split('.')[1:])} = {argb(fl[p]['resolved'])}," for p in cols]
        K += [")", ""]
    K += [f"val Local{P}Colors = staticCompositionLocalOf {{ {P}LightColors }}", "", f"object {P}Space {{"]
    for p in sorted(base):
        t = base[p]
        if t["type"] == "dimension" and re.match(r"(space|size|radius|border|focus)\.", p):
            v = _px(t["resolved"])
            K.append(f"    val {camel(p.split('.'))} = {fmt_num(v if v < FULL else 999)}.dp")
    faces = (meta.get("type") or {}).get("faces") or {}
    fam_lines = []
    for role, f in faces.items():
        if not f or f.get("face") in (None, "=textFace"):
            continue
        nm = f["face"] if isinstance(f["face"], str) else "system"
        if _generic_face(nm):
            fam_lines.append(f"// {role}: the system font (Roboto on most devices).")
        elif not f.get("open") and f.get("app") is not True:
            why = "is not licensed for apps" if f.get("app") is False else "has no recorded app licence (raw.fontLicence.app)"
            fam_lines.append(f"// {role}: {nm} {why}, so this app uses the system font. Do not bundle it.")
        else:
            fam_lines.append(f"// {role}: {nm}. Add its font files to res/font and replace FontFamily.Default with FontFamily(Font(R.font.<file>)).")
    K += ["}", ""] + fam_lines + [f"val {P}TextFamily: FontFamily = FontFamily.Default", "", f"object {P}Type {{"]
    for p in sorted(base):
        t = base[p]
        if t["type"] == "typography":
            v = t["resolved"]
            ext = (t.get("$extensions") or {}).get(NS, {})
            K.append(f"    val {camel(p.split('.')[1:])} = TextStyle(fontFamily = {P}TextFamily, fontSize = {fmt_num(_px(v['fontSize']))}.sp, "
                     f"lineHeight = {fmt_num(ext.get('lineHeightPx'))}.sp, fontWeight = FontWeight({int(v['fontWeight'])}), "
                     f"letterSpacing = {fmt_num(ext.get('letterSpacingEm', 0))}.em)")
    K += ["}", "", f"object {P}Motion {{"]
    for p in sorted(base):
        t = base[p]
        if t["type"] == "duration":
            K.append(f"    const val {camel(p.split('.')[1:])}Ms = {int(t['resolved']['value'])}")
        if t["type"] == "number" and p.startswith("motion."):  # scales and gesture constants (motion.scale.press, STD-mobile-touch-05)
            K.append(f"    const val {camel(p.split('.')[1:])} = {fmt_num(t['resolved'])}f")
        sp = (t.get("$extensions") or {}).get(NS, {}).get("spring") if t["type"] == "transition" and p.startswith("motion.spring.") else None
        if sp:
            K.append(f"    fun <T> {camel(p.split('.')[1:])}() = spring<T>(dampingRatio = {fmt_num(sp['dampingRatio'])}f, stiffness = {fmt_num(sp['stiffness'])}f)")
    K += ["}", ""]
    return "\n".join(K)


def export_dtcg(files, meta):
    """(1) one self-contained resolver with inline sources; (2) flat per-theme files for Figma's native
    DTCG import (one mode per file, sRGB colors, px dimensions, seconds; L07 A7)."""
    res = copy.deepcopy(files["opendesigner.resolver.json"])

    def inline(srcs):
        return [copy.deepcopy(files[s["$ref"]]) for s in srcs]
    for s in res["sets"].values():
        s["sources"] = inline(s["sources"])
    for m in res.get("modifiers", {}).values():
        for c in m["contexts"]:
            m["contexts"][c] = inline(m["contexts"][c])
    flats = {}
    mods = files["opendesigner.resolver.json"].get("modifiers", {})

    def import_tree(flat, paths):
        tree = {}
        for p in paths:
            t = flat[p]
            typ, v = t["type"], t["resolved"]
            if typ == "color":
                hx = hex_of(v)
                val = {"colorSpace": "srgb", "components": [rnd(c / 255, 4) for c in hex_to_rgb8(hx)], "hex": hx}
                if v.get("alpha") is not None:
                    val["alpha"] = v["alpha"]
            elif typ == "dimension":
                val = {"value": _px(v), "unit": "px"}
            elif typ == "duration":
                val = {"value": rnd(v["value"] / 1000 if v["unit"] == "ms" else v["value"], 4), "unit": "s"}
            elif typ == "fontFamily":
                val = v[0] if isinstance(v, list) else v
            elif typ in ("number", "fontWeight"):
                val, typ = v, "number"
            elif typ == "transition" and p.startswith("motion.transition."):
                sp = spring_ext(t, flat)
                ms_ = sp["css"]["durationMs"] if sp else (v["duration"]["value"] if v["duration"]["unit"] == "ms" else v["duration"]["value"] * 1000)
                p, typ, val = p + ".duration", "duration", {"value": rnd(ms_ / 1000, 4), "unit": "s"}
            else:
                continue  # composites (typography, shadow) become Figma styles, listed in variables.json
            node = tree
            parts = p.split(".")
            for q in parts[:-1]:
                node = node.setdefault(q, {})
            node[parts[-1]] = {"$type": typ, "$value": val}
        return tree
    flat0 = resolve_all(files, {})
    flats["Primitives.Value"] = import_tree(flat0, token_paths_in(files, ["primitives.tokens.json"]))
    flats["Tokens.Value"] = import_tree(flat0, token_paths_in(files, ["semantic.tokens.json"]))
    groups = [("Color", "theme"), ("Density", "density"), ("Motion", "motion")]
    for coll, mod in groups:
        if mod in mods:
            for c, srcs in mods[mod]["contexts"].items():
                fl = resolve_all(files, {mod: c})
                flats[f"{coll}.{c.title()}"] = import_tree(fl, token_paths_in(files, [x["$ref"] for x in srcs]))
        elif coll == "Color":
            srcs = files["opendesigner.resolver.json"]["sets"]["theme"]["sources"]
            flats[f"Color.{meta['modes'][0].title()}"] = import_tree(flat0, token_paths_in(files, [x["$ref"] for x in srcs]))
    return res, flats


ARTIFACT_COLORS = [  # Design System artifact token name -> semantic path (the roles a reader needs, not every token)
    ("surface", "color.surface.base"), ("surface-raised", "color.surface.raised"), ("surface-sunken", "color.surface.sunken"),
    ("ink", "color.text.primary"), ("ink-muted", "color.text.secondary"), ("ink-subtle", "color.text.tertiary"),
    ("line", "color.border.subtle"), ("line-strong", "color.border.default"), ("accent", "color.bg.action.primary"),
    ("accent-hover", "color.bg.action.primary-hover"), ("on-accent", "color.text.on-action"), ("accent-text", "color.text.accent"),
    ("accent-soft", "color.bg.accent.subtle"), ("link", "color.text.link"), ("focus-ring", "color.border.focus"),
    ("danger", "color.text.danger"), ("danger-soft", "color.bg.danger.subtle"), ("success", "color.text.success"),
    ("success-soft", "color.bg.success.subtle"), ("warning", "color.text.warning"), ("warning-soft", "color.bg.warning.subtle"),
    ("info", "color.text.info"), ("info-soft", "color.bg.info.subtle"), ("row-alternate", "color.surface.row-alternate"),
    ("chart-brand", "color.chart.brand"), ("chart-neutral", "color.chart.neutral"), ("chart-axis", "color.chart.axis"),
    ("chart-gridline", "color.chart.gridline"), ("chart-label", "color.chart.label"),
] + [(f"chart-{i}", f"color.chart.categorical.{i}") for i in range(1, 15)] + \
    [(f"chart-diverging-{i}", f"color.chart.diverging.{i}") for i in range(1, 8)] + \
    [(f"chart-{x}", f"color.chart.status.{x}") for x in ("success", "warning", "danger", "info", "discovery")]
# rows whose token does not exist in a system are left out (export_artifact keeps only paths with a value)


def _css_theme_vars(css):
    """{theme: {--var: value}} from export_css text, with var() references resolved, for values an artifact needs plain."""
    light, dark = {}, {}
    for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
        decl = dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", body))
        (dark if ("dark" in sel or "not(" in sel) else light).update(decl)
    dark = {**light, **dark}

    def res(v, env, depth=0):
        return v if depth > 12 else re.sub(r"var\((--[\w-]+)\)", lambda m: res(env.get(m.group(1), m.group(0)), env, depth + 1), v)
    return {"light": {k: res(v, light) for k, v in light.items()}, "dark": {k: res(v, dark) for k, v in dark.items()}}


def export_artifact(d, files, meta, state, prefix):
    """The system as a Claude Design System artifact's files (project/...): tokens.json in its list grammar, a README.md
    made of DESIGN.md, a cover and a button preview. Publish the folder with the Artifact tool (SKILL.md: Design System
    artifact). Logos and other images are uploads there, so they are listed in the README instead of copied."""
    name = state.get("name") or "Design system"
    base = resolve_all(files, {})
    res = files["opendesigner.resolver.json"]
    themes = list((res.get("modifiers", {}).get("theme") or {}).get("contexts") or meta["modes"])
    trees = {th: resolve_all(files, {"theme": th}) for th in themes}
    hexv = lambda tree, p: (((tree.get(p) or {}).get("resolved") or {}).get("hex"))
    colors = []
    for tname, path in ARTIFACT_COLORS:
        vals = {th: hexv(trees[th], path) for th in themes if hexv(trees[th], path)}
        if vals:
            colors.append({"name": tname, "value": vals if len(themes) > 1 else next(iter(vals.values())),
                           "usage": ((base.get(path) or {}).get("$description") or path)[:1000]})
    stack = lambda v: ", ".join(f'"{x}"' if " " in x else x for x in (v if isinstance(v, list) else [v]))[:200]
    fam = {}
    for key in ("text", "display", "mono"):
        r = ((base.get(f"font.family.{key}") or {}).get("resolved"))
        if r:
            fam[key] = re.sub(r"[;{}<>\\()]", "", stack(r))
    styles = []
    for p in sorted((k for k in base if k.startswith("text.")), key=lambda k: -(((base[k].get("resolved") or {}).get("fontSize") or {}).get("value") or 0)):
        r = base[p].get("resolved") or {}
        ext = (base[p].get("$extensions") or {}).get("opendesigner") or {}
        size = (r.get("fontSize") or {}).get("value")
        if not size:
            continue
        fam_key = "mono" if p.startswith("text.code") else ("display" if p.startswith(("text.display", "text.headline")) and "display" in fam else "text")
        styles.append({"name": p[5:].replace(".", "-"), "family": fam_key, "fontSize": f"{size}px",
                       "lineHeight": f"{ext.get('lineHeightPx') or round(size * (r.get('lineHeight') or 1.4))}px",
                       "fontWeight": r.get("fontWeight") or 400, "letterSpacing": f"{ext.get('letterSpacingEm', 0)}em",
                       "usage": (ext.get("use") or "")[:1000]})
    space = [{"name": k.replace(".", "-"), "value": f"{(base[k].get('resolved') or {}).get('value')}px", "usage": "Spacing step."}
             for k in sorted((k for k in base if re.match(r"^space\.\d+$", k)), key=lambda k: int(k.split(".")[1]))
             if (base[k].get("resolved") or {}).get("value")]
    radius = []
    for k in ("radius.detail", "radius.control-sm", "radius.control", "radius.container", "radius.overlay", "radius.person"):
        r = (base.get(k) or {}).get("resolved") or {}
        if r.get("value") is not None:
            v = r["value"]
            radius.append({"name": k.replace(".", "-"), "value": "9999px" if v >= 999 else f"{v}px", "usage": (base[k].get("$description") or k)[:1000]})
    cv = _css_theme_vars(export_css(files, meta, prefix))
    shadows = []
    for k in ("elevation.raised", "elevation.floating", "elevation.overlay"):
        var = css_var(prefix, k)
        vals = {th: cv.get(th if th in cv else "light", {}).get(var) for th in themes}
        if all(v and "var(" not in v for v in vals.values()):
            shadows.append({"name": k.replace(".", "-"), "value": vals if len(themes) > 1 else next(iter(vals.values())),
                            "usage": ((base.get(k) or {}).get("$description") or k)[:1000]})
    tokens = {"name": name, "version": 1, "meta": {"source": "OpenDesigner engine.py export --format artifact"},
              "color": {"themes": [{"id": th, "name": th.title()} for th in themes], "tokens": colors},
              "type": {"fonts": [], "families": fam, "groups": [{"name": "Text", "family": "text", "styles": styles}]},
              "spacing": {"tokens": space}, "radius": {"tokens": radius}}
    if shadows:
        tokens["shadow"] = {"tokens": shadows}
    # README: DESIGN.md without its front matter and title (the artifact page shows the name), plus the assets to upload
    md_path = os.path.join(os.path.dirname(os.path.abspath(d)), "DESIGN.md")
    md = ""
    if os.path.exists(md_path):
        with open(md_path, encoding="utf-8") as f:
            md = f.read()
    md = re.sub(r"\A---\n.*?\n---\n", "", md, flags=re.S).lstrip()
    md = re.sub(r"\A# [^\n]*\n+", "", md)
    # relative links point into the person's repo, which the artifact does not hold: keep each path as inline code
    md = re.sub(r"!?\[([^\]\n]*)\]\((?![a-z][a-z0-9+.-]*:|#)([^)\s]+)\)",
                lambda m: f"`{m.group(2)}`" if m.group(1).strip("`") in ("", m.group(2)) else f"{m.group(1)} (`{m.group(2)}`)", md, flags=re.I)
    logos = [f for f in ((state.get("hooks") or {}).get("H-logo") or {}).get("files") or []]
    if logos:
        md += "\n\n## Logo files\n\nUpload these as assets in the Logos group when you publish: " + ", ".join(f"`{f}`" for f in logos) + ".\n"
    files_out = {"project/tokens.json": json.dumps(tokens, indent=1, ensure_ascii=False) + "\n", "project/README.md": md[:190000]}
    # cover (the type's brief: colour blocks, one pattern from the radius tokens, the name; top-band skeleton fits any name)
    rad = [r["value"] for r in radius][:5] or ["0px", "4px", "8px", "16px", "9999px"]
    tiles = "".join(f'<rect class="b-on" x="{24 + i * 72}" y="36" width="48" height="48" rx="{min(24, int(float(re.sub("[^0-9.]", "", v) or 0)))}"/>'
                    for i, v in enumerate(rad))
    files_out["project/components/Cover/preview.html"] = (
        '<!-- @dsCard height=300 -->\n<!doctype html>\n<html>\n<head><meta charset="utf-8"><title>Cover</title>\n<style>\n'
        'html,body{margin:0;background:var(--surface)}\n.cv{position:relative;width:960px;height:300px;background:var(--surface);font-family:var(--font-text)}\n'
        '.cv svg{position:absolute;left:0;top:0} .b-accent{fill:var(--accent)} .b-ink{fill:var(--ink)} .b-soft{fill:var(--accent-soft)} '
        '.b-sunk{fill:var(--surface-sunken)} .b-on{fill:var(--on-accent)}\n'
        '.name{position:absolute;left:48px;top:168px;margin:0;font-size:64px;line-height:60px;font-weight:400;letter-spacing:-0.025em;color:var(--ink)}\n'
        '.tag{position:absolute;left:50px;top:244px;margin:0;font-size:14px;line-height:20px;color:var(--ink-muted);max-width:440px}\n</style></head>\n<body>\n<div class="cv">\n'
        '<!--\nblocks: accent, ink, accent-soft, surface-sunken as one strip of unequal bands, 120px tall\narrangement: top band, flush, bleeding off the right edge\n'
        'pattern: the radius tokens as tiles, square to round, on the accent block\nsteps and radii: the radius tokens in order\n-->\n'
        '<svg width="960" height="128" viewBox="0 0 960 128" aria-hidden="true"><rect class="b-accent" x="0" y="0" width="384" height="120"/>'
        '<rect class="b-ink" x="384" y="0" width="96" height="120"/><rect class="b-soft" x="480" y="0" width="192" height="120"/>'
        f'<rect class="b-sunk" x="672" y="0" width="288" height="120"/>{tiles}</svg>\n'
        f'<p class="name">{_esc(name)}</p>\n<p class="tag">{_esc(product_words(state) or "A design system made with OpenDesigner.")}</p>\n</div>\n</body>\n</html>\n')
    files_out["project/components/Button/preview.html"] = (
        '<!-- @dsCard group="Actions" height=96 subtitle="Primary and secondary, with focus and disabled" -->\n<!doctype html>\n<html>\n<head><meta charset="utf-8"><title>Button</title>\n<style>\n'
        'html,body{margin:0;background:var(--surface)} .row{display:flex;gap:12px;align-items:center;padding:24px;font-family:var(--font-text)}\n'
        f'.b{{font:inherit;font-size:16px;font-weight:500;min-height:44px;padding:0 16px;border-radius:var(--radius-control, 6px);border:1px solid transparent;cursor:pointer}}\n'
        '.p{background:var(--accent);color:var(--on-accent)} .p:hover{background:var(--accent-hover)} .s{background:transparent;color:var(--ink);border-color:var(--line-strong)}\n'
        '.b:focus-visible,.f{outline:2px solid var(--focus-ring);outline-offset:2px} .b[disabled]{opacity:.45;cursor:not-allowed}\n</style></head>\n<body>\n'
        '<div class="row"><button class="b p">Save changes</button><button class="b s">Cancel</button><button class="b p f">Focused</button>'
        '<button class="b p" disabled>Disabled</button></div>\n</body>\n</html>\n')
    files_out["project/components/Button/README.md"] = ("# Button\n\nThe primary action uses `accent` with `on-accent`; the secondary is outlined in `line-strong`. "
                                                       "At least 44 px tall. Focus is a 2 px `focus-ring` with a 2 px gap. One primary per screen.\n")
    # the index: keep the first creation time so repeated builds do not churn it
    idx_path = os.path.join(d, "build", "artifact", "project", "design-system.json")
    created = None
    if os.path.exists(idx_path):
        try:
            created = (read_json(idx_path) or {}).get("createdOnFiles")
        except ValueError:
            created = None
    now = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    index = {"v": 3, "layout": "files", "createdOnFiles": created or {"v": 1, "at": now}, "title": name,
             "namespace": re.sub(r"[^A-Za-z0-9]", "", name.title()) or "DesignSystem", "libraries": [], "sections": {}, "groups": [],
             "assetGroups": {}, "blobs": {}, "docs": {"readme": "project/README.md", "sections": []},
             "lastChange": {"by": "OpenDesigner", "at": now, "via": "engine.py export --format artifact", "note": "Rebuilt from the system's tokens"}}
    files_out["project/design-system.json"] = json.dumps(index, indent=1, ensure_ascii=False) + "\n"
    return files_out


# =============================================================================================
# Brand and press page (issue 49): what a finished system already holds, on one static page in build/brand/, built with
# the system's own tokens. Logo, colour, type, icons and voice come from the system and the person's own files (copied
# to build/brand/assets/ with download links). Facts, boilerplate, leadership, figures and the press contact are owner
# input: they read "Not enough information" with what fills them until the person gives them. Nothing is invented: no
# logo, icon, fact or figure that the person did not supply, and font files are never shipped.
# =============================================================================================

# Logo rules live on the H-logo hook. Each shows "Default" until the person sets it (engine.py set hooks.H-logo.clearSpace ...).
LOGO_CLEAR_DEFAULT = 0.5  # clear space on every side, as a share of the logo's height [inferred: the research has no number]
LOGO_MIN_DEFAULT = {"symbol": 16, "lockup": 24}  # px tall: the smallest logo size Atlassian ships is 16 px (DC-L05-13; S-L05-044),
# and the H-logo check reads legibility at 16 px; a lockup carries a wordmark, so it gets more room [inferred]
BRAND_IMG = (".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif")
BRAND_FILES = BRAND_IMG + (".pdf", ".eps", ".ai")
PRESS_FIELDS = [("boilerplate", "Short description", "a paragraph on what the company does, in the owner's words, for a journalist"),
                ("facts", "Facts", "founded, where, how many people: each one true today"),
                ("leadership", "Leadership", "names and roles, shown only with each person's permission"),
                ("figures", "Figures", "numbers, each with its qualifier: for whom, over what time, compared with what"),
                ("contact", "Press contact", "a name and an address that answers")]
PERSON_GAVE = ("chosen", "confirmed_default", "asset", "reference", "research")  # set by the person, not assumed or delegated


def logo_rules(state, decs):
    """{clear: (share of height, 'chosen'|'default'), minSize: ({symbol, lockup} px, status)} from the H-logo hook."""
    hk = (state.get("hooks") or {}).get("H-logo") or {}
    out = {}
    for key, default in (("clearSpace", LOGO_CLEAR_DEFAULT), ("minSize", LOGO_MIN_DEFAULT)):
        v = hk.get(key)
        given = v is not None and (decs.get(f"hooks.H-logo.{key}") or {}).get("set_by") in PERSON_GAVE
        if key == "minSize" and isinstance(v, (int, float)):
            v = {"symbol": v, "lockup": max(v, LOGO_MIN_DEFAULT["lockup"])}
        out[key] = (v if v is not None else default, "chosen" if given else "default")
    return out


def logo_rule_problem(key, v):
    if key == "clearSpace":
        ok = isinstance(v, (int, float)) and not isinstance(v, bool) and 0.1 <= v <= 2
        return None if ok else "hooks.H-logo.clearSpace takes the clear space as a share of the logo's height, from 0.1 to 2 (for example 0.5)."
    if key == "minSize":
        num = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool) and 8 <= x <= 400
        ok = num(v) or (isinstance(v, dict) and v and set(v) <= {"symbol", "lockup"} and all(num(x) for x in v.values()))
        return None if ok else 'hooks.H-logo.minSize takes px from 8 to 400: 16, or {"symbol": 16, "lockup": 24}.'
    return None


def _brand_file(root, rel):
    p = rel if os.path.isabs(rel) else os.path.join(root, rel)
    return p if os.path.isfile(p) else None


def _icon_files(d, state):
    """[(source path, licence note or '')]: the H-icons files, then icons kept in opendesigner/icons (illustrate.py icons keep)."""
    root = doc_dir(d)
    out = [(p, "") for p in (_brand_file(root, f) for f in ((state.get("hooks") or {}).get("H-icons") or {}).get("files") or []) if p]
    led = os.path.join(d, "icons", "ledger.json")
    if os.path.exists(led):
        try:
            items = read_json(led).get("items") or []
        except ValueError:
            items = []
        for e in items:
            p = _brand_file(os.path.join(d, "icons"), str(e.get("file") or ""))
            if e.get("status") == "chosen" and p and p not in [x for x, _ in out]:
                lic = " · ".join(x for x in (e.get("set"), e.get("licence_spdx") or e.get("licence")) if x)
                out.append((p, lic))
    return out


def _icon_library(state):
    """(name, licence, licence url) of the open icon set the person chose (hooks.H-icons.library, an Iconify prefix), else None.
    The licence comes from the illustrate skill's icon_sets list when it sits beside this skill; it is never guessed."""
    lib = ((state.get("hooks") or {}).get("H-icons") or {}).get("library")
    if not lib:
        return None
    sets = {}
    src = os.path.join(SKILL_ROOT, "..", "opendesigner-illustrate", "references", "sources.json")
    if os.path.exists(src):
        try:
            sets = {s.get("prefix"): s for s in read_json(src).get("icon_sets") or []}
        except ValueError:
            pass
    s = sets.get(str(lib)) or {}
    return (s.get("name") or str(lib), s.get("licence"), s.get("licence_url"))


def _ext_fill(n, what):
    return f'engine.py set {n} \'"..."\' --why "their words"' if what == "text" else f"engine.py set {n} '[\"...\"]' --why \"their words\""


def export_brand(d, files, meta, state, prefix):
    """{relative path: text or bytes} for build/brand/: index.html and assets/ (the person's logo and icon files)."""
    css = export_css(files, meta, prefix)
    V = lambda p: f"var({css_var(prefix, p)})"
    base = resolve_all(files, {})
    res = files["opendesigner.resolver.json"]
    themes = list((res.get("modifiers", {}).get("theme") or {}).get("contexts") or meta["modes"])
    by_theme = {th: resolve_all(files, {"theme": th}) for th in themes}
    hexv = lambda tree, p: (((tree.get(p) or {}).get("resolved") or {}).get("hex"))
    has = lambda p: p in base
    t = lambda p: (f"font: var({css_var(prefix, p)}); letter-spacing: var({css_var(prefix, p)}-tracking);" if has(p) else "")
    decs = _decisions(d)
    root = doc_dir(d)
    name = state.get("name") or "Your product"
    ctx = state.get("context") or {}
    hooks = state.get("hooks") or {}
    out, missing_n = {}, [0]

    def gave(path):
        return (decs.get(path) or {}).get("set_by") in PERSON_GAVE

    def tag(status):
        label = {"chosen": "Chosen", "default": "Default", "missing": NOT_ENOUGH}[status]
        return f'<span class="bp-tag bp-{status}">{label}</span>'

    def missing(what, fills):
        missing_n[0] += 1
        return f'<div class="bp-missing">{tag("missing")}<p>{_esc(what)}</p><p class="bp-how">{_esc(fills)}</p></div>'

    def copy(src, sub):
        rel, n = f"assets/{sub}/{os.path.basename(src)}", 1
        while rel in out:  # two files with one name in different folders
            n += 1
            stem, ext = os.path.splitext(os.path.basename(src))
            rel = f"assets/{sub}/{stem}-{n}{ext}"
        with open(src, "rb") as fh:
            out[rel] = fh.read()
        return rel

    # ---- about and facts: only what the person gave
    press = ctx.get("press") or {}
    about = []
    product = product_words(state) if gave("context.product") else ""
    if product:
        about.append(f'<p class="bp-lede">{_esc(product)}</p>')
    r = research_py.summary(state) if research_py else {}
    pos = r.get("positioning") or {}
    if pos.get("confirmed"):
        about.append('<dl class="bp-dl">' + "".join(f"<dt>{_esc(k)}</dt><dd>{_esc(v)}</dd>" for k, v in (
            ("Who it is for", pos.get("for")), ("The one claim", pos.get("claim"))) if str(v or "").strip())
            + f'</dl><p class="bp-dim">From the positioning the owner confirmed on {_esc(pos["confirmed"])}.</p>')
    site_figures = []
    sa = answer_value(((state.get("answers") or {}).get("Q-site-03")))
    if sa and gave("answers.Q-site-03"):
        site_figures = [x for x in (sa if isinstance(sa, list) else [sa]) if isinstance(x, dict) and x.get("kind") == "figures"]
    for key, label, hint in PRESS_FIELDS:
        v = press.get(key) if gave(f"context.press.{key}") else None
        if key == "figures" and not v and site_figures:
            v = [f"{x['what']} ({x['qualifier']})" if x.get("qualifier") else x["what"] for x in site_figures]
        if key == "leadership" and isinstance(v, list):
            v = [f"{x.get('name')}, {x.get('role')}" if isinstance(x, dict) else x for x in v]
        items = [str(x).strip() for x in (v if isinstance(v, list) else [v]) if str(x or "").strip()]
        if not items:
            about.append(f"<h3>{label}</h3>" + missing(f"{label}: {hint}.", _ext_fill(f"context.press.{key}",
                                                                                    "text" if key in ("boilerplate", "contact") else "list")))
        elif key == "figures":
            about.append(f"<h3>{label}</h3><ul>" + "".join(
                f"<li>{_esc(x)}" + ("" if "(" in x else ' <span class="bp-dim">(no qualifier yet: for whom, over what time, '
                                     'compared with what)</span>') + "</li>" for x in items) + "</ul>")
        elif len(items) == 1:
            about.append(f"<h3>{label}</h3><p>{_esc(items[0])}</p>")
        else:
            about.append(f"<h3>{label}</h3><ul>" + "".join(f"<li>{_esc(x)}</li>" for x in items) + "</ul>")

    # ---- logo: the person's files, the rules, and do and don't drawn from those rules
    rules = logo_rules(state, decs)
    clear, clear_st = rules["clearSpace"]
    mins, mins_st = rules["minSize"]
    logo_srcs = [p for p in (_brand_file(root, f) for f in (hooks.get("H-logo") or {}).get("files") or []) if p
                 and os.path.splitext(p)[1].lower() in BRAND_FILES]
    logos = [(copy(p, "logo"), os.path.splitext(p)[1].lower() in BRAND_IMG) for p in logo_srcs]
    rule_rows = (f'<tr><th scope="row">Clear space</th><td>{fmt_num(clear)} × the logo\'s height on every side. Nothing else enters it.</td>'
                 f'<td>{tag(clear_st)}</td></tr>'
                 f'<tr><th scope="row">Smallest size</th><td>Symbol {fmt_num(mins.get("symbol", 16))} px tall; with the wordmark '
                 f'{fmt_num(mins.get("lockup", 24))} px tall, on screen.</td><td>{tag(mins_st)}</td></tr>')
    logo = (f'<table class="bp-table"><tbody>{rule_rows}</tbody></table><p class="bp-dim">Change a rule: '
            f'<code>engine.py set hooks.H-logo.clearSpace 0.5</code> or <code>engine.py set hooks.H-logo.minSize 20</code>. '
            '"Default" means nobody has confirmed it yet.</p>')
    shown = [rel for rel, img in logos if img]
    if not logos:
        logo += missing("Your logo files: the symbol, the wordmark and each lockup, in colour, black and white.",
                        "Q-brand-03 and the H-logo asset: engine.py sketch --logo <file>, or engine.py set hooks.H-logo.files '[\"brand/logo.svg\"]'")
    else:
        cards = "".join(
            f'<figure class="bp-logo">' + (f'<div class="bp-grounds"><div class="bp-light"><img src="{_esc(rel)}" alt="{_esc(name)} logo, '
                                            f'{_esc(os.path.basename(rel))}, on a light ground"></div><div class="bp-dark"><img src="{_esc(rel)}" '
                                            f'alt="{_esc(name)} logo, {_esc(os.path.basename(rel))}, on a dark ground"></div></div>' if img else "")
            + f'<figcaption><a href="{_esc(rel)}" download>Download {_esc(os.path.basename(rel))}</a></figcaption></figure>'
            for rel, img in logos)
        logo += f'<h3>Logo files</h3><div class="bp-logos">{cards}</div>'
        if shown:
            first, h = shown[0], 64
            pad = round(clear * h)
            logo += (f'<h3>Clear space</h3><div class="bp-clear"><div class="bp-zone" style="padding:{pad}px">'
                     f'<img src="{_esc(first)}" alt="{_esc(name)} logo inside its clear space" style="height:{h}px"></div></div>'
                     f'<p class="bp-dim">The dashed line is the clear space: {fmt_num(clear)} × the logo\'s height ({pad} px at {h} px tall).</p>')
            small = mins.get("symbol", 16)
            dos = [("Do", "On a plain ground, with its clear space.", f'<img src="{_esc(first)}" alt="" style="height:40px">', "bp-light"),
                   ("Do", f"At {fmt_num(small)} px or larger.", f'<img src="{_esc(first)}" alt="" style="height:{fmt_num(small)}px">', "bp-light"),
                   ("Don't", "Crowd it: text inside the clear space.", f'<span class="bp-crowd"><img src="{_esc(first)}" alt="" '
                                                                         f'style="height:40px"><b>Text too close</b></span>', "bp-light"),
                   ("Don't", "Stretch or squash it.", f'<img src="{_esc(first)}" alt="" style="height:40px;transform:scaleX(1.5)">', "bp-light"),
                   ("Don't", "Recolour it.", f'<img src="{_esc(first)}" alt="" style="height:40px;filter:hue-rotate(140deg) saturate(1.6)">', "bp-light"),
                   ("Don't", f"Use it smaller than {fmt_num(small)} px.", f'<img src="{_esc(first)}" alt="" style="height:{max(6, round(small / 2))}px">',
                    "bp-light")]
            logo += ('<h3>Do and don\'t</h3><p class="bp-dim">Each example is your own logo file, drawn from the rules above.</p>'
                     '<div class="bp-dos">' + "".join(
                         f'<figure class="bp-do bp-{"yes" if k == "Do" else "no"}"><div class="{g}">{img}</div>'
                         f'<figcaption><b>{k}.</b> {_esc(txt)}</figcaption></figure>' for k, txt, img, g in dos) + "</div>")

    # ---- colour: each role with hex, RGB and OKLCH, its job, in every theme
    roles = [("color.bg.action.primary", "Primary action"), ("color.text.primary", "Text"), ("color.surface.base", "Page"),
             ("color.text.accent", "Accent text"), ("color.bg.accent.subtle", "Accent fill"), ("color.border.default", "Lines"),
             ("color.text.danger", "Danger"), ("color.text.success", "Success"), ("color.text.warning", "Warning"), ("color.text.info", "Information")]
    sw = []
    brand_hex = normalize_hex((state.get("raw") or {}).get("brandColor") or "") if (state.get("raw") or {}).get("brandColor") else None
    if brand_hex:
        sw.append(("Brand colour", "The exact colour the brand gave. Logos and large brand areas keep it exactly.", {th: brand_hex for th in themes}))
    for p, label in roles:
        if not has(p):
            continue
        desc = re.sub(r"\s*\([^)]*\)", "", base[p].get("$description") or "").strip()
        sw.append((label, desc, {th: hexv(by_theme[th], p) for th in themes}))

    def values(hx):
        rr, gg, bb = hex_to_rgb8(hx)
        L, C, H = hex_to_oklch(hx)
        return f"{hx.upper()}<br>RGB {rr} {gg} {bb}<br>OKLCH {L * 100:.1f}% {C:.3f} {f'{H:.0f}' if C >= 0.002 else 'none'}"  # a grey has no hue
    color = '<div class="bp-swatches">' + "".join(
        f'<div class="bp-sw"><div class="bp-chips">' + "".join(f'<i style="background:{hx}" title="{_esc(th)}"></i>' for th, hx in vals.items() if hx)
        + f'</div><b>{_esc(label)}</b><p class="bp-dim">{_esc(desc)}</p>'
        + "".join(f'<p class="bp-val"><span>{_esc(th.title())}</span>{values(hx)}</p>' for th, hx in vals.items() if hx) + "</div>"
        for label, desc, vals in sw) + "</div>"

    # ---- type: each family, its weights and jobs, a specimen; files are never shipped
    faces = font_faces(state.get("raw") or {})
    fam_of = lambda p: (((base.get(p) or {}).get("resolved") or {}).get("fontFamily") or [None])
    styles = [k for k in base if k.startswith("text.")]
    typ = []
    seen = set()
    loaded = []  # (family, weights): open faces the page links from Google Fonts, so the specimens show the real face
    for role in ("display", "text", "mono"):
        fp = f"font.family.{role}"
        if not has(fp):
            continue
        fam = (base[fp].get("resolved") or {}).get("value") if isinstance(base[fp].get("resolved"), dict) else base[fp].get("resolved")
        fam = fam if isinstance(fam, list) else [fam]
        if not fam or fam[0] in seen:
            continue
        seen.add(fam[0])
        uses = [k for k in styles if fam_of(k)[:1] == fam[:1]]
        weights = sorted({int((base[k].get("resolved") or {}).get("fontWeight") or 400) for k in uses})
        jobs = sorted({k.split(".")[1] for k in uses})
        first = str(fam[0])
        generic = _generic_face(first) or first.lower() in GENERIC_FONTS
        shown_name = "The system font" if generic else first  # each family's own token, never another role's record
        f = faces.get(role) or {}
        if generic:
            lic = "It comes with each device, so there is nothing to license or ship."
        else:
            lic = ("An open licence. " if first.lower() in OPEN_FONTS or f.get("open") else (f.get("note") or "Licence not recorded.") + " ") \
                + "Font files are not included here: get them from the foundry or the source, under its licence."
        if first.lower() in OPEN_FONTS:
            loaded.append((first, weights or [400]))
        sample = next((k for k in ("text.display.md", "text.display.sm", "text.headline.lg", "text.title.lg", "text.body.md") if k in uses), None)
        famtok = lambda r_: ((base.get(f"font.family.{r_}") or {}).get("resolved") or [None])
        same = [r_ for r_ in ("display", "text", "mono") if has(f"font.family.{r_}") and isinstance(famtok(r_), list) and str(famtok(r_)[0]) == first]
        typ.append(f'<div class="bp-face"><h3>{_esc(" and ".join(same).capitalize() or role.title())}: {_esc(shown_name)}</h3>'
                   + (f'<p class="bp-spec" style="{t(sample)}">{_esc(name)}</p>' if sample else "")
                   + f'<p style="font-family:var({css_var(prefix, fp)})" class="bp-glyphs">Aa Bb Cc 0123456789 &amp; ? !</p>'
                   + f'<table class="bp-table"><tbody><tr><th scope="row">Weights</th><td>{", ".join(str(w) for w in weights) or "400"}</td></tr>'
                   + f'<tr><th scope="row">Jobs</th><td>{_esc(", ".join(jobs) or "none yet")}</td></tr>'
                   + f'<tr><th scope="row">Licence</th><td>{_esc(lic)}</td></tr></tbody></table></div>')
    typ_html = "".join(typ)

    # ---- icons: the construction grid and its rules from the tokens, the person's icons, the library they chose
    sizes = [(k.split(".")[-1], (base[k].get("resolved") or {}).get("value")) for k in ("size.icon.sm", "size.icon.md", "size.icon.lg") if has(k)]
    strokes = {k.split(".")[-1]: (base[k].get("resolved") or {}).get("value") for k in ("icon.stroke.sm", "icon.stroke.md", "icon.stroke.lg") if has(k)}
    style_ans = answer_value((state.get("answers") or {}).get("Q-icon-02"))
    style_ans = style_ans if isinstance(style_ans, list) else [style_ans] if style_ans else []
    corners = "sharp" if "sharp" in style_ans else "rounded"
    ends = "square caps, mitred joins" if corners == "sharp" else "round caps, round joins"
    grid_lines = "".join(f'<line x1="{i}" y1="0" x2="{i}" y2="24"/><line x1="0" y1="{i}" x2="24" y2="{i}"/>' for i in range(1, 24))
    sw_md = strokes.get("lg") or 2
    grid = (f'<svg class="bp-grid" viewBox="0 0 24 24" role="img" aria-label="Icon construction grid: 24 by 24, a 20 by 20 live area, '
            f'and the circle and square keylines"><rect x="0" y="0" width="24" height="24" class="g-pad"/><rect x="2" y="2" width="20" height="20" '
            f'class="g-live"/><g class="g-lines">{grid_lines}</g><circle cx="12" cy="12" r="10" class="g-key"/>'
            f'<rect x="3" y="3" width="18" height="18" rx="{2 if corners == "rounded" else 0}" class="g-key"/>'
            f'<path d="M7 12.5l3.2 3.2L17 9" class="g-glyph" stroke-width="{sw_md}" stroke-linecap="{"round" if corners == "rounded" else "square"}" '
            f'stroke-linejoin="{"round" if corners == "rounded" else "miter"}"/></svg>')
    plain = {"sm": "Small", "md": "Medium", "lg": "Large"}
    icon_rules = ("".join(f'<tr><th scope="row">{plain.get(n, n)}</th><td>{fmt_num(v)} px icon, {fmt_num(strokes.get(n, 0))} px line</td></tr>'
                          for n, v in sizes)
                  + '<tr><th scope="row">Live area</th><td>The drawing stays in the middle 20 of 24 units, so icons look the same size '
                    '(Material\'s 24 dp grid).</td></tr>'
                  + f'<tr><th scope="row">Corners and ends</th><td>{_esc(corners.title())} corners, {_esc(ends)}.</td></tr>'
                  + '<tr><th scope="row">Keylines</th><td>A circle 20 units across and a square 18 units wide: round shapes touch the '
                    'circle, square ones the square, so their weight matches.</td></tr>')
    icons = (f'<div class="bp-grid-wrap">{grid}<table class="bp-table"><tbody>{icon_rules}</tbody></table></div>')
    icon_srcs = [(p, lic) for p, lic in _icon_files(d, state) if os.path.splitext(p)[1].lower() in BRAND_IMG]
    if icon_srcs:
        icons += '<h3>Your icons</h3><div class="bp-icons">' + "".join(
            f'<figure><div class="bp-light"><img src="{_esc(rel)}" alt="{_esc(os.path.splitext(os.path.basename(rel))[0])} icon" width="24" height="24"></div>'
            f'<figcaption><a href="{_esc(rel)}" download>{_esc(os.path.basename(rel))}</a>'
            + (f'<span class="bp-dim">{_esc(lic)}</span>' if lic else "") + "</figcaption></figure>"
            for rel, lic in ((copy(p, "icons"), lic) for p, lic in icon_srcs)) + "</div>"
    lib = _icon_library(state)
    if lib:
        nm, lc, url = lib
        icons += (f'<p>Open icon set: <b>{_esc(nm)}</b>' + (f', {_esc(lc)} licence' if lc else ", licence not recorded")
                  + (f' (<a href="{_esc(url)}" rel="noopener">licence text</a>)' if url and str(url).startswith("https://") else "")
                  + ". It is not bundled here: install it from its source and keep its licence notice.</p>")
    if not icon_srcs and not lib:
        icons += missing("Your icon files, or the open icon set you chose.",
                         "Q-icon-01 and the H-icons asset: engine.py set hooks.H-icons.files '[\"icons/cart.svg\", \"icons/truck.svg\"]', or "
                         "engine.py set hooks.H-icons.library '\"lucide\"'")

    # ---- voice: only when the person gave it
    voice_words = ctx.get("voice") if (gave("context.voice") or gave("answers.Q-voice-01")
                                       or (hooks.get("H-voice") or {}).get("status") == "have") else None
    vlines = []
    md_path = os.path.join(root, "DESIGN.md")
    if voice_words and os.path.exists(md_path):
        with open(md_path, encoding="utf-8") as fh:
            m = re.search(r"^## Content and Voice\n(.*?)(?=^## |\Z)", fh.read(), flags=re.M | re.S)
        vlines = [re.sub(r"\s*\([^)]*\)\.?$", ".", re.sub(r"[*`]", "", x[2:]).strip()) for x in (m.group(1).splitlines() if m else [])
                  if x.startswith("- ") and "?" not in x and "not recorded" not in x][:6]  # the rules, not the interview's notes
    voice_words = re.sub(r"\s*\([^)]*\)", "", str(voice_words or "")).strip() or None  # a reference's name is never the brand's voice
    voice = (f'<p class="bp-lede">{_esc(voice_words)}</p>' + ("<ul>" + "".join(f"<li>{_esc(x)}</li>" for x in vlines) + "</ul>" if vlines else "")
             if voice_words else missing("How the brand talks: three or four traits, or a voice guide.", "Q-voice-01 and the H-voice asset"))

    # ---- downloads
    dl = [rel for rel in out]
    downloads = ("<ul>" + "".join(f'<li><a href="{_esc(rel)}" download>{_esc(rel[7:])}</a></li>' for rel in dl) + "</ul>") if dl else \
        '<p class="bp-dim">Nothing to download yet: logo and icon files appear here once the owner adds them.</p>'

    # open faces load from Google Fonts, one link per family so a missing weight drops only that family; any other face shows
    # in the page only when it is installed, and a note says so instead of a silent fallback (font files are never shipped)
    links = "".join(f'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family={fq}:wght@{wq}&amp;display=swap">'
                    for fq, wq in ((f.replace(" ", "+"), ";".join(str(w) for w in ws)) for f, ws in loaded))
    named = [str(((base.get(f"font.family.{r_}") or {}).get("resolved") or [None])[0] if isinstance((base.get(f"font.family.{r_}") or {}).get("resolved"), list)
                 else "") for r_ in ("display", "text", "mono")]
    local = sorted({n for n in named if n and not _generic_face(n) and n.lower() not in OPEN_FONTS and n.lower() not in GENERIC_FONTS})
    font_note = ('<p id="bp-font" class="bp-dim" hidden>' + _esc(", ".join(local)) + " is not installed on this computer, so this page "
                 "shows a fallback font in its place.</p>") if local else ""
    check = ("var n=document.getElementById('bp-font');function w(f){var c=document.createElement('canvas').getContext('2d');"
             "c.font='40px '+f;return c.measureText('mmmmmmmmmmlli WQ@#').width}var go=function(){if(n&&" + "||".join(
                 f"w('\"{_esc(x).replace(chr(39), '')}\", monospace')===w('monospace')" for x in local) + ")n.hidden=false};"
             "(document.fonts&&document.fonts.ready?document.fonts.ready.then(go):go());") if local else ""
    sections = [("about", "About", "".join(about)), ("logo", "Logo", logo), ("color", "Colour", color), ("type", "Type", font_note + typ_html),
                ("icons", "Icons", icons), ("voice", "Voice", voice), ("downloads", "Downloads", downloads)]
    nav = "".join(f'<a href="#{sid}">{title}</a>' for sid, title, _b in sections)
    toggle = "".join(f'<button class="bp-th" type="button" data-set="{th}">{_esc(th.title())}</button>' for th in themes)
    dark = next((th for th in themes if "dark" in th), None)
    light = next((th for th in themes if "light" in th), themes[0])
    ink = lambda th, p, fb: hexv(by_theme.get(th) or base, p) or fb
    page_css = f"""
*,*::before,*::after{{box-sizing:border-box}}
body{{margin:0;background:{V('color.surface.base')};color:{V('color.text.primary')};{t('text.body.md')}}}
.bp-wrap{{max-width:1080px;margin:0 auto;padding:0 20px 96px}}
.bp-bar{{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:4px 16px;align-items:center;padding:10px 0;background:{V('color.surface.base')};border-bottom:1px solid {V('color.border.subtle')}}}
.bp-bar a{{color:{V('color.text.secondary')};text-decoration:none;display:inline-flex;align-items:center;min-height:24px}} .bp-bar a:hover{{color:{V('color.text.primary')}}}
.bp-bar span{{flex:1}} .bp-th{{font:inherit;min-height:24px;background:none;border:1px solid {V('color.border.default')};color:{V('color.text.primary')};border-radius:{V('radius.control')};padding:2px 10px;cursor:pointer}}
a:focus-visible,button:focus-visible{{outline:2px solid {V('color.border.focus')};outline-offset:2px}}
.bp-head{{padding:48px 0 8px}} .bp-head h1{{margin:0;{t('text.display.sm') or t('text.headline.lg')}}}
.bp-head p{{margin:10px 0 0;color:{V('color.text.secondary')}}}
.bp-sec{{margin:48px 0 0;padding:24px 0 0;border-top:1px solid {V('color.border.subtle')}}} .bp-sec h2{{margin:0 0 16px;{t('text.headline.sm') or t('text.title.lg')}}}
h3{{margin:24px 0 10px;{t('text.title.md') or t('text.title.sm')}}}
.bp-lede{{max-width:62ch;{t('text.body.lg') or t('text.body.md')}}} .bp-dim{{color:{V('color.text.secondary')}}} p,li{{max-width:70ch}}
.bp-dl dt{{color:{V('color.text.secondary')};{t('text.label.md') or t('text.body.sm')}}} .bp-dl dd{{margin:2px 0 12px}}
.bp-tag{{display:inline-block;{t('text.label.sm') or t('text.body.sm')}padding:2px 8px;border-radius:999px;border:1px solid transparent;white-space:nowrap}}
.bp-chosen{{background:{V('color.bg.accent.subtle')};color:{V('color.text.accent')}}} .bp-default{{color:{V('color.text.secondary')};border-color:{V('color.border.default')}}}
.bp-missing{{color:{V('color.text.secondary')};border:1px dashed {V('color.border.default')}}}
div.bp-missing{{display:block;border-radius:{V('radius.container')};padding:14px 16px;margin:8px 0}} div.bp-missing p{{margin:8px 0 0}}
.bp-how{{{t('text.body.sm')}font-family:var({css_var(prefix, 'font.family.mono')})}}
code{{font-family:var({css_var(prefix, 'font.family.mono')});font-size:.92em;overflow-wrap:anywhere}}
.bp-table{{width:100%;border-collapse:collapse;margin:8px 0}} .bp-table th,.bp-table td{{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid {V('color.border.subtle')}}}
.bp-table th{{color:{V('color.text.secondary')};font-weight:inherit;width:9em}}
.bp-logos,.bp-dos{{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:16px}} figure{{margin:0}}
.bp-grounds{{display:grid;grid-template-columns:1fr 1fr;border-radius:{V('radius.container')};overflow:hidden;border:1px solid {V('color.border.subtle')}}}
.bp-light,.bp-dark{{display:flex;align-items:center;justify-content:center;min-height:120px;padding:20px}} .bp-light{{background:{ink(light, 'color.surface.base', '#ffffff')}}}
.bp-dark{{background:{ink(dark, 'color.surface.base', '#111111') if dark else '#111111'}}} .bp-grounds img{{max-width:100%;max-height:64px}}
figcaption{{margin:8px 0 0;{t('text.body.sm')}}} figcaption a,.bp-sec a{{color:{V('color.text.link')}}} figcaption .bp-dim{{display:block}}
figcaption a,.bp-sec li a{{display:inline-flex;align-items:center;min-height:24px}}
.bp-clear{{display:inline-block;padding:24px;background:{ink(light, 'color.surface.base', '#ffffff')};border:1px solid {V('color.border.subtle')};border-radius:{V('radius.container')}}}
.bp-zone{{outline:1px dashed {V('color.border.strong') if has('color.border.strong') else V('color.border.default')}}} .bp-zone img{{display:block}}
.bp-do .bp-light{{min-height:96px;border:1px solid {V('color.border.subtle')};border-radius:{V('radius.container')}}}
.bp-crowd{{display:inline-flex;align-items:center;gap:0}} .bp-crowd b{{font-weight:inherit;color:{ink(light, 'color.text.primary', '#222222')};{t('text.body.sm')}}}
.bp-no figcaption b{{color:{V('color.text.danger')}}} .bp-yes figcaption b{{color:{V('color.text.success')}}}
.bp-swatches{{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:20px}}
.bp-chips{{display:flex;border-radius:{V('radius.container')};overflow:hidden;border:1px solid {V('color.border.subtle')}}} .bp-chips i{{flex:1;height:72px}}
.bp-sw b{{display:block;margin:10px 0 2px}} .bp-sw p{{margin:4px 0}} .bp-val{{{t('text.body.sm')}font-family:var({css_var(prefix, 'font.family.mono')})}}
.bp-val span{{display:block;color:{V('color.text.secondary')}}}
.bp-face{{margin:0 0 24px}} .bp-spec{{margin:8px 0;overflow-wrap:anywhere}} .bp-glyphs{{{t('text.title.lg') or t('text.body.lg')}margin:4px 0 8px;overflow-wrap:anywhere}}
.bp-grid-wrap{{display:grid;grid-template-columns:minmax(0,240px) minmax(0,1fr);gap:24px;align-items:start}}
.bp-grid{{width:100%;max-width:240px;height:auto;background:{V('color.surface.raised') if has('color.surface.raised') else V('color.surface.base')};border:1px solid {V('color.border.subtle')};border-radius:{V('radius.container')}}}
.bp-grid .g-pad{{fill:none}} .bp-grid .g-live{{fill:{V('color.bg.accent.subtle')}}} .bp-grid .g-lines line{{stroke:{V('color.border.subtle')};stroke-width:.04}}
.bp-grid .g-key{{fill:none;stroke:{V('color.text.accent')};stroke-width:.08;stroke-dasharray:.4 .3}} .bp-grid .g-glyph{{fill:none;stroke:{V('color.text.primary')}}}
.bp-icons{{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:16px}} .bp-icons figure{{text-align:center}}
.bp-icons .bp-light{{min-height:72px;border:1px solid {V('color.border.subtle')};border-radius:{V('radius.container')}}} .bp-icons img{{display:block;width:32px;height:32px}}
@media (max-width:640px){{.bp-grid-wrap{{grid-template-columns:1fr}}}}
"""
    script = ("<script>(function(){var r=document.documentElement;document.querySelectorAll('.bp-th').forEach(function(b){"
              "b.addEventListener('click',function(){r.setAttribute('data-theme',b.dataset.set)})});" + check + "})();</script>")
    lead = (f"{missing_n[0]} thing{'s' if missing_n[0] != 1 else ''} still need the owner." if missing_n[0] else "Everything here comes from the system and the owner.")
    out["index.html"] = (
        f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>{_esc(name)}: brand and press</title>{links}'
        f'<!-- Written by OpenDesigner {OPENDESIGNER_VERSION} (engine.py export --format brand) from the system. Edit the system, not this file. -->'
        f'<style>{css}\n{page_css}</style></head><body><div class="bp-wrap">'
        f'<nav class="bp-bar" aria-label="Sections"><b>{_esc(name)}</b>{nav}<span></span>{toggle}</nav>'
        f'<header class="bp-head"><h1>{_esc(name)}</h1><p>Brand and press. {_esc(lead)} Facts appear only once the owner gives them.</p></header>'
        + "".join(f'<section class="bp-sec" id="{sid}" aria-labelledby="{sid}-h"><h2 id="{sid}-h">{title}</h2>{body}</section>'
                  for sid, title, body in sections)
        + f'</div>{script}</body></html>\n')
    return out


EXPORT_FORMATS = ("css", "tailwind", "figma", "paper", "swift", "compose", "dtcg", "artifact", "brand")
NEUTRAL_FORMATS = ("figma", "paper", "dtcg", "artifact", "brand")  # for design tools, other token tools and people: every platform
CODE_FORMATS = {"css": ("css", "tailwind"), "swift": ("swift",), "compose": ("compose",)}  # project tag -> the code exports it needs
PLATFORM_OF = {"css": "web", "tailwind": "web", "swift": "ios", "compose": "android"}  # the platform each code export is for
FORMAT_FILES = {"css": ("css", "tokens.css"), "tailwind": ("tailwind", "theme.css"), "swift": ("swift", "DesignTokens.swift"),
                "compose": ("compose", "DesignTokens.kt")}


def build_formats(state, d=None):
    """(formats build writes, formats it leaves out), issue 24. The code exports follow the platforms named in Q-plat-01
    through their tags (web and desktop: css and tailwind; ios: swift; android: compose; PLATFORM_TAGS, owner decision D01).
    Everything is written while nobody has named the platforms, or when one has no tags of its own (secondary: watch, TV,
    car or headset). A code export already in build/ is refreshed too, so no file there goes stale."""
    plats = known_platforms(state)
    if plats is None or plats - set(PLATFORM_TAGS):
        return list(EXPORT_FORMATS), []
    tags = project_tags(state) or set()
    want = set(NEUTRAL_FORMATS) | {f for t, fs in CODE_FORMATS.items() if t in tags for f in fs}
    if d:
        want |= {f for f, parts in FORMAT_FILES.items() if os.path.exists(os.path.join(d, "build", *parts))}
    return [f for f in EXPORT_FORMATS if f in want], [f for f in EXPORT_FORMATS if f not in want]


def cmd_export(d, fmt, files=None, meta=None, quiet=False):
    state = merge_defaults(load_state(d))
    if files is None:
        files, meta, _ = generate_system(load_state(d))
    prefix = slug(meta.get("prefix") or state["exports"].get("prefix") or "ds").replace("-", "")
    formats = list(EXPORT_FORMATS) if fmt == "all" else list(fmt) if isinstance(fmt, (list, tuple)) else [fmt]
    written = []
    for f in formats:
        if f == "css":
            p = os.path.join(d, "build", "css", "tokens.css")
            write_text(p, export_css(files, meta, prefix))
        elif f == "tailwind":
            p = os.path.join(d, "build", "tailwind", "theme.css")
            write_text(p, export_tailwind(files, meta, prefix, reset=(state.get("exports") or {}).get("tailwindReset", True) is not False))
        elif f == "figma":
            p = os.path.join(d, "build", "figma", "variables.json")
            dump_json(p, export_figma(files, meta, state, prefix), compact=True)
            _bundle, flats = export_dtcg(files, meta)
            for theme, tree in flats.items():  # Figma native import: one DTCG file per collection and mode (spec 7.6)
                dump_json(os.path.join(d, "build", "figma", "import", f"{theme}.tokens.json"), tree, compact=True)
        elif f == "paper":
            payload, css = export_paper(files, meta, prefix)
            p = os.path.join(d, "build", "paper", "tokens.json")
            dump_json(p, payload, compact=True)
            for theme, text in css.items():
                write_text(os.path.join(d, "build", "paper", f"tokens.{theme}.css"), text)
        elif f == "swift":
            p = os.path.join(d, "build", "swift", "DesignTokens.swift")
            write_text(p, export_swift(files, meta, prefix))
        elif f == "compose":
            p = os.path.join(d, "build", "compose", "DesignTokens.kt")
            write_text(p, export_compose(files, meta, prefix))
        elif f == "dtcg":
            bundle, _flats = export_dtcg(files, meta)
            p = os.path.join(d, "build", "dtcg", f"{slug(meta.get('name') or 'design-system')}.resolver.json")
            dump_json(p, bundle, compact=True)
            for old in os.listdir(os.path.dirname(p)):  # a resolver left by an earlier name
                if old.endswith(".resolver.json") and old != os.path.basename(p):
                    os.remove(os.path.join(os.path.dirname(p), old))
        elif f == "artifact":
            out = export_artifact(d, files, meta, state, prefix)
            for rel, text in out.items():
                write_text(os.path.join(d, "build", "artifact", rel), text)
            p = os.path.join(d, "build", "artifact", "project", "design-system.json")
        elif f == "brand":  # issue 49: the brand and press page, with the person's logo and icon files beside it
            out = export_brand(d, files, meta, state, prefix)
            bdir = os.path.join(d, "build", "brand")
            if os.path.isdir(os.path.join(bdir, "assets")):
                shutil.rmtree(os.path.join(bdir, "assets"))  # a file the person removed leaves the page too
            for rel, body in out.items():
                fp = os.path.join(bdir, *rel.split("/"))
                if isinstance(body, bytes):
                    os.makedirs(os.path.dirname(fp), exist_ok=True)
                    with open(fp, "wb") as fh:
                        fh.write(body)
                else:
                    write_text(fp, body)
            p = os.path.join(bdir, "index.html")
        else:
            raise SystemExit(f"unknown format {f}; use css, tailwind, figma, paper, swift, compose, dtcg, artifact, brand or all")
        written.append(p)
    if not quiet:
        for p in written:
            print(f"wrote {p}")
    return written


# =============================================================================================
# DESIGN.md and PRODUCT.md (spec 7.2, 7.3)
# =============================================================================================

DESIGN_SECTIONS = ["Overview", "Colors", "Typography", "Layout", "Elevation & Depth", "Shapes", "Components", "Do's and Don'ts",
                   "Motion", "Modes and Themes", "Iconography and Imagery", "Content and Voice", "Accessibility",
                   "Platforms and Devices", "Decisions", "Open Items", "For Agents"]
PRODUCT_SECTIONS = ["Product", "Audience", "Users", "Site brief", "Surfaces", "Memorable Thing", "Principles", "Constraints", "Scope", "Team and Governance"]
SECTION_PATHS = {  # which decisions each DESIGN.md section rests on
    "Overview": r"^(dials\.(expression|brandPresence|density)|preset|macros|answers\.Q-(aud|brand|dir|scope|site)-)",
    "Colors": r"^(dials\.(colorfulness|warmth)|raw\.(brandColor|primaryActionColor|focusColor|neutralBase|secondaryColors|contrastTarget|flags)|answers\.Q-(color|theme)-)",
    "Typography": r"^(raw\.(textFace|displayFace|monoFace|baseSize|scripts|marketingSurfaces)|overrides\.type|answers\.Q-type-)",
    "Layout": r"^(dials\.density|raw\.(spaceUnit|inputs|minTarget)|answers\.Q-(space|layout)-)",
    "Elevation & Depth": r"^(dials\.depth|answers\.Q-depth-)",
    "Shapes": r"^(dials\.roundness|overrides\.radius|answers\.Q-shape-)",
    "Components": r"^(components|answers\.Q-(comp|state|form|pattern)-)",
    "Motion": r"^(dials\.energy|raw\.flags\.motionOff|overrides\.motion|answers\.Q-motion-)",
    "Modes and Themes": r"^(raw\.(defaultTheme|flags\.darkMode)|answers\.Q-(theme|token)-)",
    "Iconography and Imagery": r"^(hooks\.H-(logo|appicon|favicon|icons|illus|photo|motif)|answers\.Q-(icon|img|viz)-)",
    "Content and Voice": r"^(hooks\.H-voice|answers\.Q-voice-)",
    "Platforms and Devices": r"^(raw\.(platforms|inputs)|answers\.Q-plat-)",
    "Accessibility": r"^(raw\.(contrastTarget|minTarget|focusWidth)|answers\.Q-(color-2[2-4]|aud-0[2-4]))",
}
# Zoom (BRIEF req. 14-15): every area starts as a sketch from the Level 0 answers and can be zoomed in step by step.
ZOOM_LEVELS = ["sketch", "broad", "defined", "detailed"]
ZOOM_AREAS = [("overview", "Overview"), ("color", "Colors"), ("typography", "Typography"), ("layout", "Layout"),
              ("elevation", "Elevation & Depth"), ("shape", "Shapes"), ("components", "Components"), ("motion", "Motion"),
              ("modes", "Modes and Themes"), ("iconography", "Iconography and Imagery"), ("content", "Content and Voice"),
              ("accessibility", "Accessibility"), ("platforms", "Platforms and Devices")]
ZOOM_NEXT = {"overview": ["Q-brand-01", "Q-dir-01"], "color": ["Q-color-01", "Q-color-02", "Q-color-20"], "typography": ["Q-type-01", "Q-type-08"],
             "layout": ["Q-space-01", "Q-layout-01"], "elevation": ["Q-depth-01"], "shape": ["Q-shape-01"],
             "components": ["Q-comp-01", "Q-state-01"], "motion": ["Q-motion-01", "Q-motion-02"], "modes": ["Q-theme-01", "Q-theme-02"],
             "iconography": ["Q-icon-01", "Q-img-01"], "content": ["Q-voice-01"], "accessibility": ["Q-color-24", "Q-aud-02"],
             "platforms": ["Q-plat-01", "Q-plat-05"]}


def _md_table(headers, rows):
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(c).replace("|", "\\|").replace("\n", " ") for c in r) + " |")
    return "\n".join(out)


def _decisions(d):
    """Latest decision per path from decisions.md: path -> {id, value, set_by, reason, locked}."""
    fp = os.path.join(d, "decisions.md")
    out = {}
    if not os.path.exists(fp):
        return out
    with open(fp, encoding="utf-8") as f:
        text = f.read()
    for m in re.finditer(r"^## (D-\d+) · (.*?)\n- set_by: (\S+) · locked: (\S+).*?\n- reason: (.*?)\n", text, flags=re.M):
        did, head, set_by, locked, reason = m.groups()
        path, _, val = head.partition(" = ")
        if not val:
            continue
        out[path.strip()] = {"id": did, "value": val.strip(), "set_by": set_by, "locked": locked == "yes", "reason": reason.strip()}
    return out


def _decision_log(d):
    """Every entry of decisions.md in order: {id, head, path, value, set_by, locked, reason}. path is '' for an entry whose
    title names no single path (a standards batch, an override of a whole standard)."""
    fp = os.path.join(d, "decisions.md")
    if not os.path.exists(fp):
        return []
    with open(fp, encoding="utf-8") as f:
        text = f.read()
    out = []
    for block in re.split(r"^(?=## D-\d+ · )", text, flags=re.M):
        m = re.match(r"## (D-\d+) · (.*?)\n- set_by: (\S+) · locked: (\S+).*?\n- reason: (.*?)\n", block)
        if not m:
            continue
        did, head, set_by, locked, reason = m.groups()
        path, _, val = head.partition(" = ")
        over = re.search(r"^- house standard (STD-[\w-]+): ", block, flags=re.M) if set_by in PERSON_SET_BY else None
        out.append({"id": did, "head": head.strip(), "path": path.strip() if val else "", "value": val.strip(), "set_by": set_by,
                    "locked": locked == "yes", "reason": reason.strip(), "overrides": over.group(1) if over else None})
    return out


PERSON_SET_BY = ("chosen", "confirmed_default", "assumed", "delegated", "reference", "asset", "research")


def decision_table_rows(d, limit=40):
    """DESIGN.md's Decisions table (R21): the person's own decisions first (chosen, confirmed, assumed, delegated, from a
    reference or an asset; the newest value per path) and their changes to standards, then one row per standards batch,
    never one row per value a standard set. Returns (rows, how many were left out)."""
    log = _decision_log(d)
    latest = {}
    for e_ in log:
        if e_["path"]:
            latest[e_["path"]] = e_
    cut = lambda t: t if len(t) <= 160 else t[:157].rsplit(" ", 1)[0] + "..."
    mine = [e_ for e_ in log if e_["path"] and latest.get(e_["path"]) is e_ and e_["set_by"] in PERSON_SET_BY
            and not e_["path"].startswith("standards.")]
    std_person = [e_ for e_ in log if e_["set_by"] in PERSON_SET_BY and (e_["path"].startswith("standards.") or not e_["path"])
                  and e_["path"] != "init"]
    batches = [e_ for e_ in log if e_["set_by"] == "standard"]
    rows = [(e_["id"], f"`{shown_path(e_['path'])}`", e_["value"], e_["set_by"] + (" (locked)" if e_["locked"] else "")
             + (f", overrides {e_['overrides']}" if e_.get("overrides") else ""), cut(e_["reason"])) for e_ in mine]
    rows += [(e_["id"], "standards", e_["head"] if not e_["path"] else f"{e_['path']} = {e_['value']}",
              e_["set_by"] + (f", overrides {e_['overrides']}" if e_.get("overrides") else ""), cut(e_["reason"])) for e_ in std_person]
    rows += [(e_["id"], "standards", e_["head"] if not e_["path"] else f"{e_['path']} = {e_['value']}",
              "standard" + (" (locked)" if e_["locked"] else ""), cut(e_["reason"])) for e_ in batches]
    return rows[:limit], max(0, len(rows) - limit)


def _keep_blocks(text):
    """od:keep blocks by section heading, so hand-written prose survives regeneration (spec 7.2)."""
    keeps = {}
    if not text:
        return keeps
    for sec in re.split(r"^## ", text, flags=re.M)[1:]:
        title = sec.split("\n", 1)[0].strip()
        m = re.search(r"<!-- od:keep -->.*?<!-- /od:keep -->", sec, flags=re.S)
        if m:
            keeps[title] = m.group(0)
    return keeps


def _direction_words(state):
    pid, is_default = effective_preset(state)
    st = effective_style(state)
    if st:  # the name the person can repeat, then the plain words, then what it is built on
        return f"style {st['name']} ({st['plain']}), built on preset {pid}"
    if not pid:
        return "no named preset"
    return f"preset {pid}" + (" (the default until Q-dir-01 is answered)" if is_default else "")


def dial_side(dial, v):
    """A dial position in its own end words: 'calm', 'leaning calm', 'balanced', 'leaning energetic' or 'energetic'."""
    L = {d["id"]: d for d in levers()["dials"]}[dial]
    return (L["left"] if v <= 33 else f"leaning {L['left']}" if v < 45 else "balanced" if v <= 55
            else f"leaning {L['right']}" if v < 67 else L["right"])


def dial_words(dial, v, params, ci=None, meta=None):
    """One DESIGN.md line per dial. Each value is the one the tokens hold (meta, from the build), and where the engine moved
    it away from the dial's band (levers.json notes the rule), the line says so in a few words, so the two never disagree
    unexplained (issue 69). Without meta (no build yet) it prints the band values."""
    L = {d["id"]: d for d in levers()["dials"]}[dial]
    side = dial_side(dial, v)
    pretty = re.sub(r"(?<=[a-z])([A-Z])", lambda m_: " " + m_.group(1).lower(), dial)
    head = f"**{pretty[0].upper() + pretty[1:]} {v}/100** ({L['left']} to {L['right']}: {side})"
    m = meta or {}
    ty, shp, mo, el = m.get("type") or {}, m.get("shape") or {}, m.get("motion") or {}, m.get("elevation") or {}
    dens = (m.get("density") or {}).get(params["space.densityMode"]) or {}
    px = lambda r: "full" if r == "full" or (isinstance(r, (int, float)) and r >= FULL) else f"{fmt_num(r)}px"
    band_r, ctl = params["radius.control"], shp.get("control", params["radius.control"])
    if px(ctl) == px(band_r):
        radius = f"control radius {px(ctl)}"
    elif not shp.get("chosen"):
        u = levers()["formulas"]["radius"]["unchosen"]
        radius = (f"control radius {px(ctl)} (the band gives {px(band_r)}; until someone picks a corner shape, Q-shape-01, corners stay "
                  f"between {u['to']} and {u['max']}px)")
    else:
        radius = f"control radius {px(ctl)} (the band gives {px(band_r)}; an override or a standard sets it)"
    band_w, hw = params["type.headingWeight"], (ty.get("weights") or {}).get("heading", params["type.headingWeight"])
    weight = f"heading weight {hw}" + (f" (the band gives {band_w}; a page with two weights uses {hw})" if hw != band_w else "")
    band_m, model = params["elevation.model"], el.get("model", params["elevation.model"])
    look_m = (m.get("look") or {}).get("elevationModel")
    depth = f"depth model: {model}" + ("" if model == band_m else
                                       f" (the band gives {band_m}; {'the style builds its own' if model == look_m else 'an override sets it'})")
    say = {
        "expression": f"type ratio {ty.get('ratio', params['type.ratio'])}, hero moments: {params['emphasis.heroMoments']}, expressive motion: "
                      f"{params['motion.expressiveScope']}, brand color role: {params['color.brandRole']}, containment: {params['layout.containment']}",
        "brandPresence": f"typeface suggestion: {params['type.faceSuggestion']}, brand color placement: {params['color.brandPlacement']}, "
                         f"native component share about {int(round(params['components.nativeShare'] * 100))}%, voice guidance: {params['content.voiceGuidance']}",
        "density": f"body {ty.get('base', params['type.baseSize.web'])}px on the web, default control "
                   f"{(dens.get('control') or {}).get('md', params['control.height.md'])}px, density mode {params['space.densityMode']}, "
                   f"icons {(m.get('space') or {}).get('iconDefault', params['icon.defaultSize'])}px; hit areas never shrink",
        "energy": f"standard easing {mo.get('standard', params['motion.easing.standard'])}, duration multiplier "
                  f"{rnd(mo.get('multiplier', params['motion.durationMultiplier']), 2)}, spring damping "
                  f"{rnd((mo.get('spatial') or {}).get('dampingRatio', params['motion.spring.spatial.dampingRatio']), 2)}, {weight}, "
                  f"navigation: {params['chrome.navTreatment']}",
        "roundness": f"{radius}, icon corners {shp.get('iconCorners', params['icon.cornerStyle'])}, caps {shp.get('iconCaps', params['icon.caps'])}",
        "depth": depth,
        "colorfulness": f"scheme {params['color.schemeVariant']}, accent chroma {rnd((ci or {}).get('peakHct', params['color.accentChroma.hct']), 1)} (HCT), "
                        f"{(ci or {}).get('accentCount', params['color.accentCount'])} accent(s), surfaces: {params['color.surfaces']}",
        "warmth": f"neutral tint chroma {rnd(params['color.neutral.tint.oklch'].get('c') or 0, 3)} at hue {params['color.neutral.tint.oklch'].get('h')}, "
                  f"borders: {params['border.softness']}, {params['content.capitalization']}, contractions {params['content.contractions']}",
    }[dial]
    return f"{head}: {say}."


def _hex_pair(light, dark, path):
    lv = hex_of(light[path]["resolved"]) if path in light else "-"
    dv = hex_of(dark[path]["resolved"]) if dark and path in dark else "same"
    la = (light[path]["resolved"] or {}).get("alpha") if path in light and isinstance(light[path]["resolved"], dict) else None
    if la is not None:
        lv += f" @{la}"
    return f"`{lv}`", f"`{dv}`"



MODE_PLAIN = {"Persuade": "a page that shows off and invites people in", "Operate": "screens where people get work done",
              "Read": "pages people read", "Experience": "something people explore and enjoy"}


def answered_label(state, qid):
    rec = (state.get("answers") or {}).get(qid)
    if rec is None:
        return None
    return answer_words(qid, answer_value(rec))


def product_words(state):
    ctx = state.get("context") or {}
    return ctx.get("product") or state.get("summary") or answered_label(state, "Q-scope-01") or ""


def audience_words(state):
    """context.audience, else the Q-aud-01 answer in plain words (U5 F24: never 'not recorded' once answered)."""
    ctx = state.get("context") or {}
    if ctx.get("audience"):
        return ctx["audience"]
    rec = (state.get("answers") or {}).get("Q-aud-01")
    if rec is None:
        return ""
    v = answer_value(rec)
    return AUDIENCE_WORDS.get(v) or answer_words("Q-aud-01", v)


def surface_words(state):
    surf = (state.get("context") or {}).get("surfaces") or []
    if surf:
        return "; ".join(f"{s.get('name')} ({MODE_PLAIN.get(s.get('mode'), s.get('mode'))})" if isinstance(s, dict) else str(s) for s in surf)
    rec = (state.get("answers") or {}).get("Q-scope-06")
    if rec is None:
        return ""
    items = surface_list(answer_value(rec))
    return "; ".join(MODE_PLAIN.get(x["mode"], x["mode"]) for x in items)


def feel_phrase(state, dials):
    ids = [m if isinstance(m, str) else m.get("id") for m in state.get("macros") or []]
    ids = [x for x in ids if x]
    if ids:
        return ", ".join(ids[:-1]) + (" and " if len(ids) > 1 else "") + ids[-1]
    return "calm" if dials["expression"] <= 33 else "balanced" if dials["expression"] <= 66 else "lively"


def licence_risks(state, meta):
    """Licence risks to show the person (U5): fonts outside their licence scope, and the terms of the asset paths
    chosen through the hooks (open libraries, tools, commissioned work), from references/hooks.json."""
    out = []
    raw = state.get("raw") or {}
    apps = set(raw.get("platforms") or []) & {"ios", "android", "desktop", "macos", "windows", "ipados"}
    for role, f in ((meta.get("type") or {}).get("faces") or {}).items():
        if not f or f.get("open") or f.get("face") in (None, "=textFace"):
            continue
        if f.get("note"):
            out.append(f["note"] + ".")
        elif apps and f.get("app") is None:
            out.append(f"{f['face']}: the app licence is not recorded, so the {', '.join(sorted(apps))} files use the system font until it is.")
        if f.get("web") is None:
            out.append(f"{f['face']}: confirm the web licence (record it with engine.py set raw.fontLicence).")
        if f.get("selfHost") is False:
            out.append(f"{f['face']}: load it from the licensed font service; the licence does not allow self-hosting.")
    data = {}
    path = os.path.join(REFERENCES, "hooks.json")
    if os.path.exists(path):
        try:
            data = {h["id"]: h for h in read_json(path).get("hooks", [])}
        except (ValueError, KeyError):
            data = {}
    for hid, rec in (state.get("hooks") or {}).items():
        st = (rec or {}).get("status")
        name = hook_label(hid, rec)
        if st == "commissioning":
            out.append(f"{name[:1].upper() + name[1:]}: get a written copyright assignment from the designer before you use it.")
        elif st in ("open-library", "tool") and hid != "H-type":
            text = (data.get(hid) or {}).get("if_no", "")
            sents = [x for x in re.split(r"(?<=[.;])\s+(?=[A-Z(])", text)
                     if re.search(r"licen|credit|attribut|terms|trademark|resale|AI train|copyright|royalt", x, re.I)
                     and not x.lower().startswith("commission")]
            if sents:
                out.append(f"{name[:1].upper() + name[1:]}: check the terms of the set you use. {sents[0].strip()[:220]}")
    return out


def face_licence_words(faces, raw):
    parts = []
    for role, f in faces.items():
        if not f or f.get("face") in (None, "=textFace"):
            continue
        name = {"=serif": "the system serif", "=rounded": "the system rounded font"}.get(f["face"], f["face"])
        if f.get("open"):
            parts.append(f"{role}: {name} (open licence or system font: web, apps and self-hosting)")
            continue
        yes = [k for k in ("web", "app", "selfHost") if f.get(k) is True]
        no = [k for k in ("web", "app", "selfHost") if f.get(k) is False]
        unk = [k for k in ("web", "app", "selfHost") if f.get(k) is None]
        words = {"web": "web", "app": "apps", "selfHost": "self-hosting"}
        parts.append(f"{role}: {name}: licensed for {', '.join(words[k] for k in yes) or 'nothing recorded'}"
                     + (f"; not for {', '.join(words[k] for k in no)} (the system font is used there)" if no else "")
                     + (f"; not recorded for {', '.join(words[k] for k in unk)}" if unk else ""))
    return "; ".join(parts) + "." if parts else "system fonts only."


def answer_counts(state, latest):
    """(answers the person gave, answers picked for them): each answered question once, by who set it now (R20).
    DESIGN.md's summary and overview.html both count this way, so their numbers agree."""
    ans = state.get("answers") or {}
    by = {}
    for qid, rec in ans.items():
        sb = (latest.get(f"answers.{qid}") or {}).get("set_by") or (rec.get("set_by", "chosen") if isinstance(rec, dict) else "chosen")
        by[sb] = by.get(sb, 0) + 1
    for path, (_q, _h) in ANSWER_PATHS.items():
        if get_path(state, path) not in (None, "", [], {}, "pending") and _q not in ans:
            sb = (latest.get(path) or {}).get("set_by") or "chosen"
            by[sb] = by.get(sb, 0) + 1
    return (by.get("chosen", 0) + by.get("confirmed_default", 0) + by.get("reference", 0) + by.get("asset", 0) + by.get("research", 0),
            by.get("delegated", 0) + by.get("assumed", 0))


def render_summary(d, state, meta, zoom):
    """The first screen of DESIGN.md (U5 F26): what this is, for whom, where, how it feels, the brand color, what is
    decided and what is next, in plain words and at most about 15 lines."""
    name = state.get("name") or "This design system"
    ans = state.get("answers") or {}
    latest = _decisions(d)  # each path's latest decision: who set it now, not who set it first (R20)
    mine, picked = answer_counts(state, latest)
    sketchy = [t for k, t in ZOOM_AREAS if k != "overview" and zoom[k]["level"] == "sketch"]
    feel_own = (state.get("taste") or {}).get("feelWords") or []
    macros = [m if isinstance(m, str) else m.get("id") for m in state.get("macros") or []]
    picked_feel = "delegated" in ((latest.get("macros") or {}).get("set_by"), (latest.get("taste.feelWords") or {}).get("set_by"))
    notes = ([", ".join(macros)] if feel_own and macros and [w.lower().strip('!.') for w in feel_own] != macros else []) \
        + (["picked for you"] if picked_feel else [])
    feel = (", ".join(feel_own) if feel_own else ", ".join(macros))
    feel += f" ({'; '.join(notes)})" if feel and notes else ""
    risks = licence_risks(state, meta)
    what = product_words(state)
    if what and what.lower().startswith(name.lower()):
        what = what[len(name):].lstrip(" ,:;-") or what
    if what and re.match(r"^(a|an|the)\s", what, re.I):
        head = f"**{name}** is {what[:1].lower() + what[1:]}"
    elif what:
        head = f"**{name}**: {what}"
    else:
        head = f"**{name}** is a design system; what it is for is not recorded yet (Q-scope-01)"
    lines = [head.rstrip(".") + ".", ""]
    rows = [("For", audience_words(state) or "not asked yet"),
            ("Screens", surface_words(state) or "not asked yet"),
            ("Runs on", ", ".join(state.get("raw", {}).get("platforms") or ["web"])),
            ("Feel", feel or "not asked yet"),
            *([("Style", f"{effective_style(state)['name']} ({effective_style(state)['plain']})")] if effective_style(state) else []),
            ("Brand color", brand_line(meta, state, plain=True, delegated=brand_delegated(d), hexes=True) or "none yet: a stand-in blue is used"),
            ("Decided", (f"{mine} answer{'s' if mine != 1 else ''} you gave" if mine or not picked else "")
             + (", " if mine and picked else "") + (f"{picked} picked for you" if picked else "")
             + "; everything else uses sourced defaults"),
            ("Next", (f"zoom into {', '.join(sketchy[:3])}, or stop here: each level works" if sketchy
                      else "every area is past the sketch; zoom deeper where it matters, or stop here")),
            ("Licence risks", " ".join(risks[:2]) + (f" (+{len(risks) - 2} more in Open Items)" if len(risks) > 2 else "") if risks else "none found")]
    sts = std_state(state) if isinstance(state.get("standards"), dict) else {}
    over = sts.get("overridden") or {}
    n_std = len(std_followed(state)) if sts.get("applied") else 0  # the same count as the Standards section (R23)
    n_prj = len(sts.get("project") or [])
    if n_std or n_prj or over:
        rows.insert(-2, ("Standards", ", ".join(x for x in (
            f"{n_std} house standard{'s' if n_std != 1 else ''} followed (locked, {std_version_words(state)})" if n_std else "",
            f"{len(over)} overridden by you" if over else "", f"{n_prj} of your own" if n_prj else "") if x)
            + "; see the Standards section"))
    lines += [f"- **{k}:** {v}" for k, v in rows]
    return "\n".join(lines)


def colors_lead(meta, state, light, delegated=False):
    ci = meta["color"]
    brand = (state.get("raw") or {}).get("brandColor")
    extra = [x for x in ("accent2", "accent3") if x in ci.get("ramps", [])]
    if ci.get("scheme") == "monochrome" and "action" not in ci.get("ramps", []):
        return "**Buttons use near-black ink; color is kept for status, links and focus.** Everything else stays neutral."
    pac = (state.get("raw") or {}).get("primaryActionColor")
    if pac and "action" in ci.get("ramps", []):  # the primary action has its own color, so the accent marks the rest
        ink = hct_chroma_of_hex(pac) < INK_HCT
        rest = f"your brand color `{brand}`" if brand else "a stand-in blue (no brand color yet)"
        return (f"**Buttons use your primary action color `{pac}`" + (", an ink that turns near-white in dark mode" if ink else "")
                + f"; {rest} marks links, selection and focus.** Everything else stays neutral.")
    if brand and delegated:
        first = f"{color_words(brand)} picked for you (`{brand}`) marks buttons, links and focus"
    elif brand:
        how = "exactly" if ci.get("pinnedStep") else "as a readable shade"
        first = f"your brand color `{brand}` ({how}) marks buttons, links and focus"
    else:
        first = "a stand-in blue marks buttons, links and focus (no brand color yet)"
    if extra:
        others = [hex_of(light[f"color.bg.{x}.bold"]["resolved"]) for x in extra if f"color.bg.{x}.bold" in light]
        word = {2: "Two", 3: "Three"}.get(1 + len(extra), str(1 + len(extra)))
        return f"**{word} accent colors: {first}; `{'`, `'.join(others)}` add{'s' if len(others) == 1 else ''} highlights.** Everything else stays neutral."
    return f"**One accent color: {first}.** Everything else stays neutral."


DEPTH_LEADS = {"borders": "**Surfaces are separated by thin borders, with no shadows.**",
               "ring+faint-shadow": "**Cards get a faint outline and a very soft shadow.**",
               "tonal": "**Surfaces step in lightness; only menus and dialogs cast shadows.**",
               "shadow-ladder": "**Raised things cast soft shadows that grow with height.**",
               "materials": "**Controls and bars can be see-through glass, with solid fallbacks.**",
               "offset": "**Cards and buttons cast hard, solid shadows, like stickers.**",
               "extruded": "**Surfaces look pushed out of the page, with a light and a dark soft shadow.**",
               "clay": "**Shapes look puffy, with soft shadows inside their edges.**",
               "glow": "**Raised things glow softly in the accent color.**"}


def shapes_lead(shp):
    return (f"**Buttons and fields have {'fully round' if shp['control'] == 'full' else str(shp['control']) + 'px'} corners; "
            f"cards have {shp['container']}px corners.**")


def motion_lead(mot, medium_ms):
    return ("**Motion is off: things change in place without moving.**" if mot.get("motionOff")
            else f"**Most movements take {medium_ms}ms.** They turn into fades when a person asks for less motion.")


def token_ms(light, path):
    """A resolved duration token in ms (so an override shows, not the lever's value), or None."""
    t = (light.get(path) or {}).get("resolved")
    if not (isinstance(t, dict) and isinstance(t.get("value"), (int, float))):
        return None
    v = t["value"] * 1000 if t.get("unit") == "s" else t["value"]
    return int(v) if float(v).is_integer() else v


def _yours(rec):
    return (rec or {}).get("set_by") not in ("delegated", "assumed")


def taste_nevers(d, state, index=None):
    """The person's Never list, each item with where it came from: their own words (taste.never), the red lines of their
    taste index (screens they rated 'I hate it') and a high generic allergy in the taste poll. It is taste, not a rule:
    `engine.py review` flags red lines and nothing fails a build (references/taste.md)."""
    own = (state.get("taste") or {}).get("never") or []
    src = "your words" if _yours(_decisions(d).get("taste.never") if d else None) else "picked for you"
    out = [(str(w).strip().rstrip("."), src) for w in ([own] if isinstance(own, str) else own) if str(w).strip()]
    index = taste_index(d, state) if index is None else index
    if index and taste_py:
        hated = "screens you rated 'I hate it'"
        out += [(taste_py.line_text(r, plain=True), hated) for r in index.get("redLines") or []]
        if (index.get("genericAllergy") or 0) > 0.5:
            out.append(("safe, middle-of-the-road defaults", "your taste poll ratings"))
    return out


def never_words(items):
    """'gradients, emoji (your words); too deep (screens you rated ...)': items grouped by where they came from."""
    groups = {}
    for w, src in items:
        groups.setdefault(src, []).append(w)
    return "; ".join(f"{', '.join(ws)} ({src})" for src, ws in groups.items())


def taste_card(d, state, meta, light, delegated=False, index=None):
    """Five lines that sum up how the system looks and feels, each with where it comes from (references/taste.md).
    Color, shape and motion reuse the plain sentences that open those DESIGN.md sections, so the card and the sections
    cannot disagree. The picture and the Never list are only ever the person's: when missing, the card says so."""
    taste, dials = state.get("taste") or {}, meta["dials"]
    brief = re.sub(r"\s+", " ", str(taste.get("brief") or "")).strip().strip('"')
    if brief:
        mine = _yours(_decisions(d).get("taste.brief") if d else None)
        pic = (f'"{brief}"', "your words" if mine else "picked for you; say it in your own words to replace it")
    else:
        pic = ('Not given yet. Describe the look as a picture, not adjectives (for example, "a quiet library at night").',
               "not asked yet")
    shp, mot = meta["shape"], meta["motion"]
    move = _plain(motion_lead(mot, token_ms(light, "motion.duration.medium") or mot["durations"].get("medium")))
    nev = taste_nevers(d, state, index)
    return [("In your words", *pic),
            ("Color", _plain(colors_lead(meta, state, light, delegated=delegated))
             + " Keep the accent to small areas, about 15% of a screen at most (a rule of thumb, DC-L15-03).",
             ("brand color" if (state.get("raw") or {}).get("brandColor") else "no brand color yet")
             + f"; colorfulness {dials['colorfulness']}/100"),
            ("Shape", (_plain(shapes_lead(shp)) + " " + _plain(DEPTH_LEADS.get(meta["elevation"]["model"], ""))).strip(),
             f"roundness {dials['roundness']}/100, depth {dials['depth']}/100"),
            ("Motion", move if mot.get("motionOff") else f"{dial_side('energy', dials['energy']).capitalize()}. {move}",
             f"energy {dials['energy']}/100"),
            ("Never", never_words(nev) if nev else
             "Nothing yet. Say what it should never look like, or rate real screens in the taste poll.",
             "named with each item" if nev else "not asked yet")]


def _plain(s):
    return re.sub(r"\*\*", "", s or "").strip()


def tailwind_classes(files):
    """Tailwind v4 class names generated by build/tailwind/theme.css, grouped for DESIGN.md (U5 F14)."""
    flat = resolve_all(files, {})
    has = lambda p: p in flat
    out = {"color": [], "layout": [], "shape": [], "elevation": [], "type": [], "motion": []}
    for p, c in (("color.bg.action.primary", "bg-action-primary"), ("color.bg.action.primary-hover", "hover:bg-action-primary-hover"),
                 ("color.bg.action.primary-pressed", "active:bg-action-primary-pressed"), ("color.text.on-action", "text-on-action"),
                 ("color.surface.base", "bg-surface-base"), ("color.surface.raised", "bg-surface-raised"), ("color.text.primary", "text-fg-primary"),
                 ("color.text.secondary", "text-fg-secondary"), ("color.text.link", "text-fg-link"), ("color.border.subtle", "border-line-subtle"),
                 ("color.border.input", "border-line-input"), ("color.border.focus", "outline-line-focus"), ("color.bg.danger.bold", "bg-danger-bold")):
        if has(p):
            out["color"].append(c)
    for p, c in (("space.inset.md", "p-inset-md"), ("space.stack.md", "gap-stack-md"), ("space.inline.sm", "gap-inline-sm"),
                 ("size.control.md", "h-control-md"), ("size.icon.md", "size-icon-md"), ("size.target.min", "min-h-target-min")):
        if has(p):
            out["layout"].append(c)
    out["shape"] = ["rounded-control", "rounded-container", "rounded-overlay", "rounded-full"]
    out["elevation"] = ["shadow-raised", "shadow-floating", "shadow-overlay"]
    out["type"] = [f"text-{'-'.join(p.split('.')[1:])}" for p in ("text.body.md", "text.label.lg", "text.title.md", "text.headline.md") if has(p)]
    out["motion"] = ["transition-feedback"] + [f"ease-{k}" for k in ("enter", "exit", "hover") if has(f"motion.easing.{k}")]
    return out


def render_design_md(d, files, meta, state, existing="", out_dir=None):
    rel = os.path.relpath(os.path.abspath(d), os.path.abspath(out_dir or doc_dir(d))).replace(os.sep, "/")
    R = lambda p: p if rel in (".", "") else f"{rel}/{p}"  # paths as seen from DESIGN.md, which sits at the project root (R21)
    res = files["opendesigner.resolver.json"]
    mods = res.get("modifiers", {})
    has_dark = "theme" in mods and "dark" in mods["theme"]["contexts"]
    light = resolve_all(files, {"theme": "light"} if "theme" in mods else {})
    dark = resolve_all(files, {"theme": "dark"}) if has_dark else None
    params = {k: v["value"] for k, v in meta["params"].items()}
    dials = meta["dials"]
    decs = std_decision_rows(state, _decisions(d))  # plus values standards set (their grouped titles name no path)
    keeps = _keep_blocks(existing)
    raw = state["raw"]
    ctx = state.get("context") or {}
    prefix = meta.get("prefix", "ds")
    tinfo, sinfo, shp, mot, el = meta["type"], meta["space"], meta["shape"], meta["motion"], meta["elevation"]
    fmts = build_formats(state, d)[0]  # the code exports build writes for these platforms; only those are named below
    lim, lay = meta.get("limits") or {}, sinfo.get("layout") or {}  # page caps and layout (older meta files have neither)
    H = lambda p: hex_of(light[p]["resolved"])

    def dec_ids(sec):
        rx = SECTION_PATHS.get(sec)
        if not rx:
            return ""
        by_id = {}  # each decision once, however many of the section's values it set (a standards batch sets dozens, R29)
        for k, v in decs.items():
            if re.match(rx, k):
                by_id.setdefault(v["id"], []).append(k)
        ids = [f"{i} ({ks[0]})" if len(ks) == 1 else
               f"{i} ({len(ks)} values" + (", standards" if all(decs[k]["set_by"] == "standard" for k in ks) else "") + ")"
               for i, ks in sorted(by_id.items(), key=lambda kv: _dnum(kv[0]))]
        return "Decisions: " + (", ".join(ids) if ids else "none recorded yet; values are defaults from references/levers.json") + "."

    zoom = zoom_levels(d, state)
    ztitle = {t: k for k, t in ZOOM_AREAS}
    by_area = {}
    for qid, rec in sorted((state.get("answers") or {}).items()):
        by_area.setdefault((questions().get(qid) or {}).get("area") or "overview", []).append((qid, rec))

    def answers_block(area):
        """Every answer in the area in plain words, with how it was set and what it shapes (U5: answers are never silent)."""
        items = by_area.get(area) or []
        if not items:
            return ""
        shapes = {"rule": "a rule here", "owner": "owner input", "hook": "asset status", "export": "exports", "reference": "reference"}
        rows = []
        for qid, rec in items:
            q = questions().get(qid) or {}
            ask = re.split(r"(?<=[?.])\s", q.get("ask") or qid)[0]
            if len(ask) > 100:
                ask = ask[:100].rsplit(" ", 1)[0] + "..."
            kind = shapes.get(ANSWER_RECORDS.get(qid)) or "tokens"
            rows.append(f"- {ask} **{answer_words(qid, answer_value(rec))}** ({rec.get('set_by', 'chosen') if isinstance(rec, dict) else 'chosen'}; "
                        f"{kind}; {qid})")
        return "**Your answers here** (each one either sets tokens or is a rule for this section):\n" + "\n".join(rows)

    def section(title, body, lead=None, term_key=None, fold=True, after=None):
        """Three-voice layout (synthesis/THREE-VOICES.md, assets/output/DESIGN.md): zoom line, one plain sentence,
        the one-line 'Designers · Code' note, then the full designer and engineer detail folded under 'More'.
        after is shown, not folded, right after 'More', so the three-voice opening stays as it is (the Overview's taste card)."""
        parts = [f"## {title}", ""]
        zk = ztitle.get(title)
        if zk:
            z = zoom[zk]
            nxt = f" To zoom in, answer {', '.join(z['next'])}." if z["level"] != "detailed" and z["next"] else ""
            li = ZOOM_LEVELS.index(z["level"])
            parts += [f"> Zoom: {z['level']} ({li} of 3), {z['decisions']} decision{'s' if z['decisions'] != 1 else ''} in this area.{nxt}",
                      f"<!-- od:zoom area={zk} level={li} -->", ""]
        if lead:
            sl = short_line(term_key) if term_key else ""
            parts += [lead + ("\n" + sl if sl else ""), ""]
        detail = [answers_block(zk or ("delivery" if title == "For Agents" else None)), body.strip(), ""]
        detail = [x for x in detail[:1] if x] + ([""] if detail[0] else []) + detail[1:]
        di = dec_ids(title)
        if di:
            detail += [di, ""]
        parts += (["<details><summary>More</summary>", ""] + detail + ["</details>", ""]) if fold and lead else detail
        if after:
            parts += [after, ""]
        if title in keeps:
            parts += [keeps[title], ""]
        return "\n".join(parts)

    # ---- front matter: Google DESIGN.md keys, kept as short as the template (assets/output/DESIGN.md); tokens/ has the rest
    styles = sorted(p for p, t in light.items() if t["type"] == "typography")
    bm = light["text.body.md"]["resolved"]
    bext = (light["text.body.md"].get("$extensions") or {}).get(NS, {})
    bfam = bm["fontFamily"][0] if isinstance(bm["fontFamily"], list) else bm["fontFamily"]
    fm = ["---", "version: alpha", f"name: {json.dumps(state.get('name') or 'Design system')}",
          f"description: {json.dumps(product_words(state) or 'Design system generated by OpenDesigner', ensure_ascii=False)}", "colors:"]
    for k, p in (("primary", "color.bg.action.primary"), ("on-primary", "color.text.on-action"), ("surface", "color.surface.base"),
                 ("on-surface", "color.text.primary"), ("error", "color.bg.danger.bold")):
        if p in light:
            fm.append(f'  {k}: "{H(p)}"')
    fm += ["typography:",
           f"  body-md: {{ fontFamily: {json.dumps(bfam)}, fontSize: {fmt_num(_px(bm['fontSize']))}px, lineHeight: {bext.get('lineHeightPx')}px }}",
           "rounded:", f"  control: {fmt_num(_px(light['radius.control']['resolved']))}px",
           f"  container: {fmt_num(_px(light['radius.container']['resolved']))}px",
           "spacing:", f"  unit: {sinfo['unit']}px", "---", ""]
    dflt = meta["density"][params["space.densityMode"]]
    ctl = dflt["control"]
    ci = meta["color"]
    brand = raw.get("brandColor")
    out = ["\n".join(fm), f"# {state.get('name') or 'Design system'}", "", render_summary(d, state, meta, zoom), "",
           f"> Generated from `{R('state.json')}` and `{R('decisions.md')}`. Made with OpenDesigner {OPENDESIGNER_VERSION}. `{R('tokens/')}` is "
           "the source of truth. "
           "Change the system with `engine.py set ...` and `engine.py build`, not by editing this file (notes inside "
           "`<!-- od:keep -->` blocks survive). Each section opens with one plain sentence; open **More** for the designer and engineer detail.", ""]

    # 1 Overview
    principles = state.get("principles") or []
    pl = "\n".join(f"{i}. {p}" for i, p in enumerate(principles, 1)) if principles else \
        "No principles recorded yet (Q-brand-07). Until they are, the dials act as the tie-breakers below."
    surf = ctx.get("surfaces") or []
    surf_txt = "; ".join((s.get('name', '') + ' (' + s.get('mode', '') + ((': ' + surface_rule(s, params['space.densityMode'])) if surface_rule(s, '') else '') + ')')
                         if isinstance(s, dict) else str(s) for s in surf) or surface_words(state) or "not recorded yet (Q-scope-06)"
    body = [f"**Intent.** {product_words(state) or 'A design system generated from eight dials and a few raw inputs.'}",
            "", f"- Audience: {audience_words(state) or 'not recorded yet (Q-aud-01)'}",
            f"- The memorable thing: {ctx.get('memorable') or answered_label(state, 'Q-brand-02') or 'not recorded yet (Q-brand-02)'}",
            f"- Surfaces: {surf_txt}",
            f"- Platforms: {', '.join(raw.get('platforms') or [])}; inputs: {', '.join(raw.get('inputs') or [])}",
            f"- Direction: {_direction_words(state)}"
            + (f"; feel {', '.join((m if isinstance(m, str) else m['id'] + ' x' + str(m.get('strength', 1))) for m in state['macros'])}" if state.get("macros") else "")
            + ((" (words picked for you: " if (_decisions(d).get("taste.feelWords") or {}).get("set_by") == "delegated" else " (your words: ")
               + f"{', '.join((state.get('taste') or {}).get('feelWords') or [])})" if (state.get("taste") or {}).get("feelWords") else ""),
            "", "**Principles (ranked).**", pl, "", "**Dial positions.** Three posture dials set the overall stance. Five character dials fine-tune it.", ""]
    body += [f"- {dial_words(k, dials[k], params, ci, meta)}" for k in DIALS]
    body += ["", "**Zoom by area** (sketch, broad, defined, detailed). You can stop at any level; each one works.", "",
             _md_table(["Area", "Zoom", "Next questions"], [(t, zoom[k]["level"], ", ".join(zoom[k]["next"]) if zoom[k]["next"] else "-")
                                                           for k, t in ZOOM_AREAS if k != "overview"])]
    body += ["", f"The tokens in `{R('tokens/')}` (DTCG 2025.10 with `opendesigner.resolver.json`) are the source of truth. This file is a generated view."]
    dw = "roomy" if dials["density"] <= 33 else "comfortable" if dials["density"] <= 66 else "compact"
    style = {"flat2": "a flat", "tonal": "a tonal", "glass": "a glass", "neobrutal": "a bold, blocky", "soft": "a soft 3D",
             "maximal": "a loud, busy"}.get(effective_preset(state)[0] or "", "its own")
    named = effective_style(state)
    style = f"the {named['name']} style ({named['plain']})" if named else f"{style} style"
    lead_overview = f"**{state.get('name') or 'This system'} feels {feel_phrase(state, dials)}. Screens are {dw}, in {style}.**"
    t_index = taste_index(d, state)
    sl_card = short_line("Taste card")
    card_md = ("**Taste card.** How it looks and feels, in five lines for you, your team and any AI that builds with it. "
               "Nothing on it is invented: each line says where it comes from." + ("\n" + sl_card if sl_card else "") + "\n\n"
               + _md_table(["Line", "What it says", "From"], taste_card(d, state, meta, light, brand_delegated(d), t_index)))
    follows = (state.get("tasteIndex") or {}).get("follows")
    if follows:  # the person chose a Taste Index (opendesigner-extract taste_index.py use): every agent reads it first
        card_md += (f"\n\n**This system follows the Taste Index `{follows}`, chosen by the person.** Before building any page, component or "
                    f"animation, read `{R('taste-indexes/' + follows + '/TASTE-INDEX.md')}` and use `{R('taste-indexes/' + follows + '/taste.css')}`; "
                    "follow its principles and Never list, and ask before going against one. It keeps the reference's exact colours and font "
                    "names as first presented; keeping or changing them is the person's call and responsibility.")
    out.append(section("Overview", "\n".join(body), lead=lead_overview, term_key="Visual style direction", after=card_md))

    # 2 Colors
    rows = []
    for p in sorted(light):
        if light[p]["type"] == "color" and re.match(r"color\.(surface|text|bg|border|icon|overlay|chart|workflow)\.", p):
            lv, dv = _hex_pair(light, dark, p)
            rows.append((f"`{p}`", lv, dv, light[p]["$description"]))
    nl = [luminance(hx) for hx in meta["ramps"]["neutral"]["light"]["hex"]]
    step_rows = []
    for fg in (8, 9, 10, 11, 12):
        step_rows.append([f"neutral {fg}"] + [f"{contrast_y(nl[fg - 1], nl[bg - 1]):.2f}" for bg in (1, 2, 3, 4, 5)])
    ramp_rows = [(f"`{n}`", " ".join(f"`{h}`" for h in v["light"]["hex"]), v["light"]["textOnSolid"]) for n, v in meta["ramps"].items()]
    st_rows = []
    for base_ in ("color.bg.action.primary", "color.bg.accent.bold"):
        if base_ in light and base_ + ("-hover" if base_.endswith("primary") else "-hover") in light:
            hv = light[base_ + "-hover"]["resolved"]
            pr = light[base_ + "-pressed"]["resolved"]
            st_rows.append((f"`{base_}`", f"`{H(base_)}`", f"`{hex_of(hv)}` ({contrast(hex_of(hv), H(base_)):.2f}:1)",
                            f"`{hex_of(pr)}` ({contrast(hex_of(pr), H(base_)):.2f}:1)"))
    body = [f"**Intent.** {('Brand color `' + brand + '`') if brand else 'No brand color yet: the accent uses a placeholder blue hue'} "
            f"drives the accent ramp's hue; the Colorfulness dial ({dials['colorfulness']}) sets its chroma "
            f"(scheme {ci['scheme']}, peak HCT chroma {ci['peakHct']}). The brand's role is **{params['color.brandRole']}** and it sits "
            f"closest to accent step {ci.get('brandAnchorStep') or '-'}. " + (brand_line(meta, state, delegated=brand_delegated(d)) or ""),
            "", "**How ramps are built.** Each hue gets twelve steps in OKLCH, placed by contrast. Step 8 reaches at least 3:1 (edges and focus). "
            "Steps 10 and 11 reach the text minimum on backgrounds 1-4. Step 12 reaches at least 7:1. Steps 2-6 are spaced evenly in lightness "
            "between step 1 and step 7. Light and dark ramps are solved separately. Dark solids are lighter and carry dark text "
            f"(dark mode is a separate mapping, never an inversion). Text minimum: {ci['textMin']}:1 "
            f"({'WCAG 2.2 AAA' if ci['textMin'] > 4.5 else 'WCAG 2.2 AA'}).",
            "", _md_table(["Ramp", "Light steps 1-12", "Solid carries"], ramp_rows),
            "", "**Step-distance guarantee** (neutral, light; WCAG contrast of a foreground step on background steps 1-5):", "",
            _md_table(["Foreground", "on 1", "on 2", "on 3", "on 4", "on 5"], step_rows),
            "", f"**States.** Hover is at least {STATE_MIN['hover']}:1 from its fill and pressed at least {STATE_MIN['pressed']}:1, "
            + ("as see-through state layers of the text color (Q-color-20 overlay). " if raw.get("stateMethod") == "overlay" else "as shade steps (DC-L01-17). ")
            + "Where a color is unknown at design time, use the state opacities in `opacity.state.*`.",
            "", _md_table(["Fill", "Base", "Hover", "Pressed"], st_rows) if st_rows else "",
            "", "**Semantic roles** (use these, never the ramps):", "", _md_table(["Token", "Light", "Dark", "Use"], rows),
            "", "**Use / avoid.**", "- Use one solid accent fill per view for the primary action; spend chroma on small, meaningful elements.",
            "- Avoid gray text on colored fills; use the matching `text.on-*` role.",
            "- Avoid color as the only signal: pair status colors with an icon or label.",
            ("- Charts: `color.chart.brand` for a chart with one series; `color.chart.categorical.*` in order for groups; "
             "`color.chart.sequential.*` for amounts; `color.chart.diverging.1-7` for values below and above a midpoint (4 is the midpoint); "
             "`color.chart.status.*` for success, warning and danger, always with a label; `color.chart.neutral` for other and baselines. "
             "Axes use `color.chart.axis`, gridlines `color.chart.gridline`, tick labels and legends `color.chart.label`, targets "
             "`color.chart.reference`; other series fade to `opacity.chart.dimmed` while one is hovered. Every mark is at least 3:1 against "
             "the page; marks are not 3:1 against each other, so keep a gap or a line between neighbours (DC-L05-23, DC-L05-24)."
             if raw.get("chartPalette") not in (None, "none") else
             "- Charts: no chart palette yet (Q-color-19). Take chart colors from the status and accent hues, and check them separately.")]
    tw = tailwind_classes(files) if "tailwind" in fmts else {}
    if tw.get("color"):
        body += ["", "**Tailwind classes:** " + ", ".join(f"`{c}`" for c in tw["color"]) + "."]
    out.append(section("Colors", "\n".join(body), lead=colors_lead(meta, state, light, delegated=brand_delegated(d)), term_key="accent color"))

    # 3 Typography
    rows = []
    for p in styles:
        if p.startswith("text.emphasized."):
            continue
        v = light[p]["resolved"]
        ext = (light[p].get("$extensions") or {}).get(NS, {})
        rows.append((f"`{p}`", f"{fmt_num(_px(v['fontSize']))}/{ext.get('lineHeightPx')}", int(v["fontWeight"]),
                     f"{fmt_num(ext.get('letterSpacingEm', 0))}em" + (" caps" if ext.get("textTransform") else ""), ext.get("use", "")))
    fam = light["font.family.text"]["resolved"]
    h_type = (state.get("hooks") or {}).get("H-type", {}).get("status", "pending")
    scripts = tinfo.get("scripts") or {}
    body = [f"**Intent.** Body text is {tinfo['base']}px; sizes follow `round({tinfo['base']} x {tinfo['ratio']}^n)` for n from -2 to "
            f"{tinfo['nTop']}, reaching about {tinfo['reach']}x body ({'marketing surfaces in scope' if raw.get('marketingSurfaces') else 'product surfaces only'}). "
            f"Sizes: {', '.join(str(x) for x in tinfo['sizes'])}px" + (f" (merged as too close: {tinfo['merged']})" if tinfo["merged"] else "") + ".",
            "", f"- Text face: {', '.join(fam) if isinstance(fam, list) else fam}. Licence status (hook H-type): **{h_type}**."
            + (" A system font needs no licence; it must not be embedded in apps." if raw.get("textFace") in (None, "system") else ""),
            "- Licence by platform: " + face_licence_words(tinfo.get("faces") or {}, raw),
            *(["- " + " ".join(x for x in ("On iOS the Swift file uses Dynamic Type text styles (body 17 pt), so text follows the person's "
                                           "text size setting." if "swift" in fmts else "",
                                           "Compose uses sp, which follows the Android font scale." if "compose" in fmts else "") if x)]
              if {"swift", "compose"} & set(fmts) else []),
            f"- Weights: {', '.join(f'{k} {v}' for k, v in tinfo['weights'].items())} (two or three distinct weights per view).",
            (f"- Emphasized variants (Expression {dials['expression']}, on from 67): {len(tinfo.get('emphasized') or [])} styles under "
             "`text.emphasized.*`, the same size one weight heavier, for the selected item, key actions and headlines (DC-L02-11)."
             if tinfo.get("emphasized") else "- Emphasized variants: off (they turn on at Expression 67 and up, DC-L02-11)."),
            f"- Line heights snap to a {2 if raw.get('lineHeightGrid') == 2 else 4}px grid: 1.5 up to 17px, 1.4 to 26px, 1.25 to 44px, 1.12 above.",
            ("- Letter spacing: none beyond the font's own (Q-type-13 zero)." if raw.get("tracking") == "zero"
             else ("- Letter spacing: Apple's SF Pro table by size (Q-type-13 size-table, HIG): +0.006em at 11px, 0 at 12px, -0.026em at 17px, "
                   "+0.014em at 28px, 0 from 80px; uppercase labels at least +0.05em. On Apple devices the system font is SF Pro, and native "
                   "apps get the same values from the OS."
                   if _generic_face(raw.get("textFace")) else
                   "- Letter spacing: Apple's SF Pro table up to 19px (Q-type-13 size-table: 0 at 12px, -0.026em at 17px), then -0.01em from "
                   "32px and -0.02em from 48px. Above 19px Apple's values turn positive to correct SF Pro Display's tighter drawing, which "
                   f"{raw.get('textFace')} does not have, so headings tighten instead (STD-visual-details-05).")
             if sf_tracking_on(state)
             else "- Letter spacing, one value per job (`font.tracking.*`): +0.02em at 11-12px, 0 for body, -0.01em from 32px, "
                  "-0.02em from 48px."),
            "- Capitals never get negative tracking: small capital labels +0.06em, capital headings 0 to +0.02em. Set `font` and "
            f"`letter-spacing` together, or use the `.{prefix}-text-*` classes: the `font` shorthand alone drops tracking.",
            "- Text scaling: CSS sizes are rem, line heights unitless, so text scales to 200% (WCAG 1.4.4); containers must grow with it.",
            "- Scripts: " + (", ".join(f"{k}: line height x{v.get('lineHeightFactor')}" + (", tracking 0" if v.get("zeroTracking") else "")
                                      for k, v in scripts.items()) if scripts else "Latin only; add scripts in raw.scripts to get per-script line heights (DC-L02-25)."),
            *([f"- Display scale (marketing surfaces): its own fluid sizes, " + "; ".join(
                f"`text.{k}` {v['min']}px on a phone to {v['max']}px at {lay.get('container', 1280)}px" for k, v in tinfo["fluid"].items())
               + ". The hero takes at most two lines; section titles use `text.display.md`."] if tinfo.get("fluid") else []),
            *([f"- Per page: at most {lim['sizes']['max']} sizes, {lim['weights']['max']} weights ({', '.join(str(x) for x in lim['weights']['values'])}) "
               f"and {lim['families']['max']} families, whole px only (`limits` in `tokens/opendesigner.meta.json`)."] if lim else []),
            "", _md_table(["Style", "Size/line (px)", "Weight", "Tracking", "Use"], rows),
            "", "**Use / avoid.**", "- Use at most three sizes and two weights in one view; let color and weight carry hierarchy before size.",
            "- Avoid all caps for sentences and in scripts without case; use weight for emphasis there."]
    if tw.get("type"):
        body += ["", "**Tailwind classes:** " + ", ".join(f"`{c}`" for c in tw["type"]) + "."]
    out.append(section("Typography", "\n".join(body), lead=f"**Body text is {tinfo['base']}px, and each larger size is about {tinfo['ratio']} times the one below.**", term_key="type scale"))

    # 4 Layout
    drows = []
    for dn, info in meta["density"].items():
        drows.append((dn + (" (default)" if dn == params["space.densityMode"] else ""),
                      " / ".join(str(info["inset"][k]) for k in ("xs", "sm", "md", "lg", "xl")),
                      " / ".join(str(info["section"][k]) for k in ("sm", "md", "lg")),
                      " / ".join(str(info["control"][k]) for k in ("sm", "md", "lg")),
                      " / ".join(str(info["row"][k]) for k in ("sm", "md", "lg", "two-line")) if info.get("row") else "-", info["ratio"]))
    body = [f"**Intent.** Everything sits on a {sinfo['unit']}px unit: ladder {', '.join(str(x) for x in sinfo['ladder'])}. "
            f"Density is a mode on the semantic layer (default **{params['space.densityMode']}**). Primitives and minimum tap areas never change.",
            "", _md_table(["Density", "inset xs/sm/md/lg/xl", "section sm/md/lg", "control sm/md/lg", "row sm/md/lg/two-line", "outer:inner"], drows),
            "", "- Target sizes: " + ", ".join(f"{k} {v}px" for k, v in sinfo["targets"].items())
            + f"; `size.target.min` is the floor for the primary input, and `space.target.gap` separates adjacent targets.",
            "- Inner gaps stay below outer gaps (at least half), so grouping reads without borders (L15 P16).",
            *([f"- One container for the whole site: `layout.container.max` ({lay['container']}px). Columns {lay['columns']['compact']} / "
               f"{lay['columns']['medium']} / {lay['columns']['expanded']} (`layout.columns.*`), gutters {lay['gutter']['compact']} / "
               f"{lay['gutter']['expanded']}px, margins {lay['margin']['compact']} / {lay['margin']['expanded']}px; paragraphs at most "
               f"{lay['measure']['prose']}ch (`layout.measure.prose`), leads {lay['measure']['lead']}ch (DC-L03-15, DC-L03-16, DC-L02-17).",
               f"- Alignment: {lay['alignment']}"] if lay else
              ["- Breakpoints and grid: not generated yet; use the platform defaults and keep layout spacing independent of density (DC-L03-17)."]),
            "", "**Use / avoid.**", "- Parents own spacing (padding and gap); children never set outer margins.",
            "- Avoid values off the ladder; if one is needed, add it as a decision."]
    out.append(section("Layout", "\n".join(body), lead=f"**Spacing comes in steps of {sinfo['unit']}px, and screens use {params['space.densityMode']} spacing by default.**", term_key="spacing scale"))

    # 5 Elevation & Depth
    rows = []
    for p in ("elevation.raised", "elevation.floating", "elevation.overlay", "elevation.pressed"):
        if p in light:
            layers = light[p]["resolved"]
            layers = layers if isinstance(layers, list) else [layers]
            flat_l = []
            for lay in layers:
                flat_l += lay if isinstance(lay, list) else [lay]
            txt = ", ".join(("inset " if l.get("inset") else "")
                            + f"{fmt_num(_px(l['offsetX']))} {fmt_num(_px(l['offsetY']))} {fmt_num(_px(l['blur']))} {fmt_num(_px(l['spread']))}"
                            for l in flat_l if _px(l["blur"]) or _px(l["offsetX"]) or _px(l["offsetY"]) or _px(l["spread"])) or "none"
            rows.append((f"`{p}`", txt, light[p]["$description"]))
    look = meta.get("look") or {}
    built = look.get("elevationModel") and el["model"] == look["elevationModel"]
    bd = shp.get("borderDefault", 1)
    body = [(f"**Intent.** The {_direction_words(state).split(' (')[0].replace('style ', '')} look builds the **{el['model']}** model. " if built else
             f"**Intent.** Depth {dials['depth']}/100 selects the **{el['model']}** model. ")
            + ("Offset shadows are solid, in the text color, so dark mode uses the light text color."
               if el["model"] == "offset" else f"Shadow alpha in light mode is {el['alpha']}; dark mode doubles it and lifts surfaces "
                                                "by lightness instead (sunken, base, raised, overlay)."),
            "", _md_table(["Token", "Layers (x y blur spread)", "Use"], rows),
            "", ("- Borders: 1px default, 2px selected and focus, 4px emphasis; width changes use an inset shadow so layout does not jump."
                 if bd == 1 else f"- Borders: {bd}px default, the thick outlines of the style, drawn in `color.text.primary`; 4px selected and emphasis. Solid outlines go against "
                                 "house standard STD-visual-details-14 (a should), kept because the style asks for them. Keep the focus ring "
                                 "(`color.border.focus`, 2px offset) visibly different from the outline."),
            "- Stacking: page < raised < floating (menus) < overlay (dialogs with `color.overlay.scrim`).",
            "- " + ("Glass is for controls and navigation only, with `color.surface.glass-fallback` under Reduce Transparency and more "
                    "contrast (the CSS swaps it in, with no blur). Only `color.text.primary` and `color.icon.default` go on glass; both are "
                    "checked over black and white content behind it (STD-visual-details-13)." if el["model"] == "materials"
                    else "No materials or glass in this system.")]
    if el["model"] == "offset":
        body.append("- Press: move the element 2px down and right (`transform: translate(2px, 2px)`) and switch to `elevation.pressed`.")
    if el["model"] in ("extruded", "clay", "glow"):
        body.append(f"- The {'glow is' if el['model'] == 'glow' else 'soft shadows are'} not an edge: every control keeps a 3:1 border (`color.border.input`), and pressed or selected "
                    "needs a second signal besides `elevation.pressed`, such as a fill change (S-L15-060, DC-L19-67).")
    if look.get("gradient"):
        body.append("- Gradients: `gradient.brand` (one hue, blended in OKLab)" + (" and `gradient.mesh` (radial layers over "
                    "`color.surface.base`)" if look["gradient"] == "mesh" else "") + " for brand moments: heroes, marketing and "
                    "illustration. Never on buttons, fields, status or data colors; text on a gradient meets 4.5:1 at its lowest-contrast "
                    "point (DC-L01-25, DC-L19-12).")
    if look.get("texture") in TEXTURES:
        tx = look["texture"]
        body.append(f"- {tx.title()}: the `.{prefix}-{tx}` class draws a static {TEXTURES[tx][1].split(': ')[1]} at `texture.{tx}.opacity` "
                    "behind content on brand surfaces, never over body text or controls, and switches off under more contrast and "
                    "forced colors. Textures are image assets, not tokens (DC-L19-12).")
    lead_depth = DEPTH_LEADS.get(el["model"], "")
    out.append(section("Elevation & Depth", "\n".join(body), lead=lead_depth, term_key="Depth model"))

    # 6 Shapes
    continuous_corner = levers()["formulas"]["radius"]["continuous"]  # Q-shape-04 squircle-enhance on the web (tools/fit_corner.py)
    body = [f"**Intent.** Roundness {dials['roundness']}/100 gives controls a **{shp['control']}** radius; details {shp['detail']}px, containers "
            f"{shp['container']}px, overlays {shp['overlay']}px, people full. Controls under 32px tall use `radius.control-sm` ({shp['control-sm'] if shp['control-sm'] < FULL else 'full'}).",
            (f"Buttons are **{shp['ctaShape']}**" + (" (your choice)." if shp.get("chosen") else
                                                      "; square and pill corners are a choice (Q-shape-01), never a default.")) if shp.get("ctaShape") else "",
            "", "- One corner per kind of thing: " + "; ".join(f"`radius.{k}` for {v}" for k, v in levers()["formulas"]["radius"]["roles"].items()
                                                              if k != "rule") + ".",
            f"- Nested radius: inner = max(outer - padding, smallest step). Here it is {shp['nested']}px inside a container with `space.inset.lg` "
            "padding. Equal radii on nested shapes look uneven (DC-L04-05).",
            f"- Focus ring: {shp['focusWidth']}px, 2px offset, radius = control radius + offset ({shp['focusRadius'] if shp['focusRadius'] < FULL else 'full'}).",
            f"- Icons: {shp['iconCorners']} corners, {shp['iconCaps']} caps.",
            "- Corners (Q-shape-04, DC-L04-04): the radii are the same everywhere; iOS draws them continuous "
            f"(`{prefix.upper()}.Radius.shape(...)`, `.continuous`), Android circular (`RoundedCornerShape`), "
            + ({"squircle-enhance": f"the web continuous where the browser supports `corner-shape` (`superellipse({continuous_corner['superellipse']})` at "
                                    f"{continuous_corner['radiusScale']} times the radius, which follows Apple's curve; set `--{prefix}-corner-radius` and add the class "
                                    f"`{prefix}-corners` or Tailwind `corners`; a circular arc elsewhere), and Figma with corner smoothing 0.6.",
                "continuous": "the web circular (`border-radius`), and Figma with corner smoothing 0.6 (the iOS preset)."}
               .get(shp.get("cornerShape"), "the web and Figma circular.")),
            "- Signature shapes: none generated; a brand shape library is a designer asset (hook H-motif)."]
    out.append(section("Shapes", "\n".join(body), lead=shapes_lead(shp), term_key="corner radius"))

    # 7 Components
    inv = (state.get("components") or {}).get("inventory") or []
    notes = (state.get("components") or {}).get("notes") or {}
    rows = [(c, notes.get(c, "planned (tokens ready)")) for c in inv]
    ans = {k: answer_value(v) for k, v in (state.get("answers") or {}).items()}
    pol = [("Validation timing and disabled submit", "Q-form-02"), ("Field style", "Q-form-01"), ("Toasts", "Q-form-04"),
           ("Undo versus confirm", "Q-form-05"), ("Danger actions", "Q-state-06"), ("Button emphasis levels", "Q-state-01")]
    pol = [(k, answer_words(q, ans[q]) if q in ans else None) for k, q in pol]  # U5 F27: each policy reads its own question
    base_c = (state.get("components") or {}).get("base")
    base_c = (answer_words("Q-comp-01", base_c) if base_c else None) or "not chosen yet (Q-comp-01)"
    body = [f"**Intent.** v1 components use the semantic tokens only. Base: {base_c}. "
            f"Buttons are {ctl['md']}px tall ({params['space.densityMode']}), {shp['control']} radius, `text.label.lg`; one primary action per view."
            + (f" Calls to action on marketing pages: `size.control.cta` ({ctl.get('cta', 48)}px), `{lim['cta']['labelStyle']}` in sentence case, "
               "one filled per view; the others outline or text." if lim.get("cta") else ""),
            "", _md_table(["Component", "Status"], rows) if rows else "No inventory recorded.",
            "", "**Contested policies:** " + "; ".join(f"{k}: {v if v is not None else 'pending'}" for k, v in pol) + ".",
            *([""] + table_rules(state, prefix) if "table" in inv or "Q-pattern-07" in ans else []),
            "", "**Use / avoid.**", "- Every interactive component shows hover, pressed, focus-visible and disabled states from the tokens.",
            f"- Inputs keep a 3:1 boundary (`color.border.input`); signifier strength: {params['signifier.minStrength']}.",
            "- Component docs belong in `opendesigner/components/<name>.md` (spec 7.8)."]
    out.append(section("Components", "\n".join(body), lead=f"**Version 1 plans {len(inv)} components, all built from these tokens.**", term_key="Component inventory scope"))

    # 8 Do's and Don'ts
    vr = Report()
    validate_files(files, state, vr)
    warns = [i for i in vr.items if i["severity"] in ("error", "warn")]
    nevers = taste_nevers(d, state, t_index)
    body = ["**Enforced by construction.** The generator cannot break these:",
            f"- text contrast {ci['textMin']}:1, and 3:1 for edges, in every mode",
            "- text on colored fills picked automatically",
            "- tap areas " + ", ".join(f"{k} {v}px" for k, v in sinfo["targets"].items()),
            "- a 2px focus ring with a 2px offset",
            "- a reduced-motion mode",
            "- inner spacing smaller than outer spacing, three text colors, and nested radii",
            "", "**Do**", "- Use semantic tokens; never raw hex, px or ms values in components.",
            "- Keep one primary action per view and at most three type sizes per view.",
            "- Pair every status color with an icon or label; underline links in running text.",
            "", "**Don't**", "- Don't shrink hit areas in dense layouts; shrink visuals and extend the hit area.",
            "- Don't use motion as the only signal, or flash more than three times a second.",
            ("- Don't add a reference's logo, brand name, imagery or copy. The exact colours and font names of the Taste Index you chose "
             "to follow are yours to keep or change (your call and responsibility); font files are never shipped."
             if (state.get("tasteIndex") or {}).get("follows") else
             "- Don't copy another brand's identity from a reference (colors, typeface, logo, imagery, copy)."),
            *(["", "**Never** (the person's taste, from the taste card; `engine.py review` flags red lines, and nothing here fails a "
               "build). Ask before going against one:"] + [f"- {w} ({src})" for w, src in nevers] if nevers else []),
            "", "**Current validation findings:** " + (", ".join(f"{i['severity']}: {i['message']}" for i in warns) if warns else "none (errors 0, warnings 0)."),
            "", "**Waivers:** " + ("; ".join(f"{k}: {v}" for k, v in (state.get("waivers") or {}).items()) or "none.")]
    out.append(section("Do's and Don'ts", "\n".join(body), lead="**These rules keep screens clear and easy to read.** The engine checks the ones it can.", term_key="Guardrails and validation"))

    # 8b Standards (docs/KNOWLEDGE.md 3): rules from sources marked non-negotiable; no section while there are none
    std_body = std_design_md(state, md_path=R(STD_MD_FILE))
    if std_body:
        out.append(section("Standards", std_body, lead=std_design_md_lead(state), fold=False))

    # 9 Motion: values from the resolved tokens, so an override (the person's or a standard's) shows, not the lever's value
    def _res_ms(path):
        return token_ms(light, path)

    def _ease(k):
        t = (light.get(f"motion.easing.{k}") or {}).get("resolved")
        return t if isinstance(t, list) else mot[k]
    order = list(mot["durations"])
    dpaths = sorted((p_ for p_ in light if p_.startswith("motion.duration.") and light[p_]["type"] == "duration"),
                    key=lambda p_: (order.index(p_[16:]) if p_[16:] in order else len(order), p_))
    durs = {p_[16:]: _res_ms(p_) for p_ in dpaths}
    durs = {k: (v if v is not None else mot["durations"].get(k)) for k, v in durs.items()}
    for k, v in mot["durations"].items():
        durs.setdefault(k, v)
    ease = {k: _ease(k) for k in ("standard", "enter", "exit")}
    held = std_held(state) if std_has_records(state) else {}
    ovr = state.get("overrides") or {}
    r10 = lambda v: int(round(v / 10) * 10)

    def _who(k):
        sid = held.get(f"overrides.motion.duration.{k}")
        return f"set by {'project' if sid.startswith('PRJ-') else 'house'} standard {sid}" if sid else \
            ("your value" if f"motion.duration.{k}" in ovr else "")

    def _note(k):
        if k == "extra":
            return "illustrative and marketing motion only, never UI (STD-easing-duration-06)"
        if k.endswith("-exit") and k[:-5] in durs:
            want = r10(durs[k[:-5]] * 0.8)
            return (f"derived: about 0.8 x {k[:-5]}" if durs[k] == want else f"set directly ({_who(k) or 'your value'}); "
                    f"0.8 x {k[:-5]} would be {want}ms")
        return _who(k)
    rows = [(f"`motion.duration.{k}`", f"{v}ms", _note(k)) for k, v in durs.items()]
    steps = ("medium", "long", "extra")
    moved = [k for k in steps if f"motion.duration.{k}" not in ovr]
    fixed = [k for k in steps if k not in moved]
    fixers = {"standards" if held.get(f"overrides.motion.duration.{k}") else "your own values" for k in fixed}
    mult_words = (f"the duration multiplier x{mot['multiplier']:.2f} scales the {', '.join(moved)} step{'s' if len(moved) != 1 else ''}"
                  + (f" ({' and '.join(sorted(fixers))} fix {', '.join(fixed)})" if fixed else "")) if moved else \
        f"the duration multiplier would be x{mot['multiplier']:.2f}, but {' and '.join(sorted(fixers))} fix every step it scales (medium, long and extra)"
    exits = [k for k in ("medium-exit", "long-exit") if k in durs]
    sp = light.get("motion.spring.spatial.default")
    spx = (sp.get("$extensions") or {}).get(NS, {}) if sp else {}
    cb = lambda v: css_bezier(v) if isinstance(v, list) else str(v)
    body = [f"**Intent.** Energy {dials['energy']}/100: {mult_words}. Standard easing `{cb(ease['standard'])}`, enter `{cb(ease['enter'])}`, "
            f"exit `{cb(ease['exit'])}`. Spatial spring: damping {mot['spatial']['dampingRatio']}, stiffness {mot['spatial']['stiffness']} "
            f"(Apple duration {spx.get('apple', {}).get('duration')}s, bounce {spx.get('apple', {}).get('bounce')}; web `linear()` sample over "
            f"{spx.get('css', {}).get('durationMs')}ms)." + (" Motion is off (flags.motionOff): standard equals reduced." if mot.get("motionOff") else ""),
            "", _md_table(["Token", "Value", "Note"], rows),
            "", "- Exits are derived, not set on their own: each is about 20% shorter than the entrance in force ("
            + ", ".join(f"{k} {durs[k]}ms from {k[:-5]} {durs[k[:-5]]}ms" for k in exits if k[:-5] in durs)
            + "; STD-easing-duration-11). Change an entrance and its exit follows. Linear easing only for spinners and progress.",
            "- Reduced motion (`prefers-reduced-motion` or `data-motion=\"reduced\"`): travel becomes opacity, feedback stays, `motion.transition.move` is 0ms.",
            "- Springs are stored as damping and stiffness in `$extensions.opendesigner.spring` because DTCG 2025.10 has no spring type.",
            f"- Haptics: {params['haptics.intensity']} intensity where the platform has them; sound: hook H-sound is "
            f"{(state.get('hooks') or {}).get('H-sound', {}).get('status', 'pending')}."]
    out.append(section("Motion", "\n".join(body), lead=motion_lead(mot, durs["medium"]), term_key="Motion"))

    # 10 Modes and Themes
    rows = [(n, ", ".join(m["contexts"]), m.get("default")) for n, m in mods.items()]
    body = [f"**Intent.** Modes live in the DTCG resolver (`{R('tokens/opendesigner.resolver.json')}`); modifiers are orthogonal, so no two set the same token.",
            "", _md_table(["Modifier", "Contexts", "Default"], rows) if rows else "Single theme.",
            "", f"- Web: `prefers-color-scheme` with a `[data-theme]` override; `[data-density]`; `prefers-reduced-motion` with `[data-motion]`" + (f" (see `{R('build/css/tokens.css')}`)." if "css" in fmts else "."),
            "- High-contrast themes are not generated; set `raw.contrastTarget` to AAA for 7:1 text everywhere.",
            "- A second brand or a client re-skin may override the color primitives and `color.bg.brand`; semantic names never change."]
    out.append(section("Modes and Themes", "\n".join(body), lead=f"**The system has {'light and dark' if has_dark else 'one'} color {'modes' if has_dark else 'mode'}, three spacing densities and a reduced-motion mode.**", term_key="Modes and theming axes"))

    # 11 Iconography and Imagery
    hooks = state.get("hooks") or {}
    hs = lambda h: hooks.get(h, {}).get("status", "pending")
    st = sinfo.get("iconStroke", {})
    body = [f"**Intent.** Default icon size {sinfo['iconDefault']}px; sizes 16/20/24 pair with 14/16/20px text. Stroke follows the label weight: "
            f"{st.get(16, st.get('16'))}px at 16, {st.get(20, st.get('20'))}px at 20, {st.get(24, st.get('24'))}px at 24. Rest style: {params['icon.restStyle']}.",
            "", _md_table(["Asset", "Hook", "Status"], [("Logo and marks", "H-logo", hs("H-logo")), ("Favicon set", "H-favicon", hs("H-favicon")),
                                                       ("App icon", "H-appicon", hs("H-appicon")), ("Custom icons", "H-icons", hs("H-icons")),
                                                       ("Illustration", "H-illus", hs("H-illus")), ("Photography", "H-photo", hs("H-photo")),
                                                       ("Motifs and brand shapes", "H-motif", hs("H-motif"))]),
            "", "- Placeholders are labelled as placeholders. A generated stand-in is never shown as a finished brand asset.",
            "- Icon-only buttons need an accessible name and a hit area of `size.target.min`."]
    out.append(section("Iconography and Imagery", "\n".join(body), lead=f"**Icons are {sinfo['iconDefault']}px by default.** The logo, photos and custom icons come from a person, not from the engine.", term_key="Iconography"))

    # 12 Content and Voice
    vstat = hs("H-voice")
    body = [f"**Intent.** {'Draft: ' if vstat not in ('have',) else ''}voice guidance level **{params['content.voiceGuidance']}** "
            f"(Brand presence {dials['brandPresence']}); **{params['content.capitalization']}**; contractions **{params['content.contractions']}** "
            f"(Warmth {dials['warmth']}). Voice guide hook H-voice: {vstat}.",
            "", "- Buttons say what they do in two to four words; errors say what happened and how to fix it.",
            "- Reading level: plain language; avoid jargon in UI copy.",
            "- Word list: not recorded yet (Q-voice-03)."]
    out.append(section("Content and Voice", "\n".join(body), lead="**Words stay plain and short, and every button says what it does.**", term_key="Content and voice"))

    # 13 Accessibility
    body = [f"**Intent.** Standard: WCAG 2.2 {'AAA for text' if ci['textMin'] > 4.5 else 'AA'}. APCA is reported as advice only.",
            "", "**The system guarantees:**", "- text and edge contrast in every mode", "- visible focus (2px ring, 2px offset, 3:1)",
            "- minimum target sizes for each kind of input", "- a reduced-motion mode", "- rem-based type, so text scales to 200%",
            "- text on colored fills chosen automatically",
            "", "**Product teams own:** accessible names and labels, alt text, reading and focus order, and never using color alone. "
            "Also: clear error messages, dialogs that can be closed, no pre-checked consent boxes, and captions for media.",
            "", "**Test on each platform:**", "- keyboard only", "- a screen reader (VoiceOver, NVDA or TalkBack)", "- 200% zoom",
            "- forced colors (Windows High Contrast)", "- reduced motion", "- touch on a phone, for every surface that allows touch"]
    out.append(section("Accessibility", "\n".join(body), lead=f"**Text passes WCAG 2.2 {'AAA' if ci['textMin'] > 4.5 else 'AA'} contrast in every mode, and focus is always visible.**", term_key="Accessibility"))

    # 14 Platforms and Devices
    body = [f"**Intent.** Platforms: {', '.join(raw.get('platforms') or [])}. Inputs: {', '.join(raw.get('inputs') or [])}. "
            f"Brand presence {dials['brandPresence']}: each platform keeps its own shapes and materials: "
            f"{'yes' if params['platform.overridesShapeAndMaterial'] else 'no'}; each platform keeps its own body text size: "
            f"{'yes' if params['platform.useNativeBaseSize'] else 'no'}.",
            "", "- Navigation, back, sheets and pickers stay native on every platform (DC-L10-02).",
            f"- Code files in `{R('build/')}`: {', '.join(f for f in fmts if f in FORMAT_FILES)}"
            + (" (each uses the same token names, and Figma code syntax matches them)" if len([f for f in fmts if f in FORMAT_FILES]) > 1 else "")
            + (f". Not written for these platforms: {', '.join(f for f in EXPORT_FORMATS if f in FORMAT_FILES and f not in fmts)} "
               "(`engine.py export --format <name>` writes one)." if any(f in FORMAT_FILES and f not in fmts for f in EXPORT_FORMATS) else "."),
            "- Fonts by platform: " + face_licence_words(tinfo.get("faces") or {}, raw)]
    out.append(section("Platforms and Devices", "\n".join(body), lead=f"**It runs on {', '.join(raw.get('platforms') or ['web'])}, and each platform keeps its own navigation.**", term_key="Target platforms"))

    # 15 Decisions
    rows, more = decision_table_rows(d)
    body = [f"Your own decisions first (the newest value per path), then your changes to standards, then one row per standards "
            f"batch. Full log: [{R('decisions.md')}]({R('decisions.md')}).", "",
            _md_table(["Id", "Path", "Value", "Set by", "Reason"], rows) if rows else "No decisions recorded yet."]
    if more:
        body += ["", f"{more} more in the full log."]
    n_dec = len({x for x, _p in _decision_entries(d)}) or len(decs)  # unique decision ids, not paths (R07)
    out.append(section("Decisions", "\n".join(body), lead=f"**{n_dec} decision{'s' if n_dec != 1 else ''} so far.** Each one says who set it and why.", term_key="decisions.md"))

    # 16 Open Items
    pend = [f"{v.get('name', h)} ({h}): {v.get('status')}" for h, v in hooks.items() if v.get("status") in ("pending", "placeholder", "commissioning")]
    assumed = [f"{k} ({v['set_by']})" for k, v in decs.items() if v["set_by"] in ("assumed", "delegated", "auto_default")]
    sketchy = [t for k, t in ZOOM_AREAS if k != "overview" and zoom[k]["level"] == "sketch"]
    body = ["- Still defaults (zoom 0, sketch): " + (", ".join(sketchy) if sketchy else "none."),
            "- Assets not final: " + ("; ".join(pend) if pend else "none."),
            "- Answers taken on assumption or delegated: " + (", ".join(assumed) if assumed else "none."),
            "- Waivers: " + ("; ".join(f"{k}: {v}" for k, v in (state.get("waivers") or {}).items()) or "none."),
            "- Licence risks: " + (" ".join(licence_risks(state, meta)) or "none found."),
            f"- Validation: {vr.count('error')} errors, {vr.count('warning')} warnings."]
    out.append(section("Open Items", "\n".join(body), lead="**These parts are still defaults, guesses, or waiting for a person.**", fold=False))

    # 17 For Agents
    body = [f"1. Before any visual work, read this file, PRODUCT.md and `{R('tokens/')}` (start at `{R('tokens/opendesigner.resolver.json')}`).",
            "2. Use tokens, never raw values" + (": " + ", ".join(x for f, x in (
                ("css", f"CSS `var(--{prefix}-...)`"), ("tailwind", f"Tailwind classes from `{R('build/tailwind/theme.css')}`"),
                ("swift", f"`{prefix.upper()}.*` in Swift")) if f in fmts) if {"css", "tailwind", "swift"} & set(fmts) else "") + "."
            + (f" In Compose: colors from `Local{prefix.capitalize()}Colors.current` (provide `{prefix.capitalize()}LightColors` or "
               f"`{prefix.capitalize()}DarkColors`), then `{prefix.capitalize()}Space`, `{prefix.capitalize()}Type` and `{prefix.capitalize()}Motion`."
               if "compose" in fmts else ""),
            "3. Do not change a locked decision without asking the owner. Keep new screens inside the taste card at the top of "
            "the Overview, and never add anything on its Never list without asking.",
            "4. To change the system: `engine.py set <path> <value> --why \"...\"`, then `engine.py generate`, `engine.py validate`, `engine.py design-md`.",
            "5. To extend: add a decision (never hand-edit tokens or this file). Keep semantic names the same across modes. Deprecate instead of deleting.",
            "6. After any implementation, run `engine.py review` and re-read this file."]
    if std_body:
        body.append("7. Follow the Standards section. Change a standard only when the person explicitly asks: "
                    "`engine.py standard override <id> --why \"<their words>\"`.")
    if tw:
        body += ["", "**Tailwind v4 classes** (one import: `@import \"tailwindcss\"; @import \"<path>/opendesigner/build/tailwind/theme.css\";`"
                 + ("; Tailwind's default colors, text sizes, radii and shadows are switched off, so only these exist" if (state.get("exports") or {}).get("tailwindReset", True) else "")
                 + "):", "", _md_table(["Area", "Classes"], [(k.title(), ", ".join(f"`{c}`" for c in v)) for k, v in tw.items() if v])]
    out.append(section("For Agents", "\n".join(body), lead="**AI agents: read this file and the tokens before you change any screen.**", fold=False))
    return "\n".join(out).rstrip() + "\n"


NOT_ENOUGH = "Not enough information"


def project_phase(state):
    """The project's phase (Q-scope-07): idea, building, near-launch or live; None while nobody said and nothing showed it."""
    v = answer_value((state.get("answers") or {}).get("Q-scope-07"))
    return v if v in PHASES else None


def _ctx_words(v):
    if isinstance(v, list):
        return "; ".join(str(x).strip() for x in v if str(x).strip())
    return str(v or "").strip()


def _unconfirmed(decs, path):
    """' (assumed, not confirmed yet)' when the latest decision for path was taken from their words or files, not given."""
    return " *(assumed, not confirmed yet)*" if ((decs or {}).get(path) or {}).get("set_by") in ("assumed", "delegated") else ""


def purpose_md(state, decs=None):
    """PRODUCT.md, Purpose and goals: the alignment record (owner direction 2026-11-02, row 3). Each line comes from the
    person's words or README; what nobody said reads 'Not enough information', never a guess."""
    ctx = state.get("context") or {}
    rows = [("Mission", "context.mission", "the change it exists to make"), ("Vision", "context.vision", "where it is heading"),
            ("Purpose", "context.purpose", "what the person is trying to do with it")]
    lines = []
    for t, path, hint in rows:
        v = _ctx_words(ctx.get(path.split(".")[1]))
        lines.append(f"- **{t}** ({hint}): " + (f"{v.rstrip('.')}.{_unconfirmed(decs, path)}" if v else f"{NOT_ENOUGH}."))
    goals = ctx.get("goals") or []
    goals = [goals] if isinstance(goals, str) else goals
    goals = [str(g).strip() for g in goals if str(g).strip()]
    if goals:
        lines.append(f"- **Goals**, most important first:{_unconfirmed(decs, 'context.goals')}")
        lines += [f"  {i}. {g}" for i, g in enumerate(goals, 1)]
    else:
        lines.append(f"- **Goals**: {NOT_ENOUGH}.")
    if not any(_ctx_words(ctx.get(k)) for k in ("mission", "vision", "purpose", "goals")):
        lines.append("\nNothing here is invented: these come from the person's own words and README, are recorded as assumed, "
                     "and are confirmed once. The principles are drafted from the goals (Q-brand-07).")
    return "\n".join(lines)


def phase_md(state, decs=None):
    ph = project_phase(state)
    if not ph:
        return f"{NOT_ENOUGH} (Q-scope-07): an idea, being built, close to launch, or live with real users."
    reason = re.sub(r";\s*say if that's wrong\s*$", "", ((decs or {}).get("answers.Q-scope-07") or {}).get("reason") or "")
    head = f"**{answer_words('Q-scope-07', ph)}**" + (f" ({reason})" if reason else "") + "."
    return head + _unconfirmed(decs, "answers.Q-scope-07") + f"\n\nWhat comes first in this phase: {PHASE_FIRST[ph]}."


def market_md(state, decs=None):
    """PRODUCT.md, Market: the analogous product, competitors, their shared pattern, the gap and the industry's conventions.
    A line recorded in context.market (their words, or an assumption to confirm) comes first, then what the user research
    found (research.py market_summary, with its sources); 'Not enough information' where nobody has looked yet."""
    mk = (state.get("context") or {}).get("market") or {}
    found = ((state.get("research") or {}).get("market") or {}) if (state.get("research") or {}).get("status") == "done" else {}
    rows = [("Analogous product", "analogous", "a product from another field that solves the same kind of problem"),
            ("Competitors", "competitors", "what people would use instead"),
            ("Their shared pattern", "pattern", "what the competitors all do"),
            ("The gap", "gap", "what none of them does well, and this product can"),
            ("Industry conventions", "conventions", "the words, layouts and habits its users already know")]
    lines = []
    for t, k, hint in rows:
        v = _ctx_words(mk.get(k))
        r = _ctx_words(found.get(k))
        lines.append(f"- **{t}** ({hint}): " + (f"{v.rstrip('.')}.{_unconfirmed(decs, 'context.market.' + k)}" if v else
                                                 f"{r.rstrip('.')}. *(from the user research: opendesigner/research/users.md)*" if r else
                                                 f"{NOT_ENOUGH}."))
    return "\n".join(lines)


def positioning_md(state):
    """PRODUCT.md, Positioning: the four lines the person confirmed and the direction they picked (research.md sections 8 and 9).
    A draft is not shown: only the person's yes makes it a positioning."""
    r = research_py.summary(state) if research_py else {}
    p, dr = r.get("positioning") or {}, r.get("direction") or {}
    lines = ([f"Confirmed {p['confirmed']}.", ""] + [f"- {x}" for x in research_py.positioning_lines(p)]) if p.get("confirmed") else []
    if dr.get("id"):
        lines += ["", f"Direction {dr['id']}, {dr.get('name')} (chosen {dr.get('date')}): `opendesigner/{research_py.BOARD}`."]
    return "\n".join(lines).strip() or f"{NOT_ENOUGH}. The positioning step fills this in: engine.py research positioning draft."


def table_rules(state, prefix="ds"):
    """DESIGN.md, Components: the data table rules from Q-pattern-07 (row separation, header, numbers) and the row heights."""
    raw = state.get("raw") or {}
    rows, head, nums = raw.get("tableRows") or "lines", raw.get("tableHeader") or "sticky", raw.get("tableNumbers") or "right"
    asked = "Q-pattern-07" in (state.get("answers") or {})
    lines = ["**Tables**" + ("" if asked else " (defaults; Q-pattern-07 changes them)") + ":"]
    lines.append({"lines": "- Rows: a 1px `color.border.subtle` line between rows, none around the table (Carbon's default).",
                  "zebra": "- Rows: every other row on `color.surface.row-alternate`, no lines between rows. Hover and selection keep "
                           "their own fills, so the stripes are never the only cue (DC-L19-43).",
                  "space": "- Rows: space between rows, no lines and no stripes; for short lists, not for wide data tables (DC-L19-43)."}
                 .get(rows, f"- Rows: {rows}."))
    lines.append("- Row heights: `size.row.sm` (dense), `size.row.md` (default), `size.row.lg` (roomy) and `size.row.two-line`; the header "
                 "row matches the body rows (Carbon, S-L08-092).")
    lines.append("- Header: stays in view while the rows scroll (`position: sticky`), with a scroll-edge fade where rows pass under it, "
                 "never a 1px line (STD-visual-details-15)." if head == "sticky" else
                 "- Header: scrolls away with the rows; keep tables short enough to read without it.")
    lines.append("- Numbers: right-aligned in `text.numeric.*` (tabular digits), and their column headers right-aligned too, so digits line "
                 "up and compare at a glance (DC-L19-121, DC-L02-26)." if nums == "right" else
                 "- Numbers: left-aligned like text, in `text.numeric.*`; only for IDs and codes people read, not amounts they compare.")
    lines.append("- Text, status chips, row checkboxes and targets follow the same tokens as the rest of the system; a chip carries a word, "
                 "never color alone (WCAG 1.4.1).")
    return lines


# The site brief (issue 48): what a site that persuades must do, for whom, with what proof, how it is found, and its page
# families. Asked at zoom 1, only for such a site (questions.json "when": "persuade"). Each line is the person's answer,
# a reading from their repo marked assumed, or "Not enough information" with the question that fills it. Proof is never drafted.
SITE_BRIEF = [("Q-site-01", "Goal", "what the site must achieve, and how it is counted"),
              ("Q-site-02", "Roles to convince", "and what each needs to see"),
              ("Q-site-03", "Proof we can show", "only what the person gave"),
              ("Q-site-04", "How people find it", "channels, languages and the questions it answers"),
              ("Q-site-05", "Page families", "the kinds of pages, each with one layout")]
SITE_DISCOVERY_KEYS = ("channels", "languages", "questions")


def site_surface(state):
    """True when a surface persuades: Q-scope-06 names a Persuade surface, or Q-scope-01 puts a marketing site in scope."""
    ans = state.get("answers") or {}
    if any(x["mode"] == "Persuade" for x in surface_list(answer_value(ans.get("Q-scope-06")))):
        return True
    scope = answer_value(ans.get("Q-scope-01"))
    return "marketing" in (scope if isinstance(scope, list) else [scope])


def _texts(v):
    return isinstance(v, list) and all(isinstance(x, str) for x in v)


def site_problem(qid, v):
    """Why a site-brief answer has the wrong shape, or None. Free words are always fine; lists keep one item per row."""
    rows = v if isinstance(v, list) else [v]
    if qid == "Q-site-01":
        ok = (isinstance(v, str) and v.strip()) or (isinstance(v, dict) and set(v) <= {"goal", "measure"} and v.get("goal")
                                                     and all(isinstance(x, str) for x in v.values()))
        return None if ok else 'Q-site-01 takes the goal in their words, or {"goal": "demos", "measure": "ten a month from heads of operations"}.'
    if qid == "Q-site-02":
        ok = all((isinstance(r, str) and r.strip()) or (isinstance(r, dict) and isinstance(r.get("role"), str) and r["role"].strip()
                                                         and set(r) <= {"role", "needs"} and isinstance(r.get("needs", ""), str))
                 for r in rows) and rows
        return None if ok else 'Q-site-02 takes a list of roles: [{"role": "operations head", "needs": "the outcome in numbers"}, ...].'
    if qid == "Q-site-03":
        ok = all((isinstance(r, str) and r.strip()) or (isinstance(r, dict) and isinstance(r.get("what"), str) and r["what"].strip()
                                                         and set(r) <= {"kind", "what", "qualifier"}
                                                         and all(isinstance(x, str) for x in r.values()))
                 for r in rows) and rows
        return None if ok else ('Q-site-03 takes the proof in their words: [{"kind": "figures", "what": "40% fewer missed shipments", '
                                '"qualifier": "one client, six months, against the year before"}, ...], or none-yet.')
    if qid == "Q-site-04":
        ok = _texts(v) or (isinstance(v, dict) and v and set(v) <= set(SITE_DISCOVERY_KEYS) and all(_texts(x) for x in v.values()))
        return None if ok else 'Q-site-04 takes {"channels": ["search", "generative"], "languages": ["en", "de"], "questions": ["..."]}.'
    if qid == "Q-site-05":
        return None if (_texts(rows) and rows and all(x.strip() for x in rows)) else 'Q-site-05 takes a list of page families, for example ["platform", "company", "legal"].'
    return None


def _proof_line(r):
    if isinstance(r, str):
        return "Nothing to show yet: pages leave proof sections out." if r == "none-yet" else r
    what, q = r.get("what", "").strip(), (r.get("qualifier") or "").strip()
    figure = r.get("kind") == "figures" or re.search(r"\d", what)
    return what + (f" ({q})" if q else " *(no qualifier yet: for whom, over what time, compared with what)*" if figure else "")


def site_brief_lines(state, decs=None):
    """[(qid, label, hint, [lines] or None)] for the site brief. None means nobody answered and nothing fills it."""
    ans = state.get("answers") or {}
    out = []
    for qid, label, hint in SITE_BRIEF:
        v = answer_value(ans.get(qid)) if qid in ans else None
        lines = None
        if qid == "Q-site-01" and v:
            if isinstance(v, dict):
                lines = [(option_label(qid, v["goal"]) or v["goal"]) + (f"; counted as {v['measure']}" if v.get("measure") else "")]
            else:
                lines = [option_label(qid, v) or v]
        elif qid == "Q-site-02" and v:
            rows = v if isinstance(v, list) else [v]
            lines = [(f"{r['role']}: {r['needs']}" if r.get("needs") else r["role"]) if isinstance(r, dict) else option_label(qid, r) or r
                     for r in rows]
        elif qid == "Q-site-03":
            if v:
                lines = [_proof_line(r) for r in (v if isinstance(v, list) else [v])]
            else:
                r = research_py.summary(state) if research_py else {}
                p = r.get("positioning") or {}
                proof = [str(x).strip() for x in p.get("proof") or [] if str(x).strip()] if p.get("confirmed") else []
                lines = [f"{x} *(from the confirmed positioning)*" for x in proof] or None
        elif qid == "Q-site-04" and v:
            v = {"channels": v} if isinstance(v, list) else v
            lines = []
            if v.get("channels"):
                lines.append("Channels: " + ", ".join(option_label(qid, x) or x for x in v["channels"]))
            if v.get("languages"):
                lines.append("Languages: " + ", ".join(v["languages"]))
            lines += [f"Answers: {x}" for x in v.get("questions") or []]
        elif qid == "Q-site-05" and v:
            lines = [", ".join(option_label(qid, x) or x for x in (v if isinstance(v, list) else [v]))]
        out.append((qid, label, hint, lines))
    return out


def site_brief_md(state, decs=None):
    """PRODUCT.md, Site brief: one line per question, its rows below it."""
    out = []
    for qid, label, hint, lines in site_brief_lines(state, decs):
        mark = _unconfirmed(decs, f"answers.{qid}") if qid in (state.get("answers") or {}) else ""
        if not lines:
            out.append(f"- **{label}** ({hint}): {NOT_ENOUGH} ({qid})."
                       + (" Pages leave proof sections out until then." if qid == "Q-site-03" else ""))
        elif len(lines) == 1:
            out.append(f"- **{label}** ({hint}): {lines[0].rstrip('.')}.{mark}")
        else:
            out.append(f"- **{label}** ({hint}):{mark}")
            out += [f"  - {x}" for x in lines]
    return "\n".join(out)


def render_product_md(state, existing="", decs=None):
    ctx = state.get("context") or {}
    keeps = _keep_blocks(existing)
    raw = state["raw"]

    def sec(t, body):
        parts = [f"## {t}", "", body.strip(), ""]
        if t in keeps:
            parts += [keeps[t], ""]
        return "\n".join(parts)
    surf = ctx.get("surfaces") or []
    sc = ctx.get("scope") or {}
    out = [f"# {state.get('name') or 'Product'}: product truth", "",
           "> Generated by the OpenDesigner engine from `state.json`. It is kept apart from DESIGN.md because it changes at a different pace. "
           "Hand-written notes survive only inside `<!-- od:keep -->` blocks.", ""]
    out.append(sec("Product", product_words(state) or "Not recorded yet (Q-scope-01)."))
    out.append(sec("Purpose and goals", purpose_md(state, decs)))
    out.append(sec("Phase", phase_md(state, decs)))
    aw = audience_words(state)
    out.append(sec("Audience", (aw[:1].upper() + aw[1:] + ("" if aw.endswith(".") else ".")) if aw else "Not recorded yet (Q-aud-01)."))
    if research_py:
        out.append(sec("Users", research_py._users_section(research_py.summary(state))))
    out.append(sec("Market", market_md(state, decs)))
    out.append(sec("Positioning", positioning_md(state)))
    if site_surface(state) or any(q in (state.get("answers") or {}) for q, _l, _h in SITE_BRIEF):
        out.append(sec("Site brief", site_brief_md(state, decs)))
    out.append(sec("Surfaces", "\n".join(f"- {s.get('name')}: {s.get('mode')} mode" + (f" ({surface_rule(s, 'set by the Density dial')})" if surface_rule(s, "") else "")
                                         if isinstance(s, dict) else f"- {s}" for s in surf)
                   or surface_words(state)
                   or "Not recorded yet (Q-scope-06). Each surface gets a mode: Persuade, Operate, Read or Experience."))
    out.append(sec("Memorable Thing", ctx.get("memorable") or answered_label(state, "Q-brand-02") or "Not recorded yet (Q-brand-02)."))
    pr = state.get("principles") or []
    out.append(sec("Principles", ("\n".join(f"{i}. {p}" for i, p in enumerate(pr, 1)) + "\n\nTie-break: the higher-ranked principle wins.")
                   if pr else "Not recorded yet (Q-brand-07)."))
    cons = [f"Accessibility: WCAG 2.2 {raw.get('contrastTarget', 'AA')}", f"Platforms: {', '.join(raw.get('platforms') or [])}"]
    cons += ctx.get("constraints") or []
    out.append(sec("Constraints", "\n".join(f"- {c}" for c in cons)))
    out.append(sec("Scope", "**In:** " + (", ".join(sc.get("in") or []) or "not recorded yet") + "\n\n**Out:** " + (", ".join(sc.get("out") or []) or "not recorded yet")))
    owner = [(qid, rec) for qid, rec in sorted((state.get("answers") or {}).items())
             if ANSWER_RECORDS.get(qid) == "owner" and qid not in ("Q-brand-07", "Q-comp-01", "Q-comp-02", "Q-scope-07")
             and not qid.startswith("Q-site-")]  # the site brief has its own section
    first_sentence = lambda q: re.split(r"(?<=[?.])\s", (questions().get(q) or {}).get("ask") or q)[0]
    lines = [f"- {first_sentence(q)} **{answer_words(q, answer_value(r))}** ({q})" for q, r in owner]
    out.append(sec("Team and Governance", "\n".join(x for x in [ctx.get("team") or ""] + lines if x) or "Not recorded yet (Q-scope-03, Q-scope-04, Q-gov-01)."))
    return "\n".join(out).rstrip() + "\n"


def _sha(text):
    import hashlib
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def doc_dir(d):
    return os.path.dirname(os.path.abspath(d)) if os.path.basename(os.path.abspath(d)) == DEFAULT_DIR else d


def refresh_docs(d):
    """DESIGN.md is a living document (BRIEF req. 15): once it exists, every decision re-renders it and PRODUCT.md."""
    if os.path.exists(os.path.join(doc_dir(d), "DESIGN.md")):
        cmd_design_md(d, quiet=True)
        print("  DESIGN.md and PRODUCT.md updated (tokens update on the next `generate`)")


def cmd_design_md(d, out_dir=None, files=None, meta=None, quiet=False):
    state = merge_defaults(load_state(d))
    if files is None:
        files, meta, _ = generate_system(load_state(d))
    if out_dir is None:  # spec 7.1: project root when the state lives in ./opendesigner/, else next to the state
        out_dir = os.path.dirname(os.path.abspath(d)) if os.path.basename(os.path.abspath(d)) == DEFAULT_DIR else d
    written = []
    hashes = state.setdefault("hashes", {})
    for name, render in (("DESIGN.md", lambda ex: render_design_md(d, files, meta, state, ex, out_dir=out_dir)),
                         ("PRODUCT.md", lambda ex: render_product_md(state, ex, _decisions(d)))):
        path = os.path.join(out_dir, name)
        existing = ""
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                existing = f.read()
            if hashes.get(name) and _sha(existing) != hashes[name]:
                stripped_old = re.sub(r"<!-- od:keep -->.*?<!-- /od:keep -->", "", existing, flags=re.S)
                if not quiet:
                    print(f"note: {name} was edited outside od:keep blocks; the previous text is saved as {name}.hand-edited "
                          "so the extend skill can turn the edits into decisions")
                write_text(path + ".hand-edited", stripped_old)
        text = render(existing)
        write_text(path, text)
        hashes[name] = _sha(text)
        written.append(path)
    full = std_full_md(state)
    std_path = os.path.join(d, STD_MD_FILE)
    if full:
        write_text(std_path, f"# Standards this system follows\n\n<!-- generated by engine.py design-md from opendesigner/state.json; "
                             f"change a standard with engine.py standard ..., not here -->\n\n{std_design_md_lead(state)}\n\n{full}\n")
        written.append(std_path)
    elif os.path.exists(std_path):
        os.remove(std_path)
    raw_state = load_state(d)
    raw_state["hashes"] = hashes
    dump_json(os.path.join(d, "state.json"), raw_state)
    if not quiet:
        for p in written:
            print(f"wrote {p}")
    return written


# =============================================================================================
# Preview: one self-contained HTML specimen (every token, a few components, light and dark side by side)
# =============================================================================================

def _esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def preview_kind(state):
    """Which sample screen fits the person's main surface (U5 F11): persuade (a club or product site), operate (an admin
    table), finance (a money dashboard) or read (a guide)."""
    ctx = state.get("context") or {}
    raw = state.get("raw") or {}
    mode = ""
    surf = ctx.get("surfaces") or []
    if surf and isinstance(surf[0], dict):
        mode = str(surf[0].get("mode", "")).lower()
    elif (state.get("answers") or {}).get("Q-scope-06"):
        items = surface_list(answer_value(state["answers"]["Q-scope-06"]))
        mode = items[0]["mode"].lower() if items else ""
    if not mode:
        mode = {"marketing": "persuade", "content": "read"}.get(raw.get("productType") or "", "operate")
    words = f"{ctx.get('product') or ''} {state.get('summary') or ''} {state.get('name') or ''}".lower()
    if mode in ("persuade", "experience"):
        return "persuade"
    if mode == "read":
        return "read"
    if re.search(r"financ|money|budget|bank|invoic|payment|ledger|expense|wallet|net worth", words):
        return "finance"
    return "operate"


def logo_src(state, preview_dir):
    """The person's logo file for the preview header, relative to preview.html, when one was recorded and exists."""
    for f in ((state.get("hooks") or {}).get("H-logo") or {}).get("files") or []:
        for path in (f if os.path.isabs(f) else os.path.join(os.path.dirname(os.path.abspath(preview_dir)), f),
                     os.path.join(os.path.abspath(preview_dir), f)):
            if os.path.exists(path):
                return os.path.relpath(path, os.path.abspath(preview_dir))
    return None


def render_preview(files, meta, state, preview_dir="."):

    prefix = slug(meta.get("prefix") or "ds").replace("-", "")
    css = export_css(files, meta, prefix)
    V = lambda path: f"var({css_var(prefix, path)})"
    VV = lambda path, suffix: f"var({css_var(prefix, path)}-{suffix})"
    res = files["opendesigner.resolver.json"]
    mods = res.get("modifiers", {})
    themes = list(mods["theme"]["contexts"]) if "theme" in mods else meta["modes"]
    base = resolve_all(files, {})
    dials = meta["dials"]
    name = _esc(state.get("name") or "Design system")
    tinfo, sinfo, shp, mot = meta["type"], meta["space"], meta["shape"], meta["motion"]
    t = lambda p: f"font: var({css_var(prefix, p)}); letter-spacing: var({css_var(prefix, p)}-tracking);"
    label = "text.label.lg" if "text.label.lg" in base else "text.body.md"
    ui_css = f"""
*,*::before,*::after{{box-sizing:border-box}}
body{{margin:0;background:#f4f4f5;color:#18181b;font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-wrap:break-word}}
.pv-wrap{{max-width:1240px;margin:0 auto;padding:24px 20px 64px}}
.pv-h1{{font-size:22px;font-weight:650;margin:0 0 4px}} .pv-sub{{color:#52525b;margin:0 0 14px}}
.pv-chips{{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 18px}}
.pv-chip{{background:#fff;border:1px solid #e4e4e7;border-radius:999px;padding:3px 10px;font-size:12px;color:#3f3f46}}
.pv-chip b{{font-weight:600;color:#18181b}}
.pv-h2{{font-size:15px;font-weight:650;margin:34px 0 10px;padding-top:14px;border-top:1px solid #e4e4e7}}
.pv-note{{color:#63636c;font-size:12px;margin:0 0 10px}}
.pv-grid2{{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(360px,100%),1fr));gap:16px}} .pv-grid2>*{{min-width:0}}
.pv-scroll{{max-width:100%;overflow-x:auto}} .pv-theme pre{{max-width:100%;overflow-x:auto}} .pv-theme img{{max-width:100%;object-fit:contain}} .pv-card svg{{max-width:100%;height:auto}}
.pv-mono{{font:11px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace}}
.pv-theme{{background:{V('color.surface.base')};color:{V('color.text.primary')};border-radius:14px;padding:18px;border:1px solid {V('color.border.subtle')}}}
.pv-theme-label{{{t('text.label.sm') if 'text.label.sm' in base else ''}color:{V('color.text.secondary')};margin:0 0 12px}}
.pv-row{{display:flex;flex-wrap:wrap;gap:{V('space.stack.sm')};align-items:center;margin:0 0 {V('space.stack.lg')}}}
.ds-btn{{{t(label)}height:{V('size.control.md')};min-width:{V('size.control.md')};padding:0 {V('space.inset.lg')};border-radius:{V('radius.control')};
  border:1px solid transparent;cursor:pointer;display:inline-flex;align-items:center;gap:{V('space.inline.xs')};
  transition:background-color {VV('motion.transition.feedback', 'duration')} {VV('motion.transition.feedback', 'easing')}}}
.ds-btn.primary{{background:{V('color.bg.action.primary')};color:{V('color.text.on-action')}}}
.ds-btn.primary:hover,.ds-btn.primary.is-hover{{background:{V('color.bg.action.primary-hover')}}}
.ds-btn.primary:active,.ds-btn.primary.is-pressed{{background:{V('color.bg.action.primary-pressed')}}}
.ds-btn.secondary{{background:{V('color.bg.neutral.subtle')};color:{V('color.text.primary')}}}
.ds-btn.secondary:hover,.ds-btn.secondary.is-hover{{background:{V('color.bg.neutral.subtle-hover')}}}
.ds-btn.outline{{background:transparent;color:{V('color.text.primary')};border-color:{V('color.border.default')}}}
.ds-btn.danger{{background:{V('color.bg.danger.bold')};color:{V('color.text.on-danger')}}}
.ds-btn.is-focus,.ds-btn:focus-visible,.ds-input:focus-visible{{outline:{V('focus.ring.width')} solid {V('color.border.focus')};outline-offset:{V('focus.ring.offset')}}}
.ds-btn[disabled]{{background:{V('color.bg.disabled')};color:{V('color.text.disabled')};cursor:not-allowed;border-color:transparent}}
.ds-field{{display:flex;flex-direction:column;gap:{V('space.stack.xs')};min-width:200px;flex:1}}
.ds-label{{{t('text.label.md') if 'text.label.md' in base else ''}color:{V('color.text.secondary')}}}
.ds-input{{{t('text.body.md')}height:{V('size.control.md')};padding:0 {V('space.inset.md')};border-radius:{V('radius.control')};
  border:1px solid {V('color.border.input')};background:{V('color.surface.raised')};color:{V('color.text.primary')}}}
.ds-input::placeholder{{color:{V('color.text.tertiary')}}}
.ds-input.is-error{{border-color:{V('color.border.danger')}}}
.ds-input[disabled]{{background:{V('color.bg.disabled')};color:{V('color.text.disabled')};border-color:{V('color.border.subtle')}}}
.ds-help{{{t('text.body.sm')}color:{V('color.text.tertiary')}}} .ds-help.err{{color:{V('color.text.danger')}}}
.ds-card{{background:{V('color.surface.raised')};border:{V('border.width.default')} solid {V('color.text.primary' if (meta.get('shape') or {}).get('borderDefault', 1) > 1 else 'color.border.subtle')};border-radius:{V('radius.container')};
  padding:{V('space.inset.xl')};box-shadow:{V('elevation.raised')};display:flex;flex-direction:column;gap:{V('space.stack.sm')}}}
.ds-card h3{{margin:0;{t('text.title.md') if 'text.title.md' in base else t('text.title.sm')}}}
.ds-card p{{margin:0;{t('text.body.md')}color:{V('color.text.secondary')}}}
.ds-badge{{{t('text.label.md') if 'text.label.md' in base else ''}padding:2px {V('space.inset.sm')};border-radius:{V('radius.detail')}}}
.ds-banner{{{t('text.body.md')}padding:{V('space.inset.md')} {V('space.inset.lg')};border-radius:{V('radius.control')};flex:1;min-width:150px}}
.ds-link{{color:{V('color.text.link')};text-decoration:underline;text-underline-offset:2px}}
.ds-table{{width:100%;border-collapse:collapse;{t('text.body.md')}}}
.ds-table th{{text-align:left;{t('text.label.md') if 'text.label.md' in base else ''}color:{V('color.text.secondary')};padding:{V('space.inset.sm')} {V('space.inset.md')};border-bottom:1px solid {V('color.border.default')}}}
.ds-table td{{padding:{V('space.inset.sm')} {V('space.inset.md')};border-bottom:1px solid {V('color.border.subtle')};height:{V('size.control.md')}}}
.pv-details{{margin:0 0 18px}} .pv-details summary{{cursor:pointer;color:#52525b;font-size:12px;margin:0 0 8px}}
.sw-ramp{{display:grid;grid-template-columns:90px repeat(12,minmax(0,1fr));gap:3px;margin:0 0 3px;align-items:stretch}}
.sw{{height:38px;min-width:0;overflow:hidden;border-radius:4px;display:flex;align-items:flex-end;padding:2px 3px;font:9px/1 ui-monospace,Menlo,monospace}}
@media (max-width:600px){{.sw-ramp{{grid-template-columns:repeat(12,minmax(0,1fr))}} .sw-name{{grid-column:1/-1;margin-top:6px}}}}
.sw-name{{font-size:12px;color:#3f3f46;align-self:center}}
.role-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px}}
.role{{display:flex;gap:8px;align-items:center;font:11px/1.25 ui-monospace,Menlo,monospace;color:{V('color.text.secondary')}}}
.role{{min-width:0}} .role span{{min-width:0;overflow-wrap:anywhere}}
.role i{{width:28px;height:28px;border-radius:6px;flex:none;border:1px solid {V('color.border.subtle')}}}
.pv-spec{{display:flex;flex-wrap:wrap;gap:2px 16px;align-items:baseline;margin:0 0 8px}}
.pv-spec .pv-mono{{width:170px;flex:none}} .pv-spec>span:last-child{{flex:1 1 220px;min-width:0;overflow-wrap:anywhere}}
.ruler{{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap}}
.ruler div{{background:#6366f1;opacity:.85;border-radius:2px}}
.pv-card{{background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:16px}}
.motion-box{{width:36px;height:36px;border-radius:8px;background:{V('color.bg.action.primary')}}}
.motion-lane{{position:relative;height:44px;background:#f4f4f5;border-radius:8px;margin:0 0 8px;container-type:inline-size}}
.motion-lane .motion-box{{position:absolute;left:4px;top:4px}}
.pv-card:hover .motion-box.m-std{{transform:translateX(min(420px,calc(100cqw - 44px)));transition:transform {V('motion.duration.medium')} {V('motion.easing.standard')}}}
.pv-card:hover .motion-box.m-spring{{transform:translateX(min(420px,calc(100cqw - 44px)));transition:transform {VV('motion.transition.move', 'duration')} {VV('motion.transition.move', 'easing')}}}
.motion-box{{transition:transform {V('motion.duration.medium-exit')} {V('motion.easing.exit')}}}
@media (prefers-reduced-motion: reduce){{.pv-card:hover .motion-box{{transform:none}}}}
"""
    chips = "".join(f'<span class="pv-chip">{_esc(k)} <b>{v}</b></span>' for k, v in dials.items())
    chips += f'<span class="pv-chip">body <b>{tinfo["base"]}px x {tinfo["ratio"]}</b></span>'
    chips += f'<span class="pv-chip">unit <b>{sinfo["unit"]}px</b></span>'
    chips += f'<span class="pv-chip">radius <b>{shp["control"]}</b></span>'
    chips += f'<span class="pv-chip">depth <b>{_esc(meta["elevation"]["model"])}</b></span>'
    if state.get("raw", {}).get("brandColor"):
        chips += f'<span class="pv-chip">brand <b>{_esc(state["raw"]["brandColor"])}</b></span>'
    kind = preview_kind(state)
    head = "headline.sm" if "text.headline.sm" in base else ("title.lg" if "text.title.lg" in base else "title.md")
    big = "headline.lg" if "text.headline.lg" in base else head
    logo = logo_src(state, preview_dir)
    num = "text.numeric.md" if "text.numeric.md" in base else "text.body.md"
    num_lg = "text.numeric.lg" if "text.numeric.lg" in base else ("text." + head)
    raw_name = state.get("name") or "Your product"
    what = product_words(state)
    clubby = bool(re.search(r"\b(club|team|school|community|society|group|league|class)\b", (what + " " + raw_name).lower()))
    lead_style = t("text.body.lg") if "text.body.lg" in base else t("text.body.md")

    def badge(kind_, text):
        return f'<span class="ds-badge" style="background:{V(f"color.bg.{kind_}.subtle")};color:{V(f"color.text.{kind_}")}">{_esc(text)}</span>'

    def components(theme):
        brandbar = (f'<img src="{_esc(logo)}" alt="{name} logo" style="height:32px;width:auto">' if logo else
                    f'<span style="{t("text.label.lg") if "text.label.lg" in base else ""}color:{V("color.text.primary")}">{name}</span>')
        nav = (f'<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;margin:0 0 20px;padding:0 0 12px;'
               f'border-bottom:1px solid {V("color.border.subtle")}">{brandbar}<a class="ds-link" href="#">'
               f'{"Settings" if kind in ("operate", "finance") else "Contact"}</a></div>')
        if kind == "persuade":
            tag = _esc(what) if what else f"Everything {name} does, in one place."
            cta, cta2 = ("Join us", "See what we do") if clubby else ("Get started", "See how it works")
            cards = (("Meet the team", "Who we are and what we build."), ("What we do", "Projects, builds and competitions."),
                     ("Upcoming events", "Next meet-up: Friday after school.")) if clubby else \
                    (("Quick to start", "Set up in minutes, no training needed."), ("Made for you", "Every screen fits how you work."),
                     ("Help when you need it", "Real people answer within a day."))
            body = (f'<div style="{t("text." + big)}margin:0 0 8px">{name}</div>'
                    f'<p style="{lead_style}color:{V("color.text.secondary")};margin:0 0 18px;max-width:52ch">{tag}</p>'
                    f'<div class="pv-row"><button class="ds-btn primary">{cta}</button><button class="ds-btn outline">{cta2}</button></div>'
                    '<div class="pv-row" style="align-items:stretch">'
                    + "".join(f'<div class="ds-card" style="flex:1;min-width:160px"><h3>{_esc(a)}</h3><p>{_esc(b_)}</p></div>' for a, b_ in cards)
                    + "</div>"
                    f'<div class="pv-row" style="align-items:flex-end"><label class="ds-field"><span class="ds-label">Your email</span>'
                    f'<input class="ds-input" placeholder="you@example.com"><span class="ds-help">We only use it to reply.</span></label>'
                    f'<button class="ds-btn primary">{"Sign up" if clubby else "Request access"}</button></div>')
        elif kind == "finance":
            rows_ = (("12 Sep", "Grocer", "Food", "-54.20", "success"), ("11 Sep", "Salary", "Income", "+3,200.00", "success"),
                     ("10 Sep", "Power bill", "Bills", "-88.15", "warning"), ("09 Sep", "Card refund", "Refund", "+19.99", "info"))
            trs = "".join(f'<tr><td>{a}</td><td>{b_}</td><td>{badge(k_, c_)}</td><td style="text-align:right;{t(num)}">{d_}</td></tr>'
                          for a, b_, c_, d_, k_ in rows_)
            body = (f'<div style="{t("text." + head)}margin:0 0 12px">Overview</div>'
                    '<div class="pv-row" style="align-items:stretch">'
                    + "".join(f'<div class="ds-card" style="flex:1;min-width:150px"><p>{a}</p><div style="{t(num_lg)}color:{V("color.text.primary")}">{b_}</div></div>'
                              for a, b_ in (("Balance", "$12,480.20"), ("Spent this month", "$2,140.75"), ("Bills due", "3")))
                    + "</div>"
                    f'<div class="pv-row" style="justify-content:space-between"><span style="{t("text.title.md") if "text.title.md" in base else ""}">Transactions</span>'
                    '<button class="ds-btn primary">Add transaction</button></div>'
                    f'<div class="pv-scroll"><table class="ds-table"><thead><tr><th>Date</th><th>Payee</th><th>Category</th><th style="text-align:right">Amount</th></tr></thead><tbody>{trs}</tbody></table></div>')
        elif kind == "read":
            body = (f'<div style="{t("text." + big)}margin:0 0 8px">Getting started with {name}</div>'
                    f'<p style="{lead_style}color:{V("color.text.primary")};max-width:60ch">'
                    'This guide takes about five minutes. Each step shows what to do and what you will see. '
                    '<a class="ds-link" href="#">Skip to the examples</a>.</p>'
                    f'<div class="ds-banner" style="background:{V("color.bg.info.subtle")};color:{V("color.text.info")};margin:0 0 12px">Tip: you can come back to any step later.</div>'
                    f'<pre style="{t("text.code.md")}background:{V("color.surface.sunken")};padding:{V("space.inset.md")};border-radius:{V("radius.container")};margin:0 0 12px">npm install {_esc(slug(raw_name))}</pre>'
                    '<div class="pv-row"><button class="ds-btn primary">Next step</button><button class="ds-btn secondary">Back</button></div>')
        else:
            people = (("Asha Rao", "Admin", "Active", "success"), ("Ben Ortiz", "Editor", "Invited", "info"),
                      ("Chen Wei", "Viewer", "Suspended", "danger"), ("Dana Kim", "Editor", "Active", "success"))
            trs = "".join(f'<tr><td>{a}</td><td>{b_}</td><td>{badge(k_, c_)}</td><td style="text-align:right"><a class="ds-link" href="#">Edit</a></td></tr>'
                          for a, b_, c_, k_ in people)
            body = (f'<div class="pv-row" style="justify-content:space-between"><span style="{t("text." + head)}">Users</span>'
                    '<span style="display:flex;flex-wrap:wrap;gap:8px"><input class="ds-input" placeholder="Search users" style="max-width:200px">'
                    '<button class="ds-btn primary">Add user</button></span></div>'
                    f'<div class="pv-scroll"><table class="ds-table"><thead><tr><th>Name</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>{trs}</tbody></table></div>'
                    '<div class="pv-row" style="align-items:flex-start;margin-top:16px">'
                    '<label class="ds-field"><span class="ds-label">Email</span><input class="ds-input" placeholder="name@example.com"><span class="ds-help">Used to sign in.</span></label>'
                    '<label class="ds-field"><span class="ds-label">Team</span><input class="ds-input is-error" value="Ops Team!"><span class="ds-help err">Use letters, numbers and dashes.</span></label>'
                    '<label class="ds-field"><span class="ds-label">Plan</span><input class="ds-input" value="Team" disabled><span class="ds-help">Set by your admin.</span></label></div>')
        states = ('<p class="pv-theme-label" style="margin-top:20px">Button states</p>'
                  '<div class="pv-row"><button class="ds-btn primary">Default</button><button class="ds-btn primary is-hover">Hover</button>'
                  '<button class="ds-btn primary is-pressed">Pressed</button><button class="ds-btn primary is-focus">Focus</button>'
                  '<button class="ds-btn primary" disabled>Disabled</button><button class="ds-btn secondary">Secondary</button>'
                  '<button class="ds-btn danger">Delete</button></div>')
        return f'<div class="pv-theme" data-theme="{theme}"><p class="pv-theme-label">{theme} theme</p>{nav}{body}{states}</div>'
    html = [f"<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
            f"<title>{name} preview</title><style>\n{css}\n{ui_css}</style></head><body><div class=\"pv-wrap\">",
            f"<h1 class=\"pv-h1\">{name}</h1><p class=\"pv-sub\">{_esc((product_words(state) or 'Your design system').rstrip('. '))}. "
            f"Sample screens use only your tokens; the words are examples.</p>",
            f"<details class=\"pv-details\"><summary>Details: the settings behind this</summary><div class=\"pv-chips\">{chips}</div></details>",
            "<div class=\"pv-grid2\">" + "".join(components(th) for th in themes) + "</div>"]
    # color ramps
    html.append("<h2 class=\"pv-h2\">Color ramps</h2><p class=\"pv-note\">Primitives, 12 contrast-indexed OKLCH steps per hue; light and dark are separate ramps.</p>")
    for mode in ("light", "dark"):
        html.append(f"<div class=\"pv-card\" style=\"margin:0 0 10px;{'background:#0c0c0e;border-color:#27272a' if mode == 'dark' else ''}\">")
        for rname, rv in meta["ramps"].items():
            cells = []
            for i, hx in enumerate(rv[mode]["hex"], 1):
                fg = "#000" if contrast(hx, "#000000") > contrast(hx, "#ffffff") else "#fff"
                cells.append(f'<div class="sw" style="background:{hx};color:{fg}" title="{rname} {mode} {i} {hx}">{i}</div>')
            html.append(f'<div class="sw-ramp"><span class="sw-name" style="color:{"#d4d4d8" if mode == "dark" else "#3f3f46"}">{rname} {mode}</span>{"".join(cells)}</div>')
        html.append("</div>")
    # semantic roles per theme
    html.append("<h2 class=\"pv-h2\">Semantic color roles</h2><div class=\"pv-grid2\">")
    for th in themes:
        flat = resolve_all(files, {"theme": th} if "theme" in mods else {})
        items = []
        for p in sorted(flat):
            if flat[p]["type"] == "color" and re.match(r"color\.(surface|text|bg|border|icon)\.", p):
                items.append(f'<div class="role"><i style="background:{V(p)}"></i><span>{_esc(p[6:])}<br>{hex_of(flat[p]["resolved"])}</span></div>')
        html.append(f'<div class="pv-theme" data-theme="{th}"><p class="pv-theme-label">{th}</p><div class="role-grid">{"".join(items)}</div></div>')
    html.append("</div>")
    # typography
    html.append("<h2 class=\"pv-h2\">Typography</h2>")
    html.append(f"<p class=\"pv-note\">round({tinfo['base']} x {tinfo['ratio']}^n): {', '.join(str(x) for x in tinfo['sizes'])}px. "
                f"Weights {', '.join(f'{k} {v}' for k, v in tinfo['weights'].items())}.</p><div class=\"pv-theme\" data-theme=\"light\">")
    for p in sorted((p for p in base if base[p]["type"] == "typography"), key=lambda p: -_px(base[p]["resolved"]["fontSize"])):
        ext = (base[p].get("$extensions") or {}).get(NS, {})
        v = base[p]["resolved"]
        caps = "text-transform:uppercase;" if ext.get("textTransform") else ""
        html.append(f'<div class="pv-spec"><span class="pv-mono" style="color:{V("color.text.tertiary")}">'
                    f'{p[5:]} {fmt_num(_px(v["fontSize"]))}/{ext.get("lineHeightPx")} {int(v["fontWeight"])}</span>'
                    f'<span style="{t(p)}{caps}">{_esc(ext.get("use", "The quick brown fox"))}</span></div>')
    html.append("</div>")
    # spacing, density, radius
    ladder = sinfo["ladder"]
    html.append("<h2 class=\"pv-h2\">Space, density, radius and targets</h2><div class=\"pv-grid2\"><div class=\"pv-card\"><p class=\"pv-note\">Spacing ladder</p><div class=\"ruler\">")
    for v in ladder:
        if v:
            html.append(f'<div style="width:{v}px;height:{v}px" title="space.{v}"></div>')
    html.append("</div><p class=\"pv-mono\" style=\"margin:8px 0 0\">" + " ".join(str(v) for v in ladder) + "</p></div><div class=\"pv-card\"><p class=\"pv-note\">Density modes (same component)</p>")
    for dn in DENSITIES:
        html.append(f'<div data-density="{dn}" data-theme="light" style="display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;margin:0 0 8px"><span class="pv-mono" style="width:90px">{dn}</span>'
                    f'<button class="ds-btn primary">Save</button><input class="ds-input" style="max-width:160px" placeholder="Search"></div>')
    html.append("</div><div class=\"pv-card\"><p class=\"pv-note\">Radius roles</p><div style=\"display:flex;gap:12px;flex-wrap:wrap\">")
    for r in ("detail", "control-sm", "control", "container", "overlay", "full"):
        html.append(f'<div style="text-align:center"><div style="width:64px;height:48px;background:#e0e7ff;border:1.5px solid #6366f1;border-radius:{V("radius." + r)}"></div><span class="pv-mono">{r}</span></div>')
    html.append("</div></div><div class=\"pv-card\"><p class=\"pv-note\">Hit-area floors (L14 I-1)</p><div style=\"display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end\">")
    for k, v in sinfo["targets"].items():
        html.append(f'<div style="text-align:center"><div style="width:{v}px;height:{v}px;border:1.5px dashed #6366f1;border-radius:6px"></div><span class="pv-mono">{k} {v}</span></div>')
    html.append("</div></div></div>")
    # elevation
    html.append("<h2 class=\"pv-h2\">Elevation</h2><div class=\"pv-grid2\">")
    for th in themes:
        boxes = "".join(f'<div style="flex:1;min-width:100px;height:80px;border-radius:{V("radius.container")};background:{V("color.surface." + ("raised" if e == "raised" else "overlay"))};'
                        f'box-shadow:{V("elevation." + e)};border:1px solid {V("color.border.subtle")};display:flex;align-items:center;justify-content:center"><span class="pv-mono">{e}</span></div>'
                        for e in ("raised", "floating", "overlay"))
        html.append(f'<div class="pv-theme" data-theme="{th}" style="background:{V("color.surface.sunken")}"><p class="pv-theme-label">{th} &middot; {_esc(meta["elevation"]["model"])}</p><div style="display:flex;gap:16px;flex-wrap:wrap">{boxes}</div></div>')
    html.append("</div>")
    # motion
    html.append("<h2 class=\"pv-h2\">Motion</h2><div class=\"pv-card\"><p class=\"pv-note\">Hover this card: the top box uses motion.duration.medium with the standard easing, the "
                "bottom one the spatial spring (CSS linear() sample). Reduced motion removes travel.</p>")
    html.append('<div class="motion-lane"><div class="motion-box m-std"></div></div><div class="motion-lane"><div class="motion-box m-spring"></div></div>')
    html.append("<p class=\"pv-mono\">" + " &middot; ".join(f"{k} {v}ms" for k, v in mot["durations"].items()) + "</p>")
    sp = base.get("motion.spring.spatial.default")
    if sp:
        ext = (sp.get("$extensions") or {}).get(NS, {})
        pts = re.findall(r"[-\d.]+", ext.get("css", {}).get("easing", ""))
        if pts and ext.get("spring", {}).get("dampingRatio", 1) < 1:
            ys = [float(x) for x in pts]
            n = len(ys) - 1
            path = " ".join(f"{'M' if i == 0 else 'L'}{rnd(10 + 280 * i / n, 1)},{rnd(90 - 60 * y, 1)}" for i, y in enumerate(ys))
            html.append(f'<svg width="300" height="100" viewBox="0 0 300 100" role="img" aria-label="spring curve"><path d="M10 30H290" stroke="#d4d4d8" stroke-dasharray="3 3"/>'
                        f'<path d="{path}" fill="none" stroke="#6366f1" stroke-width="2"/></svg><p class="pv-mono">spatial spring: damping {ext["spring"]["dampingRatio"]}, stiffness '
                        f'{ext["spring"]["stiffness"]}, {ext["css"]["durationMs"]}ms; Apple duration {ext["apple"]["duration"]}s bounce {ext["apple"]["bounce"]}</p>')
    html.append("</div></div></body></html>")
    return "\n".join(html) + "\n"


def cmd_preview(d, open_=False, files=None, meta=None, quiet=False):
    state = merge_defaults(load_state(d))
    if files is None:
        files, meta, _ = generate_system(load_state(d))
    path = os.path.join(d, "preview.html")
    write_text(path, render_preview(files, meta, state, d))
    if not quiet:
        print(f"wrote {path}")
    if open_:
        webbrowser.open("file://" + os.path.abspath(path))
    return path


# =============================================================================================
# Overview: the person's own design-system page (overview.html), rebuilt on every build so it grows with the system.
# What is decided shows as it is; what is a default says so; what needs a person (a logo, a voice guide, a product
# sentence) shows as "Not enough information" with the question that fills it. Templates are filled with their values.
# =============================================================================================

OVERVIEW_TEMPLATES = ["palette", "type-scale", "spacing-ruler", "radius", "elevation", "motion", "component-sheet"]
OVERVIEW_STATUS = {  # status -> (label, plain meaning)
    "chosen": ("Chosen", "You decided this."),
    "picked": ("Picked for you", "The AI picked this when you said 'just pick'. Change it any time."),
    "default": ("Default", "A sourced default. Nobody has looked at it with you yet."),
    "missing": ("Not enough information", "This needs something only you can give."),
}
OVERVIEW_HEADINGS = [("Hero", "display", ("display.lg", "display.md", "display.sm")), ("h1", "page title", ("headline.lg",)),
                     ("h2", "section", ("headline.md",)), ("h3", "sub-section", ("headline.sm",)), ("h4", "card title", ("title.lg",)),
                     ("h5", "group title", ("title.md",)), ("h6", "smallest heading", ("title.sm",)), ("p", "body", ("body.md",)),
                     ("small", "caption", ("body.sm",))]


def _ov_area_status(decs, title):
    rx = SECTION_PATHS.get(title)
    sb = [v["set_by"] for k, v in decs.items() if rx and re.match(rx, k)]
    if any(s in ("chosen", "confirmed_default", "reference", "asset", "research") for s in sb):
        return "chosen"
    if any(s in ("delegated", "assumed") for s in sb):
        return "picked"
    return "default"


def _ov_tag(status, extra=""):
    label, why = OVERVIEW_STATUS[status]
    return f'<span class="ov-tag ov-{status}" title="{_esc(why)}">{label}{_esc(extra)}</span>'


def _ov_md(text):
    """The few markdown marks DESIGN.md's summary uses: **bold**, `code`, '- ' bullets."""
    out, items = [], []
    for line in (text or "").splitlines():
        h = _esc(line.strip())
        h = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", h)
        h = re.sub(r"`(.+?)`", r"<code>\1</code>", h)
        if line.strip().startswith("- "):
            items.append(f"<li>{h[2:]}</li>")
            continue
        if items:
            out.append("<ul>" + "".join(items) + "</ul>")
            items = []
        if h:
            out.append(f"<p>{h}</p>")
    if items:
        out.append("<ul>" + "".join(items) + "</ul>")
    return "".join(out)


def _ov_dated_log(d):
    """(date, id, path, set_by) for every decision, from decisions.md."""
    fp = os.path.join(d, "decisions.md")
    if not os.path.exists(fp):
        return []
    with open(fp, encoding="utf-8") as f:
        text = f.read()
    return [(m.group(4), m.group(1), m.group(2).partition(" = ")[0].strip(), m.group(3))
            for m in re.finditer(r"^## (D-\d+) · (.*?)\n- set_by: (\S+) · locked: \S+ · date: (\S+)", text, flags=re.M)]


def _ov_font_link(state, meta, d="."):
    """No network: an @font-face for each brand font file the person recorded (hook H-type), relative to overview.html.
    Without files the page uses the face if it is installed, and says so when it is not (see the script below)."""
    rules = []
    faces = font_faces(state.get("raw") or {})
    name = next((f.get("face") for f in faces.values() if isinstance(f.get("face"), str) and not _generic_face(f.get("face"))
                 and f.get("face") != "=textFace"), None)
    for f in ((state.get("hooks") or {}).get("H-type") or {}).get("files") or []:
        m = re.search(r"\.(woff2|woff|ttf|otf)$", str(f), re.I)
        if not (m and name):
            continue
        path = f if os.path.isabs(f) else os.path.join(os.path.dirname(os.path.abspath(d)), f)
        if os.path.exists(path):
            fmt = {"woff2": "woff2", "woff": "woff", "ttf": "truetype", "otf": "opentype"}[m.group(1).lower()]
            rules.append(f'@font-face{{font-family:"{name}";src:url("{_esc(os.path.relpath(path, os.path.abspath(d)))}") format("{fmt}");font-weight:100 900}}')
    return ("<style>" + "".join(rules) + "</style>") if rules else "", name


def render_overview(d, files, meta, state):
    prefix = slug(meta.get("prefix") or "ds").replace("-", "")
    css = export_css(files, meta, prefix)
    V = lambda p: f"var({css_var(prefix, p)})"
    base = resolve_all(files, {})
    res = files["opendesigner.resolver.json"]
    themes = list((res.get("modifiers", {}).get("theme") or {}).get("contexts") or meta["modes"])
    by_theme = {th: resolve_all(files, {"theme": th}) for th in themes}
    hexv = lambda tree, p: (((tree.get(p) or {}).get("resolved") or {}).get("hex"))
    decs = _decisions(d)
    zoom = zoom_levels(d, state)
    qs = questions()
    ask = lambda qid: (qs.get(qid) or {}).get("ask") or qid
    name = state.get("name") or "Your design system"
    hooks = state.get("hooks") or {}
    t = lambda p: f"font: var({css_var(prefix, p)}); letter-spacing: var({css_var(prefix, p)}-tracking);"
    has = lambda p: p in base

    # ---- counts for the status line
    statuses = {title: _ov_area_status(decs, title) for _k, title in ZOOM_AREAS if title != "Overview"}
    n_chosen, n_picked = answer_counts(state, decs)
    open_hooks = [h for h, v in hooks.items() if (v or {}).get("status", "pending") in ("pending", "unknown")]

    def section(sid, title, status, body, note=""):
        return (f'<section class="ov-sec" id="{sid}"><header class="ov-sh"><h2>{_esc(title)}</h2>{_ov_tag(status) if status else ""}</header>'
                + (f'<p class="ov-note">{note}</p>' if note else "") + body + "</section>")

    def missing(what, qid=None, how=None):
        q = f'<span class="ov-q">{_esc(qid)}: {_esc(ask(qid))}</span>' if qid else ""
        return (f'<div class="ov-missing">{_ov_tag("missing")}<p>{_esc(what)}</p>{q}'
                + (f'<p class="ov-how">{_esc(how)}</p>' if how else "") + "</div>")

    # ---- cover: color blocks cut from the system, the name, the logo if there is one
    acc = hexv(base, "color.bg.action.primary") or "#444"
    blocks = [hexv(base, p) for p in ("color.bg.action.primary", "color.text.primary", "color.bg.accent.subtle", "color.surface.sunken")]
    logo = logo_src(state, d)
    what = product_words(state)
    cover = (f'<div class="ov-cover"><div class="ov-blocks">'
             + "".join(f'<i style="background:{b};flex:{w}"></i>' for b, w in zip(blocks, (4, 1, 2, 3)) if b)
             + '</div><div class="ov-name">'
             + (f'<img src="{_esc(logo)}" alt="{_esc(name)} logo" class="ov-logo">' if logo else "")
             + f'<h1>{_esc(name)}</h1>'
             + (f'<p class="ov-lede">{_esc(what)}</p>' if what else
                f'<p class="ov-lede ov-dim">What it is for is not recorded yet. {_ov_tag("missing")}</p>')
             + f'<p class="ov-meta">{n_chosen} answers you gave · {n_picked} picked for you · everything else a sourced default · '
               f'{len(hooks) - len(open_hooks)} of {len(hooks)} brand assets provided · built {_dt.date.today().isoformat()}</p>'
             + "</div></div>")

    # ---- how complete: one row per area
    rows = []
    for key, title in ZOOM_AREAS:
        if key == "overview":
            continue
        z = zoom[key]
        nxt = "; ".join(f"{q} {ask(q)}" for q in z["next"][:1])
        rows.append(f'<tr><td><a href="#{key}">{_esc(title)}</a></td><td>{_ov_tag(statuses[title])}</td>'
                    f'<td>{z["level"]}</td><td class="ov-dim">{_esc(nxt) or "nothing left at this level"}</td></tr>')
    progress = ('<table class="ov-table"><thead><tr><th>Area</th><th>Status</th><th>Zoom</th><th>Next question</th></tr></thead>'
                f'<tbody>{"".join(rows)}</tbody></table>')

    # ---- brand book: DESIGN.md's summary, voice
    summary = _ov_md(render_summary(d, state, meta, zoom))
    voice = hooks.get("H-voice") or {}
    brand = f'<div class="ov-prose">{summary}</div>'
    light_ = by_theme.get("light") or base
    inline = lambda v: re.sub(r"^<p>(.*)</p>$", r"\1", _ov_md(v))
    card = "".join(f'<tr><th scope="row">{_esc(k)}</th><td>{inline(v)}</td><td class="ov-dim">{_esc(src)}</td></tr>'
                   for k, v, src in taste_card(d, state, meta, light_, brand_delegated(d)))
    brand += ('<h3>Taste card</h3><p class="ov-dim">How it looks and feels, in five lines. Nothing on it is invented: each line '
              'says where it comes from.</p><table class="ov-table"><thead><tr><th>Line</th><th>What it says</th><th>From</th></tr>'
              f'</thead><tbody>{card}</tbody></table>')
    if voice.get("status", "pending") in ("pending", "unknown"):
        brand += missing("Voice and tone: how your product talks.", "Q-voice-01",
                         "Give 3 or 4 traits in the form 'X, but not Y', or a voice guide.")

    # ---- color: semantic roles per theme, with contrast on the base surface
    groups = [("Text", ["color.text.primary", "color.text.secondary", "color.text.disabled", "color.text.link", "color.text.accent"]),
              ("Surfaces", ["color.surface.base", "color.surface.raised", "color.surface.sunken", "color.bg.accent.subtle"]),
              ("Action", ["color.bg.action.primary", "color.text.on-action", "color.border.focus", "color.border.default"]),
              ("Status", ["color.text.danger", "color.text.success", "color.text.warning", "color.text.info"])]
    th_cols = []
    for th in themes:
        tree = by_theme[th]
        surf = hexv(tree, "color.surface.base") or "#ffffff"
        cells = []
        for gname, paths in groups:
            items = []
            for p in paths:
                hx = hexv(tree, p)
                if not hx:
                    continue
                on = {"color.text.on-action": "color.bg.action.primary"}.get(p) or (
                    f"color.bg.{p.split('.on-', 1)[1]}.bold" if ".on-" in p else None)  # text on a fill: measure against the fill
                ground = (hexv(tree, on) if on else None) or surf
                cr = contrast(hx, ground) if p.startswith(("color.text", "color.border")) else None
                items.append(f'<div class="ov-sw"><i style="background:{hx}"></i><span><b>{_esc(p[6:])}</b>{hx}'
                             + (f' · {cr:.1f}:1' if cr else "") + "</span></div>")
            cells.append(f'<div><h4>{gname}</h4>{"".join(items)}</div>')
        th_cols.append(f'<div class="ov-theme" data-theme="{th}"><h3>{_esc(th.title())}</h3><div class="ov-roles">{"".join(cells)}</div></div>')
    color = f'<div class="ov-themes">{"".join(th_cols)}</div>'
    if (hooks.get("H-color") or {}).get("status", "pending") in ("pending", "unknown") and not (state.get("raw") or {}).get("brandColor"):
        color += missing("Your exact brand colors, if you have them.", "Q-color-01")

    # ---- type: faces, the heading map, every style
    faces = font_faces(state.get("raw") or {})
    face_rows = "".join(f'<tr><td>{role}</td><td>{_esc(f.get("face") if f.get("face") != "=textFace" else "same as text")}</td>'
                        f'<td>{"open licence" if f.get("open") else (f.get("note") or "licence not recorded")}</td></tr>'
                        for role, f in faces.items())
    type_status = statuses["Typography"]
    fam_note = ""
    if all((f.get("face") in (None, "system", "=textFace") or _generic_face(f.get("face"))) for f in faces.values()):
        fam_note = missing("A typeface. The system font works, but it says nothing about the brand.", "Q-type-01")
    head_rows = []
    for tag, role, cands in OVERVIEW_HEADINGS:
        p = next((f"text.{c}" for c in cands if has(f"text.{c}")), None)
        if not p:
            continue
        r = base[p]["resolved"]
        size = (r.get("fontSize") or {}).get("value")
        head_rows.append(f'<div class="ov-hrow"><span class="ov-dim">{tag} · {role}<br>{p[5:]} · {size}px · {r.get("fontWeight")}</span>'
                         f'<span style="{t(p)}" class="ov-sample">{_esc(name if tag in ("Hero", "h1") else "The quick system builds itself")}</span></div>')
    styles = []
    for p in sorted((k for k in base if k.startswith("text.")), key=lambda k: -(((base[k].get("resolved") or {}).get("fontSize") or {}).get("value") or 0)):
        ext = ((base[p].get("$extensions") or {}).get("opendesigner") or {})
        r = base[p]["resolved"]
        styles.append(f'<tr><td><code>{p[5:]}</code></td><td>{(r.get("fontSize") or {}).get("value")} / {ext.get("lineHeightPx", "")}</td>'
                      f'<td>{r.get("fontWeight")}</td><td>{ext.get("letterSpacingEm", 0)}em</td><td class="ov-dim">{_esc(ext.get("use", ""))}</td></tr>')
    typ = (f'<table class="ov-table"><thead><tr><th>Role</th><th>Face</th><th>Licence</th></tr></thead><tbody>{face_rows}</tbody></table>'
           + fam_note + f'<h3>Headings</h3><div class="ov-heads">{"".join(head_rows)}</div>'
           + f'<details><summary>All {len(styles)} text styles</summary><table class="ov-table"><thead><tr><th>Style</th><th>Size / line</th>'
             f'<th>Weight</th><th>Tracking</th><th>Use for</th></tr></thead><tbody>{"".join(styles)}</tbody></table></details>')

    # ---- space, shape, depth, motion
    sp = sorted({int(v) for v in meta["space"].get("scale", []) if isinstance(v, (int, float)) and v > 0})[:12] if isinstance(meta["space"].get("scale"), list) else []
    if not sp:
        sp = sorted({int(((base[k].get("resolved") or {}).get("value") or 0)) for k in base if re.match(r"^space\.\d+$", k)} - {0})[:12]
    space = '<div class="ov-ruler">' + "".join(f'<div><i style="width:{s}px;height:{s}px"></i><span>{s}</span></div>' for s in sp) + "</div>"
    radii = [k for k in ("radius.detail", "radius.control-sm", "radius.control", "radius.container", "radius.overlay", "radius.person") if has(k)]
    shape = '<div class="ov-radii">' + "".join(f'<div><i style="border-radius:{V(k)}"></i><span>{k[7:]}</span></div>' for k in radii) + "</div>"
    elev = [k for k in ("elevation.raised", "elevation.floating", "elevation.overlay") if has(k)]
    depth = '<div class="ov-elev">' + "".join(f'<div style="box-shadow:{V(k)}">{k[10:]}</div>' for k in elev) + "</div>"
    durs = [k for k in base if re.match(r"^motion\.duration\.[a-z-]+$", k)]
    motion = ('<div class="ov-motion"><div class="ov-lane"><i></i></div><p class="ov-dim">Hover the lane: the standard easing at the medium '
              'duration. Reduced motion turns it off.</p><p class="ov-dim">' + " · ".join(f'{k[16:]} {_esc(((base[k].get("resolved") or {}).get("value")))}'
                                                                                       f'{_esc(((base[k].get("resolved") or {}).get("unit") or ""))}' for k in durs) + "</p></div>")

    # ---- components: the core set in their states, plus the inventory
    inv = ((state.get("components") or {}).get("inventory")) or []
    comp_status = statuses["Components"]
    comps = (f'<div class="ov-comps"><button class="ov-btn primary">Save changes</button><button class="ov-btn secondary">Cancel</button>'
             f'<button class="ov-btn primary is-focus">Focused</button><button class="ov-btn primary" disabled>Disabled</button>'
             f'<label class="ov-field"><span>Email</span><input class="ov-input" placeholder="you@example.com"></label>'
             f'<div class="ov-card"><b>Card title</b><span class="ov-dim">Raised surface, container radius, the raised shadow.</span></div></div>'
             + (f'<p class="ov-note">Planned components ({len(inv)}): {_esc(", ".join(inv))}.</p>' if inv else
                missing("Which components the product needs.", "Q-comp-02")))

    # ---- assets: every designer hook, provided or not
    cards = []
    for hid, hname, qid in hook_catalog():
        rec = hooks.get(hid) or {}
        st = rec.get("status", "pending")
        files_ = rec.get("files") or []
        if st in ("pending", "unknown"):
            cards.append(f'<div class="ov-asset ov-asset-missing"><b>{_esc(hname)}</b>{_ov_tag("missing")}'
                         f'<span class="ov-q">{_esc(qid or "")} {_esc(ask(qid) if qid else "")}</span></div>')
        else:
            imgs = "".join(f'<img src="{_esc(os.path.relpath(f if os.path.isabs(f) else os.path.join(os.path.dirname(os.path.abspath(d)), f), os.path.abspath(d)))}" alt="">'
                           for f in files_ if re.search(r"\.(svg|png|jpe?g|webp|gif)$", str(f), re.I))
            word = {"have": "Provided", "commissioning": "Being made", "tool": "Made with a tool", "open-library": "From an open library",
                    "placeholder": "Placeholder for now", "not-needed": "Not needed"}.get(st, st.title())
            cards.append(f'<div class="ov-asset"><b>{_esc(hname)}</b><span class="ov-tag ov-chosen">{_esc(word)}</span>{imgs}'
                         f'<span class="ov-dim">{_esc(rec.get("note") or ", ".join(os.path.basename(str(f)) for f in files_))}</span></div>')
    assets = f'<div class="ov-assets">{"".join(cards)}</div>'

    # ---- growth over time
    log = _ov_dated_log(d)
    days = {}
    for date, _id, _p, sb in log:
        days.setdefault(date, {"mine": 0, "other": 0})["mine" if sb in PERSON_SET_BY else "other"] += 1
    mx = max([v["mine"] + v["other"] for v in days.values()] or [1])
    timeline = ('<div class="ov-timeline">' + "".join(
        f'<div title="{dt}: {v["mine"]} of yours, {v["other"]} from defaults and standards"><i style="height:{max(4, round(80 * (v["mine"] + v["other"]) / mx))}px">'
        f'<em style="height:{round(100 * v["mine"] / max(1, v["mine"] + v["other"]))}%"></em></i><span>{dt[5:]}</span></div>' for dt, v in sorted(days.items()))
        + "</div>")
    recent = [e_ for e_ in log if e_[3] in PERSON_SET_BY][-8:][::-1]
    timeline += ('<table class="ov-table"><thead><tr><th>Latest of your decisions</th><th>How</th><th>Date</th></tr></thead><tbody>'
                 + "".join(f'<tr><td><code>{_esc(p)}</code></td><td>{_esc(sb.replace("_", " "))}</td><td>{dt}</td></tr>' for dt, _i, p, sb in recent)
                 + "</tbody></table>")

    # ---- the site brief (issue 48), only for a site that persuades: what is answered, and what still needs the person
    site_sec = ""
    if site_surface(state):
        brief_rows = site_brief_lines(state, decs)
        mark = lambda q: _unconfirmed(decs, f"answers.{q}").replace("*", "") if q in (state.get("answers") or {}) else ""
        body = "".join((f'<p><b>{_esc(label)}</b>{_esc(mark(qid))}: ' + "<br>".join(_esc(x.replace("*", "")) for x in lines) + "</p>")
                       if lines else missing(f"{label}: {hint}.", qid) for qid, label, hint, lines in brief_rows)
        site_sec = section("site", "Site brief", "missing" if any(r[3] is None for r in brief_rows) else "chosen", body,
                           "What the site must do, for whom, with what proof, and how it is found. Nothing here is invented.")

    # ---- templates filled with this system
    tpl = "".join(f'<a class="ov-tpl" href="preview/{n}.html">{n.replace("-", " ")}</a>' for n in OVERVIEW_TEMPLATES
                  if os.path.exists(os.path.join(d, "preview", f"{n}.html")))
    tpl = (f'<div class="ov-tpls">{tpl}<a class="ov-tpl" href="preview.html">every token</a></div>' if tpl else
           '<p class="ov-note">Run <code>engine.py build</code> to fill the visual templates with this system.</p>')

    sections = [
        section("brand", "Brand book", statuses["Content and Voice"] if voice.get("status") not in (None, "pending", "unknown") else "default", brand),
        *([site_sec] if site_sec else []),
        section("progress", "How complete it is", None, progress,
                "Each area works at every zoom level. Zoom into an area by answering its next question."),
        section("color", "Colors", statuses["Colors"], color, "Every text color shows its contrast on the theme's base surface; text meant for a fill is measured on that fill."),
        section("typography", "Typography", type_status, typ),
        section("layout", "Spacing", statuses["Layout"], space),
        section("shape", "Corners", statuses["Shapes"], shape),
        section("elevation", "Depth", statuses["Elevation & Depth"], depth),
        section("motion", "Motion", statuses["Motion"], motion),
        section("components", "Components", comp_status, comps),
        section("iconography", f"Brand assets · {len(hooks) - len(open_hooks)} of {len(hooks)} provided", "chosen" if not open_hooks else "missing", assets,
                "The parts only a designer or the brand owner can make. The system never invents them."),
        section("growth", "How it grew", None, timeline, "Each bar is a day. The filled part is decisions people made; the rest came from defaults and standards."),
        section("templates", "Visual templates", None, tpl, "Each template shows your system, not sample data."),
    ]
    nav = "".join(f'<a href="#{sid}">{title}</a>' for sid, title in [("brand", "Brand")] + ([("site", "Site")] if site_sec else []) + [("progress", "Progress"), ("color", "Color"),
                  ("typography", "Type"), ("layout", "Space"), ("components", "Components"), ("iconography", "Assets"), ("growth", "History")])
    toggle = "".join(f'<button class="ov-th" data-set="{th}">{th.title()}</button>' for th in themes)
    page_css = f"""
*,*::before,*::after{{box-sizing:border-box}}
body{{margin:0;background:{V('color.surface.base')};color:{V('color.text.primary')};{t('text.body.md')}}}
.ov-wrap{{max-width:1120px;margin:0 auto;padding:0 20px 96px}}
.ov-bar{{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;padding:12px 0;background:{V('color.surface.base')};border-bottom:1px solid {V('color.border.subtle')}}}
.ov-bar a{{color:{V('color.text.secondary')};text-decoration:none}} .ov-bar a:hover{{color:{V('color.text.primary')}}}
.ov-bar span{{flex:1}} .ov-th{{font:inherit;background:none;border:1px solid {V('color.border.default')};color:{V('color.text.primary')};border-radius:{V('radius.control')};padding:4px 10px;cursor:pointer}}
.ov-cover{{margin:32px 0 8px}} .ov-blocks{{display:flex;height:120px;border-radius:{V('radius.container')};overflow:hidden}} .ov-blocks i{{display:block}}
.ov-name{{padding:28px 0 8px}} .ov-name h1{{margin:0;{t('text.display.sm') if has('text.display.sm') else t('text.headline.lg')}}}
.ov-logo{{height:48px;width:auto;margin:0 0 16px;display:block}}
.ov-lede{{margin:12px 0 0;max-width:62ch;{t('text.body.lg') if has('text.body.lg') else t('text.body.md')}color:{V('color.text.secondary')}}}
.ov-meta{{margin:14px 0 0;{t('text.body.sm')}color:{V('color.text.tertiary')}}}
.ov-sec{{margin:56px 0 0;padding:28px 0 0;border-top:1px solid {V('color.border.subtle')}}}
.ov-sh{{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 12px}} .ov-sh h2{{margin:0;{t('text.headline.sm') if has('text.headline.sm') else t('text.title.lg')}}}
h3{{margin:24px 0 10px;{t('text.title.md') if has('text.title.md') else t('text.title.sm')}}} h4{{margin:0 0 8px;{t('text.label.lg') if has('text.label.lg') else t('text.body.md')}color:{V('color.text.secondary')}}}
.ov-note{{margin:0 0 16px;max-width:70ch;color:{V('color.text.secondary')}}} .ov-dim{{color:{V('color.text.tertiary')}}}
.ov-tag{{display:inline-flex;align-items:center;gap:6px;{t('text.label.sm') if has('text.label.sm') else t('text.body.sm')}padding:3px 9px;border-radius:999px;white-space:nowrap;border:1px solid transparent}}
.ov-chosen{{background:{V('color.bg.accent.subtle')};color:{V('color.text.accent')}}}
.ov-picked{{background:{V('color.bg.neutral.subtle')};color:{V('color.text.primary')}}}
.ov-default{{background:transparent;color:{V('color.text.secondary')};border-color:{V('color.border.default')}}}
.ov-missing{{background:transparent;color:{V('color.text.tertiary')};border:1px dashed {V('color.border.default')}}}
div.ov-missing{{display:block;border-radius:{V('radius.container')};padding:16px 18px;margin:12px 0}} div.ov-missing p{{margin:8px 0 0;color:{V('color.text.secondary')}}}
.ov-q{{display:block;margin-top:6px;{t('text.body.sm')}color:{V('color.text.tertiary')}}} .ov-how{{{t('text.body.sm')}}}
.ov-prose ul{{padding-left:20px}} .ov-prose li{{margin:4px 0}} code{{font-family:var({css_var(prefix, 'font.family.mono')});font-size:.92em}}
.ov-table{{width:100%;border-collapse:collapse;margin:8px 0}} .ov-table th{{text-align:left;{t('text.label.md') if has('text.label.md') else t('text.body.sm')}color:{V('color.text.secondary')};padding:8px 10px;border-bottom:1px solid {V('color.border.default')}}}
.ov-table td{{padding:8px 10px;border-bottom:1px solid {V('color.border.subtle')};vertical-align:top}} .ov-table th[scope=row]{{vertical-align:top}} .ov-table a{{color:{V('color.text.link')}}}
.ov-themes{{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:16px}}
.ov-theme{{background:{V('color.surface.base')};color:{V('color.text.primary')};border:1px solid {V('color.border.subtle')};border-radius:{V('radius.container')};padding:18px}}
.ov-theme h3{{margin:0 0 12px}} .ov-roles{{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px}}
.ov-sw{{display:flex;gap:10px;align-items:center;margin:0 0 8px;{t('text.body.sm')}}} .ov-sw i{{width:32px;height:32px;border-radius:6px;flex:none;border:1px solid {V('color.border.subtle')}}}
.ov-sw b{{display:block;font-weight:500;color:{V('color.text.primary')}}} .ov-sw span{{color:{V('color.text.secondary')};min-width:0;overflow-wrap:anywhere}}
.ov-heads{{display:grid;gap:14px}} .ov-hrow{{display:grid;grid-template-columns:200px 1fr;gap:16px;align-items:baseline}} .ov-hrow>span:first-child{{{t('text.body.sm')}}}
.ov-sample{{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
@media (max-width:640px){{.ov-hrow{{grid-template-columns:1fr}}}}
details summary{{cursor:pointer;color:{V('color.text.secondary')};margin:16px 0 8px}}
.ov-ruler{{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap}} .ov-ruler div{{display:grid;justify-items:center;gap:6px;{t('text.body.sm')}color:{V('color.text.tertiary')}}}
.ov-ruler i{{display:block;background:{V('color.bg.action.primary')};opacity:.85;border-radius:2px}}
.ov-radii{{display:flex;gap:16px;flex-wrap:wrap}} .ov-radii div{{display:grid;gap:6px;justify-items:center;{t('text.body.sm')}color:{V('color.text.tertiary')}}}
.ov-radii i{{width:72px;height:72px;border:2px solid {V('color.text.primary')}}}
.ov-elev{{display:flex;gap:20px;flex-wrap:wrap;padding:12px 0}} .ov-elev div{{width:180px;height:96px;display:grid;place-items:center;background:{V('color.surface.raised')};border-radius:{V('radius.container')};color:{V('color.text.secondary')}}}
.ov-lane{{position:relative;height:48px;background:{V('color.surface.sunken')};border-radius:{V('radius.container')};container-type:inline-size}}
.ov-lane i{{position:absolute;left:6px;top:6px;width:36px;height:36px;border-radius:{V('radius.control')};background:{V('color.bg.action.primary')};transition:transform {V('motion.duration.medium')} {V('motion.easing.standard')}}}
.ov-lane:hover i{{transform:translateX(calc(100cqw - 48px))}}
@media (prefers-reduced-motion: reduce){{.ov-lane i{{transition:none}} .ov-lane:hover i{{transform:none}}}}
.ov-comps{{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;margin:8px 0 16px}}
.ov-btn{{{t('text.label.lg') if has('text.label.lg') else t('text.body.md')}height:{V('size.control.md')};padding:0 {V('space.inset.lg')};border-radius:{V('radius.control')};border:1px solid transparent;cursor:pointer}}
.ov-btn.primary{{background:{V('color.bg.action.primary')};color:{V('color.text.on-action')}}} .ov-btn.primary:hover{{background:{V('color.bg.action.primary-hover')}}}
.ov-btn.secondary{{background:transparent;color:{V('color.text.primary')};border-color:{V('color.border.default')}}}
.ov-btn.is-focus,.ov-btn:focus-visible,.ov-input:focus-visible,.ov-th:focus-visible{{outline:{V('focus.ring.width')} solid {V('color.border.focus')};outline-offset:{V('focus.ring.offset')}}}
.ov-btn[disabled]{{background:{V('color.bg.disabled')};color:{V('color.text.disabled')};cursor:not-allowed}}
.ov-field{{display:grid;gap:6px;{t('text.body.sm')}color:{V('color.text.secondary')}}}
.ov-input{{{t('text.body.md')}height:{V('size.control.md')};padding:0 {V('space.inset.md')};border-radius:{V('radius.control')};border:1px solid {V('color.border.input')};background:{V('color.surface.raised')};color:{V('color.text.primary')}}}
.ov-card{{display:grid;gap:4px;max-width:280px;padding:{V('space.inset.xl')};background:{V('color.surface.raised')};border:{V('border.width.default')} solid {V('color.text.primary' if (meta.get('shape') or {}).get('borderDefault', 1) > 1 else 'color.border.subtle')};border-radius:{V('radius.container')};box-shadow:{V('elevation.raised')}}}
.ov-assets{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}}
.ov-asset{{display:grid;gap:8px;align-content:start;padding:16px;border-radius:{V('radius.container')};border:1px solid {V('color.border.subtle')};background:{V('color.surface.raised')}}}
.ov-asset{{min-width:0}} .ov-asset img{{width:100%;height:56px;object-fit:contain;object-position:left center}} .ov-asset .ov-tag{{justify-self:start}}
.ov-asset-missing{{background:transparent;border-style:dashed;border-color:{V('color.border.default')}}} .ov-asset-missing b{{color:{V('color.text.secondary')};font-weight:500}}
.ov-timeline{{display:flex;align-items:flex-end;gap:8px;height:110px;overflow-x:auto;padding:0 0 4px}}
.ov-timeline div{{display:grid;justify-items:center;gap:4px;{t('text.body.sm')}color:{V('color.text.tertiary')}}}
.ov-timeline i{{display:flex;flex-direction:column-reverse;width:22px;background:{V('color.bg.neutral.subtle')};border-radius:3px;overflow:hidden}}
.ov-timeline em{{display:block;background:{V('color.bg.action.primary')}}}
.ov-tpls{{display:flex;flex-wrap:wrap;gap:10px}} .ov-tpl{{padding:10px 14px;border-radius:{V('radius.control')};border:1px solid {V('color.border.default')};color:{V('color.text.primary')};text-decoration:none}}
.ov-tpl:hover{{border-color:{V('color.border.strong') if has('color.border.strong') else V('color.text.primary')}}}
"""
    font_css, face = _ov_font_link(state, meta, d)
    font_note = ""
    if face:  # say so when the brand face is not on this computer, instead of quietly showing a fallback
        font_note = ('<p id="ov-font" class="ov-note" hidden>' + _esc(face) + " is not installed on this computer, so this page shows a "
                     "fallback font. Install it, or record its font files with the H-type asset, to see the real type.</p>")
    script = ("<script>(function(){var r=document.documentElement;document.querySelectorAll('.ov-th').forEach(function(b){"
              "b.addEventListener('click',function(){r.setAttribute('data-theme',b.dataset.set);"
              "try{localStorage.setItem('od-overview-theme',b.dataset.set)}catch(e){}})});"
              "try{var s=localStorage.getItem('od-overview-theme');if(s)r.setAttribute('data-theme',s)}catch(e){}"
              + ("var n=document.getElementById('ov-font');function w(f){var c=document.createElement('canvas').getContext('2d');"
                 "c.font='40px '+f;return c.measureText('mmmmmmmmmmlli WQ@#').width}"
                 "var go=function(){if(n&&w('\"" + _esc(face).replace("'", "") + "\", monospace')===w('monospace'))n.hidden=false};"
                 "(document.fonts&&document.fonts.ready?document.fonts.ready.then(go):go());" if face else "")
              + "})();</script>")
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{_esc(name)} design system</title>{font_css}'
            f'<!-- Written by OpenDesigner {OPENDESIGNER_VERSION} (engine.py build): your system as it stands today. Edit the system, not this file. -->'
            f'<style>{css}\n{page_css}</style></head><body><div class="ov-wrap">'
            f'<nav class="ov-bar" aria-label="Sections"><b>{_esc(name)}</b>{nav}<span></span>{toggle}</nav>'
            f'{cover}{font_note}{"".join(sections)}</div>{script}</body></html>')


def cmd_overview(d, open_=False, files=None, meta=None, quiet=False, templates=True):
    state = merge_defaults(load_state(d))
    if files is None:
        files, meta, _ = generate_system(load_state(d))
    if templates:  # fill every visual template with this system, so the person never sees sample data
        import contextlib
        import io
        with contextlib.redirect_stdout(io.StringIO()):
            for n in OVERVIEW_TEMPLATES:
                try:
                    cmd_show(d, n)
                except SystemExit:
                    pass
    path = os.path.join(d, "overview.html")
    write_text(path, render_overview(d, files, meta, state))
    if not quiet:
        print(f"wrote {path}")
    if open_:
        webbrowser.open("file://" + os.path.abspath(path))
    return path


# =============================================================================================
# Intake: reference measurements -> proposed dials and raw inputs (LEVERS E, spec 5)
# =============================================================================================

def _inverse_anchors(points, y):
    """x for a y on a piecewise-linear, monotonic anchor map."""
    pts = [(x, 120.0 if v == "max" else float(v)) for x, v in points if isinstance(v, (int, float)) or v == "max"]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        lo, hi = min(y0, y1), max(y0, y1)
        if lo <= y <= hi and y1 != y0:
            return x0 + (y - y0) / (y1 - y0) * (x1 - x0)
    return pts[0][0] if abs(y - pts[0][1]) < abs(y - pts[-1][1]) else pts[-1][0]


def _band_mid(dial, param, value):
    drv = lever_index()[param]
    best = None
    for lo, hi, out in drv["map"]["bands"]:
        if out == value:
            return (lo + hi) // 2
        if isinstance(out, (int, float)) and isinstance(value, (int, float)):
            dist = abs(out - value)
            if best is None or dist < best[0]:
                best = (dist, (lo + hi) // 2)
    return best[1] if best else None


def _shadow_alpha(s):
    m = re.findall(r"rgba?\(([^)]*)\)", s)
    al = []
    for grp in m:
        parts = [p for p in re.split(r"[\s,/]+", grp.strip()) if p]
        if len(parts) >= 4:
            try:
                a = parts[3]
                al.append(float(a[:-1]) / 100 if a.endswith("%") else float(a))
            except ValueError:
                pass
    return max(al) if al else None


def _face_key(name):
    """'sohne-var', 'Söhne', 'Söhne Buch' -> 'sohne': compare typeface names across CSS and a person's words."""
    import unicodedata
    t = unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode().lower()
    t = re.sub(r"[\s_-]*(var|variable|vf|text|display|web|buch|regular|pro)$", "", re.sub(r"[\"']", "", t).strip())
    return re.sub(r"[^a-z0-9]", "", t)


def _shadow_strength(dep, shadows):
    """Count-weighted median shadow strength (U5, coordinator): each elevation layer's alpha scaled by how soft it is
    (blur plus spread over 16px, at least a quarter), so a tight key shadow with a high alpha does not read as deep.
    White or transparent layers do not count."""
    items = []
    for lv in dep.get("levels") or []:
        a, b, sp = float(lv.get("alpha") or 0), float(lv.get("blur") or 0), float(lv.get("spread") or 0)
        if a > 0:
            items.append((a * clamp((b + max(sp, 0)) / 16, 0.25, 1.0), int(lv.get("count") or 1)))
    if not items:
        for sh in shadows or []:
            for lay in re.split(r",(?![^(]*\))", sh):
                if re.search(r"rgba?\(\s*255[\s,]+255[\s,]+255", lay) or "#fff" in lay.lower():
                    continue
                al = _shadow_alpha(lay)
                nums = [float(x) for x in re.findall(r"(-?\d*\.?\d+)px", lay)]
                blur = abs(nums[2]) if len(nums) > 2 else 0.0
                spread = nums[3] if len(nums) > 3 else 0.0
                if al:
                    items.append((al * clamp((blur + max(spread, 0)) / 16, 0.25, 1.0), 1))
    if not items:
        return None
    items.sort()
    total, acc = sum(c for _, c in items), 0
    for a, c in items:
        acc += c
        if acc * 2 >= total:
            return rnd(a, 3)
    return rnd(items[-1][0], 3)


def fit_reference(ref, state=None):
    """Run LEVERS E3 backwards on a measurement file (engine schema or opendesigner-extract css_scan --json output).
    With the person's state, a reference typeface that is the person's own licensed face may carry over (their asset)."""
    kind = ref.get("kind") or ("url" if ref.get("method") == "computed" else "code")
    tag = ref.get("tag", "inspiration")
    conf_kind = {"url": "url", "code": "url", "figma": "figma", "screenshot": "screenshot", "pdf": "screenshot"}.get(kind, "url")
    ri = levers()["referenceIntake"]["dials"]
    m = ref.get("measurements") or ref  # css_scan output is flat
    props, notes = [], []

    def conf(dial):
        return ri.get(dial, {}).get("confidence", {}).get(conf_kind, "medium")

    def add(path, value, confidence, basis):
        if value is None or confidence == "none":
            return
        props.append({"path": path, "value": value, "confidence": confidence, "basis": basis, "status": "pending"})
    # roundness
    rad = (m.get("radius") or {}).get("mostCommon", m.get("controlRadius"))
    if rad is not None:
        v = 97 if rad == "full" or (isinstance(rad, (int, float)) and rad >= 999) else _band_mid("roundness", "radius.control",
                                                                                                  snap_to(float(rad), [0, 2, 4, 6, 8, 12, 16]))
        add("dials.roundness", int(v), conf("roundness"), f"most common control radius {rad} -> A5 band")
    # density
    ty = m.get("type") or {}
    scale = ty.get("scale") or {}
    body = m.get("bodySize") or scale.get("base")
    ctl = m.get("controlHeight")
    guesses = []
    if ctl:
        guesses.append(_band_mid("density", "control.height.md", snap_to(float(ctl), [32, 40, 48])))
    if body:
        guesses.append({13: 95, 14: 78, 15: 60, 16: 35, 17: 25, 18: 15, 19: 5}.get(int(round(float(body))), 95 if float(body) < 13 else 5))
    air, blank, room = m.get("air"), m.get("blankRows"), []
    # empty space, read the way people see it (read_page.js): the gap between blocks of text in multiples of their type size,
    # and the share of the page height left blank across its whole width. Each counts 1.5 against the body size's 1, so a
    # page of small type in a lot of space reads spacious, not compact [inferred anchors, calibrated on 7 sites 2026-10-23]
    if air is not None:
        room.append(_inverse_anchors([[95, 0.4], [75, 0.8], [50, 1.4], [25, 2.2], [5, 3.2]], clamp(float(air), 0.4, 3.2)))
    if blank is not None:
        room.append(_inverse_anchors([[90, 0.02], [70, 0.08], [50, 0.18], [25, 0.35], [5, 0.55]], clamp(float(blank), 0.02, 0.55)))
    if guesses or room:
        add("dials.density", int(round((sum(guesses) + 1.5 * sum(room)) / (len(guesses) + 1.5 * len(room)))), conf("density"),
            f"body {body}px" + (f", controls {ctl}px" if ctl else "") + (f", blocks {air} type sizes apart" if air is not None else "")
            + (f", {round(float(blank) * 100)}% of the height blank" if blank is not None else "") + " -> A3 bands")
    # depth
    dep = m.get("depth") or {}
    shadows = dep.get("shadows") or m.get("shadows") or []
    if m.get("backdropBlur"):
        add("dials.depth", 90, conf("depth"), "backdrop blur on controls -> materials band")
    elif dep.get("hint") or shadows is not None:
        hint = dep.get("hint") or ("borders" if not shadows else "shadow-ladder")
        v = {"borders": 8, "hard-offset": TRAIT_DIALS["depth"][1]["hard-offset"], "ring+faint-shadow": 25, "tonal": 45, "shadow-ladder": 68}.get(hint, 40)
        al = _shadow_strength(dep, shadows) or 0
        if al and hint in ("shadow-ladder", "ring+faint-shadow"):
            pos = 16 + (clamp(al, 0.08, 0.24) - 0.08) / 0.16 * 84
            lo, hi = (16, 35) if hint == "ring+faint-shadow" else (56, 80)
            v = int(round(clamp(pos, lo, hi)))
        drawn = ", ".join(x for x in (f"{dep['windowCount']} windows with a title bar" if dep.get("windowCount") else "",
                                       f"{sum(f['count'] for f in dep['frames'])} drawn frames" if dep.get("frames") else "",
                                       f"{dep['minorShadows']} minor soft shadow(s) ignored" if dep.get("minorShadows") else "") if x)
        add("dials.depth", v, conf("depth"), f"{hint}" + (f", median shadow strength {al} (alpha weighted by softness)" if al else "")
            + (f"; {drawn}" if drawn else "") + " -> A6 bands")
    # colorfulness and warmth
    col = m.get("color") or {}
    accents = col.get("accents") or []
    if accents:
        top = accents[0]["hex"] if isinstance(accents[0], dict) else accents[0]
        hct = hct_chroma_of_hex(top)
        pts = next(d for d in levers()["dials"] if d["id"] == "colorfulness")["drives"][0]["map"]["points"]
        v = _inverse_anchors(pts, hct)
        hues = {round(hex_to_oklch(a["hex"] if isinstance(a, dict) else a)[2] / 30) for a in accents[:6]
                if hex_to_oklch(a["hex"] if isinstance(a, dict) else a)[1] > 0.06}
        share = col.get("chromaticShare", m.get("chromaticShare"))
        if share is not None:  # how much of the page is coloured outweighs how strong the accent is (3 to 2)
            av = _inverse_anchors([[0, 0], [12, 0.01], [25, 0.05], [45, 0.15], [65, 0.35], [85, 0.6], [95, 0.9]], clamp(float(share), 0, 0.9))
            v = 0.6 * av + 0.4 * v
        elif len(hues) >= 3:
            v = max(v, 62)
        add("dials.colorfulness", int(round(clamp(v, 0, 100))), conf("colorfulness"),
            f"top accent HCT chroma {rnd(hct, 1)}" + (f", {rnd(float(share) * 100, 1)}% of the page in colour" if share is not None
                                                      else f", {len(hues)} distinct accent hue(s)") + " -> A7 anchors")
        if tag == "our-product":
            add("raw.brandColor", top, "high", "the person's own product: its brand color may carry over")
        else:
            notes.append(f"Accent {top} is the reference's identity: carry its role and chroma level, not the hue; ask for the brand color.")
    nt = col.get("neutralTint")
    if nt:
        c, h = float(nt.get("chroma", nt.get("c", 0))), float(nt.get("hue", nt.get("h", 0)) or 0)
        if c < 0.004:
            w = 50
        elif 180 <= h <= 320:  # cool: slate 0.046 (0), gray 0.027 (25)
            w = 25 - (c - 0.027) / 0.019 * 25 if c >= 0.027 else 50 - c / 0.027 * 25
        else:  # warm: stone 0.013 (75), taupe 0.021 (100)
            w = 50 + c / 0.013 * 25 if c <= 0.013 else 75 + (c - 0.013) / 0.008 * 25
        add("dials.warmth", int(round(clamp(w, 0, 100))), conf("warmth"), f"neutral tint chroma {c} at hue {h} -> A8 anchors")
    # type
    if scale.get("base"):
        b = int(round(float(scale["base"])))
        if 12 <= b <= 20:
            add("raw.baseSize", b, "high" if conf_kind != "screenshot" else "medium", f"type scale fit base {scale['base']}")
        r = scale.get("ratio")
        if r:
            if (scale.get("meanLogResidual") or 0) < 0.03:
                add("dials.expression", int(_band_mid("expression", "type.ratio", min([1.2, 1.25, 1.333], key=lambda x: abs(x - r)))),
                    "medium", f"modular type ratio {r} -> A1 ratio band (partly: expression also covers emphasis)")
                if r not in (1.2, 1.25, 1.333):
                    add("overrides.type.ratio", r, "medium", "measured ratio is between the dial's bands; keep it as an override")
            else:
                notes.append("Type sizes are hand-tuned (large residuals): keep the measured sizes as overrides rather than a ratio.")
    fams = ty.get("families") or m.get("fontFamilies") or ((m.get("typefaces") if isinstance(m.get("typefaces"), list) else None) or [])
    fams = [f if isinstance(f, str) else (f.get("family") or f.get("name") or "") for f in fams]
    fams = [f for f in fams if f and not _generic_face(f.strip("'\" ").lower())]
    raw_s = (state or {}).get("raw") or {}
    own = [x for x in (raw_s.get("brandFace"), raw_s.get("textFace"), raw_s.get("displayFace"))
           if isinstance(x, str) and not x.startswith("=") and not _generic_face(x)]
    h_type = (((state or {}).get("hooks") or {}).get("H-type") or {}).get("status")
    licensed = h_type in ("have", "placeholder") or any(v is True for v in (raw_s.get("fontLicence") or {}).values())
    if fams:
        mine = next((o for o in own for f in fams if _face_key(o) and _face_key(o) == _face_key(f)), None)
        if tag == "our-product":
            add("raw.textFace", fams[0], "high", "the person's own product; confirm the licence covers web and apps (hook H-type)")
        elif mine and licensed:
            add("raw.textFace", mine, "high", f"{fams[0]} is your own licensed face ({mine}, hook H-type), not taken from the reference; "
                                                "its licence scope still decides where it is used (raw.fontLicence)")
            notes.append(f"Typeface {fams[0]} matches your own licensed {mine}: kept as yours, not copied from the reference.")
        else:
            notes.append(f"Typeface {fams[0]} is not carried; pick an open face of the same classification (identity rule, spec 5.4)."
                         + (" If you license it yourself, record it first (hook H-type and raw.fontLicence)." if not licensed else ""))
    sp = m.get("space") or {}
    if sp.get("unit"):
        add("raw.spaceUnit", int(sp["unit"]), "high" if conf_kind != "screenshot" else "low", f"largest of 4/5/8 dividing most values ({sp.get('shareDivisible')})")
    mo = m.get("motion") or {}
    loops = mo.get("loops") or {}
    if (mo.get("durationMultiplier") or loops.get("count")) and conf("energy") != "none":
        v, why = None, []
        if mo.get("durationMultiplier") and mo.get("fadesOnly"):  # colour and opacity fades move nothing: calm, however slow
            v = 10 if float(mo.get("median") or 0) <= 200 else 20
            why.append(f"only colour and opacity fades ({mo.get('fades')}), median {mo.get('median')}ms")
        elif mo.get("durationMultiplier"):
            pts = next(d for d in levers()["dials"] if d["id"] == "energy")["drives"]
            mp = next(x for x in pts if x["param"] == "motion.durationMultiplier")["map"]["points"]
            v = _inverse_anchors(mp, clamp(float(mo["durationMultiplier"]), 0.8, 1.2))
            eas = " ".join(str(e) for e in mo.get("easings") or [])
            if mo.get("overshoot") or re.search(r"cubic-bezier\([^)]*,\s*1\.\d+", eas):
                v = max(v, 72)
            why.append(f"median duration {mo.get('median')}ms -> multiplier {mo['durationMultiplier']}")
        if (loops.get("count") or 0) >= 3 or (loops.get("count") and v is None):  # small things always running (one spinner is not a style):
            # its easing is the trait (TRAIT_DIALS motion), never its length
            lv = {"stepped": TRAIT_DIALS["motion"][1]["stepped"], "linear": 35, "eased": 50, "springy": TRAIT_DIALS["motion"][1]["springy"]}.get(
                loops.get("character"), 40)
            v = lv if v is None else max(v, lv)
            why.append(f"{loops['count']} loop(s) always running, {loops.get('character')}")
        add("dials.energy", int(round(v)), conf("energy") if mo.get("durationMultiplier") else "low", "; ".join(why) + " -> A4 anchors")
    notes.append("Brand presence is never inferred: it starts at 50 and is asked (LEVERS E2).")
    if tag == "competitor":
        props = []
        notes.insert(0, "Competitor reference: read only to list the category's shared tropes; nothing is proposed.")
    return {"id": ref.get("id") or "ref", "tag": tag, "kind": kind, "proposals": props, "notes": notes}


def cmd_intake(d, path, accept=False, as_json=False):
    if not os.path.isfile(path):
        raise SystemExit(f"File not found: {path}. Give the path of a reference JSON file (see opendesigner-extract).")
    try:
        ref = read_json(path)
    except ValueError as ex:
        raise SystemExit(f"{path} is not a JSON file the intake can read ({ex}).")
    sp0 = os.path.join(d, "state.json")
    fit = fit_reference(ref, merge_defaults(read_json(sp0)) if os.path.exists(sp0) else None)
    rid = fit["id"] if fit["id"] != "ref" else slug(os.path.splitext(os.path.basename(path))[0])
    fit["id"] = rid
    fit["file"] = os.path.relpath(path, d) if os.path.exists(d) else path
    sp = os.path.join(d, "state.json")
    if os.path.exists(sp):
        state = merge_defaults(read_json(sp))
        state.setdefault("references", {})[rid] = {"tag": fit["tag"], "kind": fit["kind"], "file": fit["file"],
                                                    "proposals": fit["proposals"], "notes": fit["notes"],
                                                    "status": "accepted" if accept else "pending"}
        dump_json(sp, state)
        if accept:
            for pr in fit["proposals"]:
                holder = std_holder(merge_defaults(read_json(sp)), normalize_path(pr["path"]))
                if holder:  # a standard outranks a reference (docs/KNOWLEDGE.md 2): say so and go on
                    pr["status"] = "skipped (standard)"
                    fit["notes"].append(f"{pr['path']} was not changed: it follows standard {holder}")
                    continue
                try:
                    cmd_set(d, pr["path"], pr["value"], why=f"from reference {rid} ({pr['confidence']} confidence): {pr['basis']}",
                            set_by="reference", source_ref=rid, quiet=True)
                except SystemExit as ex:  # a value a standard forbids (or the engine refuses) is skipped, and said
                    pr["status"] = "skipped"
                    fit["notes"].append(f"{pr['path']} was not changed: {str(ex).splitlines()[0]}")
                    continue
                pr["status"] = "accepted"
    if as_json:
        print(json.dumps(fit, indent=2))
        return fit
    print(f"Reference {rid} ({fit['tag']}, {fit['kind']}): {len(fit['proposals'])} proposal(s)"
          + (" accepted" if accept else ", pending until accepted"))
    for pr in fit["proposals"]:
        print(f"  {pr['path']:26s} {json.dumps(pr['value']):>8s}  {pr['confidence']:6s}  {pr['basis']}")
    for n in fit["notes"]:
        print(f"  note: {n}")
    if not accept and fit["proposals"]:
        print(f"Accept one with: engine.py set <path> <value> --set-by reference --source-ref {rid} --why \"...\"  (or rerun with --accept)")
    return fit


# =============================================================================================
# CLI
# =============================================================================================

def cmd_resolve(d):
    state = load_state(d)
    ctx = Ctx(state)
    out = {"dials": ctx.dials, "dialSources": ctx.dial_src, "macroConflicts": ctx.conflicts,
           "zoom": zoom_levels(d, merge_defaults(state)), "params": {k: ctx.params[k] for k in sorted(ctx.params)}}
    print(json.dumps(out, indent=2, ensure_ascii=False))


def skipped_line(state, skipped):
    """One line on the code exports build left out, and how to get one anyway or add a platform."""
    plats = sorted(known_platforms(state) or [])
    words = lambda xs: ", ".join(xs[:-1]) + " and " + xs[-1] if len(xs) > 1 else xs[0]
    return (f"Not written: {words(skipped)}, because it runs on {words(plats)} (Q-plat-01). "
            f"To write one anyway: engine.py export --format {skipped[0]}. To add a platform: "
            f"engine.py pick Q-plat-01 '{json.dumps(plats + [PLATFORM_OF.get(skipped[0], 'ios')])}'.")


def cmd_build(d, force=False):
    """generate -> validate -> (only if no errors, or --force) DESIGN.md + PRODUCT.md + exports + preview. The exports are
    the ones for the chosen platforms (build_formats); `export --format all` writes every one.
    DESIGN.md comes first because the artifact export copies it into its README. A build that writes the files stamps
    opendesigner.built with this release."""
    before = state_or_none(d)
    files, meta, _ = cmd_generate(d, quiet=True)
    rep = validate_dir(d)
    errors = rep.count("error")
    if errors and not force:
        track(d, "error", step="build", count=errors)
        print_report(rep, d)
        print(f"Stopped after tokens/: nothing was exported, and DESIGN.md and preview.html were not refreshed. "
              f"Fix the error{'s' if errors != 1 else ''} above and run build again (--force exports anyway).")
        return 1
    cmd_design_md(d, files=files, meta=meta, quiet=True)
    fmts, skipped = build_formats(load_state(d), d)
    cmd_export(d, fmts, files, meta, quiet=True)
    cmd_preview(d, files=files, meta=meta, quiet=True)
    cmd_overview(d, files=files, meta=meta, quiet=True)
    dump_json(os.path.join(d, STATE_FILE), stamp_version(load_state(d), built=True))
    track(d, "export", kind="all")
    print(f"built {d}: tokens, build/ ({', '.join(fmts)}), DESIGN.md, PRODUCT.md, preview.html, overview.html"
          + (" (exported with errors because of --force)" if errors else ""))
    if skipped:
        print(skipped_line(load_state(d), skipped))
    kind, v = version_status(before) if before else ("current", None)
    if kind in ("built", "saved", "unstamped"):
        print(f"This system {_made_with(kind, v)}; this build brought its files up to OpenDesigner {OPENDESIGNER_VERSION}. "
              f"What changed: CHANGELOG.md ({CHANGELOG_URL}).")
    print_report(rep, d)
    nudge = research_py.reminder(state_or_none(d)) if research_py else ""
    if nudge:
        print(nudge)
    return 1 if errors else 0


class PairAction(argparse.Action):
    """--path and --value in the order given: each --value belongs to the --path right before it."""

    def __call__(self, parser, namespace, values, option_string=None):
        pairs = [list(x) for x in getattr(namespace, self.dest, None) or []]
        if option_string == "--path":
            pairs.append([values, None])
        elif pairs and pairs[-1][0] is not None and pairs[-1][1] is None:
            pairs[-1][1] = values
        else:
            pairs.append([None, values])
        setattr(namespace, self.dest, pairs)


def main(argv=None):
    top = argparse.ArgumentParser(add_help=False)
    top.add_argument("--dir", default=None, help=f"state directory (default ./{DEFAULT_DIR})")
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--dir", default=argparse.SUPPRESS, help=f"state directory (default ./{DEFAULT_DIR})")
    ap = argparse.ArgumentParser(prog="engine.py", description="OpenDesigner engine (stdlib only, no network).", parents=[top])
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("init", parents=[common], help="create state.json with defaults")
    p.add_argument("--from", dest="src")
    p.add_argument("--name")
    p.add_argument("--force", action="store_true")
    for name in ("set", "pick"):
        p = sub.add_parser(name, parents=[common], help="record one decision" if name == "set" else "answer a question (answers.<Q-id>)")
        p.add_argument("path")
        p.add_argument("value", nargs="?")
        p.add_argument("--why", default=None)
        p.add_argument("--set-by", dest="set_by", default=None, help="chosen (default), confirmed_default, auto_default, assumed, delegated, reference, asset, standard")
        p.add_argument("--source-ref", dest="source_ref", default=None)
        p.add_argument("--lock", action="store_true")
        p.add_argument("--force", action="store_true", help="change a locked decision (only with the owner's consent)")
        p.add_argument("--no-doc", dest="no_doc", action="store_true", help="do not refresh DESIGN.md and PRODUCT.md")
        p.add_argument("--dry-run", dest="dry_run", action="store_true",
                       help="show what the value would change (tokens old and new, checks) and record nothing, to compare values")
    for name in ("lock", "unlock"):
        p = sub.add_parser(name, parents=[common])
        p.add_argument("path")
        p.add_argument("--no-doc", dest="no_doc", action="store_true")
    sub.add_parser("resolve", parents=[common], help="effective dials and derived parameters as JSON")
    sub.add_parser("version", parents=[common], help="this copy's OpenDesigner release, and whether the system here is up to date "
                                                     "with it (never checks online)")
    sub.add_parser("generate", parents=[common], help="write tokens/ (DTCG 2025.10 + resolver)")
    p = sub.add_parser("validate", parents=[common])
    p.add_argument("--json", action="store_true")
    p = sub.add_parser("export", parents=[common])
    p.add_argument("--format", required=True, choices=list(EXPORT_FORMATS) + ["all"])
    p = sub.add_parser("design-md", parents=[common], help="render DESIGN.md and PRODUCT.md")
    p.add_argument("--out", default=None, help="folder for DESIGN.md and PRODUCT.md (default: project root, or the state folder)")
    p = sub.add_parser("preview", parents=[common])
    p.add_argument("--open", action="store_true")
    p = sub.add_parser("overview", parents=[common], help="overview.html: the whole system on one page, with what is still missing")
    p.add_argument("--open", action="store_true")
    p = sub.add_parser("intake", parents=[common], help="fit reference measurements to proposed dials and inputs")
    p.add_argument("file")
    p.add_argument("--accept", action="store_true")
    p.add_argument("--json", action="store_true")
    p = sub.add_parser("detect", parents=[common], help="read-only: what the project folder already answers (name, platforms, "
                                                         "brand colour, font, dark mode, phase), before any question")
    p.add_argument("--project", default=None, help="the project folder (default: the folder that holds the state directory)")
    p.add_argument("--json", action="store_true")
    p = sub.add_parser("build", parents=[common], help="generate + validate, then (if no errors) export all + design-md + preview")
    p.add_argument("--force", action="store_true", help="export even when validation finds errors")
    p = sub.add_parser("sketch", parents=[common], help="Level 0: a complete coarse system from about five answers")
    p.add_argument("--name")
    p.add_argument("--brand", help="brand color hex")
    p.add_argument("--logo", help="their logo, PNG or SVG. Without --brand it writes nothing: it prints up to 3 brand-color candidates "
                                  "and the command that confirms one. With --brand it records the logo (hook H-logo)")
    p.add_argument("--audience", choices=["dense", "regular", "large"])
    p.add_argument("--platforms", help="comma list: web,ios,android,desktop,secondary")
    p.add_argument("--stack", help="comma list of the code stack (react, react-native, vue, ...); read from package.json when not given")
    p.add_argument("--feel", help="comma list of feel words in the person's own words (fun, calm, bold, techy, ...); `engine.py feel` lists them")
    p.add_argument("--brief", help="optional: the person's picture of the look in one line, in their words "
                                   "(\"a quiet library at night\"); shown on the taste card, never invented")
    p.add_argument("--delegated", nargs="?", const="all", default=None,
                   help="the person said 'just pick': record the sketch answers as delegated (all, or a comma list such as feel,brand). "
                        "A --brand hex stays the person's unless brand is named")
    p.add_argument("--theme", choices=["system-light-dark", "light-dark-toggle", "light-only", "dark-only"])
    p.add_argument("--surfaces", help="Q-scope-06, main surface first: a mode (persuade, operate, read, experience) or name:mode pairs, "
                                      "for example 'app:operate,landing page:persuade'")
    p = sub.add_parser("show", parents=[common], help="fill a visual template with real values from the current state and write it")
    p.add_argument("template", help="palette, type-scale, spacing-ruler, radius, elevation, motion, component-sheet or option-gallery")
    p.add_argument("--out", default=None, help="folder for the page (default opendesigner/preview)")
    p.add_argument("--open", action="store_true")
    p.add_argument("--json", action="store_true", help="print the payload instead of writing the page")
    p = sub.add_parser("feel", parents=[common], help="map plain feel words (fun, calm, techy...) to feel settings; no words lists them all")
    p.add_argument("words", nargs="*")
    p = sub.add_parser("style", parents=[common], help="the style lab: list, show, search, mix, mutate, explore or define visual styles")
    p.add_argument("action", choices=["list", "show", "search", "mix", "mutate", "explore", "define", "tiles"])
    p.add_argument("args", nargs="*", help="style ids, everyday words, or axis=value traits (depth=glow, color=neon)")
    p.add_argument("--n", type=int, default=4, help="how many experimental styles explore offers")
    p.add_argument("--seed", type=int, default=0, help="explore: another seed draws other directions")
    p.add_argument("--wild", action="store_true", help="explore: allow styles further from anything named")
    p.add_argument("--save", type=int, default=None, help="mix, mutate, explore: keep this numbered result as your own style")
    p.add_argument("--name", default=None, help="define or --save: the style's name")
    p.add_argument("--plain", default=None, help="define or --save: what it looks like, in plain words")
    p.add_argument("--fit", default=None, choices=["core-ui", "marketing", "illustration-only"], help="where the style may go")
    p.add_argument("--use", action="store_true", help="also pick the saved style at Q-dir-01")
    p.add_argument("--tiles", action="store_true", help="mix, mutate, explore: show the results as tiles (preview/style-tiles.html)")
    p.add_argument("--open", action="store_true", help="tiles: open the page")
    p = sub.add_parser("review", parents=[common], help="find hard-coded values that bypass tokens and stale DESIGN.md sections")
    p.add_argument("--project", default=None, help="folder to scan (default: the project root)")
    p.add_argument("--strict", action="store_true", help="exit 1 when anything is found")
    p.add_argument("--json", action="store_true")
    p = sub.add_parser("research", parents=[common], help="user research: plan it, check and add the findings, skip it, or see where it stands")
    rsub = p.add_subparsers(dest="action", required=True)
    q = rsub.add_parser("plan", parents=[common], help="the users line, what to find out, searches to start from, and the tools to look for")
    q.add_argument("--brief", default=None, help="who the users are, in one line the person confirmed")
    q.add_argument("--tools", default=None, help="the tools you have, comma list: web-search,browser,last30days,mobbin,deep-research,analytics")
    q.add_argument("--json", action="store_true")
    q = rsub.add_parser("check", parents=[common], help="check a findings file without saving it")
    q.add_argument("file")
    q.add_argument("--json", action="store_true")
    q = rsub.add_parser("add", parents=[common], help="save the findings, render research/users.md, and list what they recommend")
    q.add_argument("file")
    q.add_argument("--accept", action="store_true", help="apply the recommendations the person said yes to (set_by research)")
    q.add_argument("--only", default=None, help="with --accept: only these questions (comma list); also how to apply one that differs "
                                                 "from the person's own answer, after they agree")
    q.add_argument("--json", action="store_true")
    q = rsub.add_parser("skip", parents=[common], help="the person does not want user research; the reminders stop")
    q.add_argument("--why", required=True, help="the person's own words")
    q = rsub.add_parser("status", parents=[common], help="where the user research stands")
    q.add_argument("--json", action="store_true")
    # research.md sections 8 and 9 run in research.py; these pass their words through unchanged
    q = rsub.add_parser("market", parents=[common], help="the competitor table and the benchmark: show it before any colour")
    q.add_argument("--json", action="store_true")
    for name, subs, what in (("positioning", ("draft", "confirm", "show"), "draft the positioning, confirm it with the person, or show it"),
                             ("directions", ("check", "board", "pick"), "check the three directions, write their board, or record the pick")):
        q = rsub.add_parser(name, parents=[common], help=what)
        q.add_argument("sub", choices=subs)
        q.add_argument("rest", nargs=argparse.REMAINDER, help="passed to research.py as they are")
    p = sub.add_parser("feedback", parents=[common], help="record a gap, bug, confusing step or idea (issue link), or the owner's note on the work (--kind note)")
    p.add_argument("text", nargs="?", default="")
    p.add_argument("--kind", default=None, choices=list(FEEDBACK_KINDS) + ["note"],
                   help="default: idea (confusing with --from-journey); note: the owner's note on the work, counted in RULES.md")
    p.add_argument("--same", default=None, help="with --kind note: the earlier note (N-01) this one repeats, or new")
    p.add_argument("--from-journey", dest="from_journey", action="store_true",
                   help="add the hotspots from the journey log: question ids and counts only, never notes")
    p.add_argument("--area", default=None)
    p.add_argument("--question", default=None)
    p = sub.add_parser("standards", parents=[common], help="the standards this system follows, overridden ones and house updates")
    p.add_argument("--json", action="store_true")
    p.add_argument("--all", dest="show_all", action="store_true", help="also list the house standards for other platforms or stacks")
    p.add_argument("--update", action="store_true", help="apply new and changed house standards; overridden ones stay the person's")
    p.add_argument("--no-doc", dest="no_doc", action="store_true")
    p = sub.add_parser("standard", parents=[common], help="override, restore, add or remove one standard (always recorded)")
    ssub = p.add_subparsers(dest="action", required=True)
    q = ssub.add_parser("override", parents=[common], help="the person explicitly changes a house standard")
    q.add_argument("id")
    q.add_argument("--why", required=True, help="the person's own words")
    q.add_argument("--path", dest="pairs", action=PairAction, default=None,
                   help="take back only this value (repeatable); without --path the whole standard")
    q.add_argument("--value", dest="pairs", action=PairAction, default=None,
                   help="the new value for the --path before it (JSON); alone, for a standard that sets one value")
    q.add_argument("--all-holders", dest="all_holders", action="store_true",
                   help="also take the same values back from the other standards that set them")
    q = ssub.add_parser("restore", parents=[common], help="follow a house standard again")
    q.add_argument("id")
    q.add_argument("--why", default=None, help="the person's own words")
    q.add_argument("--all-holders", dest="all_holders", action="store_true",
                   help="also follow again the other standards that set the same values")
    q = ssub.add_parser("add", parents=[common], help="a project standard from a source the person trusts")
    q.add_argument("--rule", default=None)
    q.add_argument("--why", default=None)
    q.add_argument("--source", default=None, help="a URL or file the rule comes from, or the person's words and date: \"person, 2026-09-27\"")
    q.add_argument("--authority", default="non-negotiable", choices=["non-negotiable", "good-to-have"])
    q.add_argument("--area", default=None)
    q.add_argument("--values", default=None, help="key values as a JSON object")
    q.add_argument("--path", dest="pairs", action=PairAction, default=None, help="a token or setting path the standard sets (repeatable)")
    q.add_argument("--value", dest="pairs", action=PairAction, default=None, help="the value for the --path before it (JSON)")
    q.add_argument("--beats", default=None, help="house standard ids this rule always wins over in this project (comma list)")
    q.add_argument("--review-pattern", dest="review_pattern", default=None, help="a regular expression that finds code breaking it")
    q.add_argument("--review-message", dest="review_message", default=None)
    q.add_argument("--title", default=None)
    q = ssub.add_parser("remove", parents=[common], help="remove a project standard")
    q.add_argument("id")
    q.add_argument("--why", required=True, help="the person's own words")
    for q in ssub.choices.values():
        q.add_argument("--no-doc", dest="no_doc", action="store_true")
    a = ap.parse_args(argv)
    d = a.dir or DEFAULT_DIR
    st = state_or_none(d) if a.cmd not in ("init", "feel", "resolve", "version", "detect") and not getattr(a, "json", False) else None
    kind = version_status(st)[0] if st else "current"
    if kind == "newer" or (kind != "current" and a.cmd not in ("build", "sketch")):  # build says it after it brings files up to date
        print(version_notice(st))
    if a.cmd == "init":
        cmd_init(d, a.src, a.name, a.force)
    elif a.cmd in ("set", "pick"):
        path, value = a.path, a.value
        if value is None and "=" in path:
            path, value = path.split("=", 1)
        if value is None:
            raise SystemExit("give a value: engine.py set <path> <json-value>  (or path=value)")
        if a.cmd == "pick" and not path.startswith("answers."):
            path = "answers." + path
        cmd_set(d, path, parse_value(value), a.why, a.force, set_by=a.set_by, lock=a.lock, source_ref=a.source_ref, dry_run=a.dry_run)
        if not a.no_doc and not a.dry_run:
            refresh_docs(d)
    elif a.cmd in ("lock", "unlock"):
        cmd_lock(d, a.path, a.cmd == "lock")
        if not a.no_doc:
            refresh_docs(d)
    elif a.cmd == "detect":
        return cmd_detect(d, a.project, a.json)
    elif a.cmd == "resolve":
        cmd_resolve(d)
    elif a.cmd == "version":
        return cmd_version(d)
    elif a.cmd == "generate":
        cmd_generate(d)
    elif a.cmd == "validate":
        rep = validate_dir(d)
        print_report(rep, d, a.json)
        if rep.count("error"):
            track(d, "error", step="validate", count=rep.count("error"))
        return 1 if rep.count("error") else 0
    elif a.cmd == "export":
        cmd_export(d, a.format)
        track(d, "export", kind=a.format)
    elif a.cmd == "design-md":
        cmd_design_md(d, a.out)
    elif a.cmd == "preview":
        cmd_preview(d, a.open)
    elif a.cmd == "overview":
        cmd_overview(d, a.open)
    elif a.cmd == "intake":
        cmd_intake(d, a.file, a.accept, a.json)
    elif a.cmd == "build":
        return cmd_build(d, a.force)
    elif a.cmd == "sketch":
        return cmd_sketch(d, a.name, a.brand, a.audience, a.platforms, a.feel, a.theme, surfaces=a.surfaces, delegated=a.delegated,
                          stack=a.stack, brief=a.brief, logo=a.logo)
    elif a.cmd == "feel":
        return cmd_feel(a.words)
    elif a.cmd == "style":
        return cmd_style(d, a.action, a.args, n=a.n, seed=a.seed, wild=a.wild, save=a.save, name=a.name, plain=a.plain, fit=a.fit,
                         use=a.use, tiles=a.tiles, open_=a.open)
    elif a.cmd == "show":
        cmd_show(d, a.template, a.out, a.open, a.json)
    elif a.cmd == "review":
        return cmd_review(d, a.project, a.strict, a.json)
    elif a.cmd == "standards":
        res = {}
        cmd_standards(d, a.json, a.update, a.show_all, result=res)
        if a.update and not a.no_doc and res.get("changed"):  # a no-op update rewrites nothing (R26)
            refresh_docs(d)
    elif a.cmd == "standard":
        pairs = [[p, parse_value(v) if v is not None else None] for p, v in getattr(a, "pairs", None) or []]
        cmd_standard(d, a.action, sid=getattr(a, "id", None), why=getattr(a, "why", None), rule=getattr(a, "rule", None),
                     source=getattr(a, "source", None), authority=getattr(a, "authority", "non-negotiable"), area=getattr(a, "area", None),
                     values=getattr(a, "values", None), review_pattern=getattr(a, "review_pattern", None),
                     review_message=getattr(a, "review_message", None), title=getattr(a, "title", None), pairs=pairs,
                     all_holders=getattr(a, "all_holders", False), beats=getattr(a, "beats", None))
        if not a.no_doc:
            refresh_docs(d)
    elif a.cmd == "research":
        if not research_py:
            raise SystemExit("research.py is missing next to engine.py, so user research is not available in this copy.")
        if a.action == "check":  # a findings file can be checked before any system exists
            return research_py.check(a.file, a.json)
        rest = list(getattr(a, "rest", []))
        while "--dir" in rest[:-1]:  # --dir after the sub-word lands in rest; it is the engine's option, not research.py's
            i = rest.index("--dir")
            d = rest[i + 1]
            del rest[i:i + 2]
        if not os.path.exists(os.path.join(d, STATE_FILE)):
            raise SystemExit(f"no state at {os.path.join(d, STATE_FILE)}; run the sketch first (engine.py sketch ...).")
        if a.action == "plan":
            research_py.plan(sys.modules[__name__], d, a.brief, a.tools, a.json)
        elif a.action == "add":
            return research_py.add(sys.modules[__name__], d, a.file, a.accept, a.only, a.json)
        elif a.action == "skip":
            return research_py.skip(sys.modules[__name__], d, a.why)
        elif a.action == "status":
            return research_py.status(d, merge_defaults(load_state(d)), a.json)
        elif a.action == "market":
            return research_py.main(["--dir", d, "market"] + (["--json"] if a.json else []))
        else:
            return research_py.main(["--dir", d, a.action, a.sub, *rest])
    elif a.cmd == "feedback":
        os.makedirs(d, exist_ok=True)
        text = a.text
        if a.from_journey and a.kind == "note":
            raise SystemExit("--from-journey adds log hotspots to feedback about OpenDesigner, not to a note.")
        if a.from_journey:
            hot = journey.feedback_text(d) if journey else ""
            if not hot:
                raise SystemExit("There is no journey log yet, so there are no hotspots to add.")
            text = f"{text} {hot}".strip()
        cmd_feedback(d, text, a.kind or ("confusing" if a.from_journey else "idea"), area=a.area, question=a.question, same=a.same)
    return 0



# =============================================================================================
# Zoom levels, sketch (Level 0), review, feedback (BRIEF requirements 12-16)
# =============================================================================================

def answered_ids(state, decs=None, for_zoom=False):
    """{question id: set_by} for every question answered: answers.<Q-id>, plus the sketch paths that answer one
    (context.product, raw.brandColor, macros, the logo hook; ANSWER_PATHS)."""
    out = {}
    for q, rec in (state.get("answers") or {}).items():
        if for_zoom and isinstance(rec, dict) and rec.get("via") in ("sketch", "repo") and (questions().get(q) or {}).get("zoom", 0):
            continue  # a sketch answer (for example the theme) or a reading from the repo does not zoom its area in
        out[q] = (rec.get("set_by") if isinstance(rec, dict) else None) or "chosen"
    for path, (q, _how) in ANSWER_PATHS.items():
        v = get_path(state, path)
        if v not in (None, "", [], {}, "pending") and q not in out:
            out[q] = ((decs or {}).get(path) or {}).get("set_by", "chosen")
    return out


def zoom_levels(d, state):
    """Each area's zoom (BRIEF req. 14-15, U5 F23): the explicit state.zoom value when the model recorded one, else
    inferred from the zoom level of the questions answered in the area. Level k counts once at least half of the area's
    level-k questions are answered (delegated counts, auto defaults do not), and every lower level with questions
    counts too. A sketch alone reads 'sketch' everywhere."""
    decs = _decisions(d)
    answered = answered_ids(state, decs)
    counted = answered_ids(state, decs, for_zoom=True)
    qs = questions()
    out = {}
    for key, title in ZOOM_AREAS:
        rx = SECTION_PATHS.get(title)
        n = sum(1 for k, v in decs.items() if rx and re.match(rx, k) and v["set_by"] != "auto_default")
        by = {1: [], 2: [], 3: []}
        site = site_surface(state)
        for q in qs.values():
            if q.get("area") == key and q.get("zoom") in by and (site or q.get("when") != "persuade"):
                by[q["zoom"]].append(q["id"])
        lvl = 0
        for k in (1, 2, 3):
            if not by[k]:
                continue
            done = [q for q in by[k] if counted.get(q) not in (None, "auto_default", "standard")]
            if len(done) * 2 >= len(by[k]):
                lvl = k
            else:
                break
        explicit = (state.get("zoom") or {}).get(key)
        if explicit in ZOOM_LEVELS:
            lvl = ZOOM_LEVELS.index(explicit)  # the model recorded the level it ran; never infer past it
        nxt = []
        for k in range(lvl + 1, 4):
            nxt = [q for q in by.get(k, []) if q not in answered][:3]
            if nxt:
                break
        if not qs:
            nxt = [q for q in ZOOM_NEXT.get(key, []) if q not in answered]
        out[key] = {"level": ZOOM_LEVELS[lvl], "decisions": n, "next": nxt}
    return out


AUDIENCE_WORDS = {"dense": "people who use it all day for work, in screens full of data",
                  "regular": "people who use it often, as an everyday app",
                  "large": "people who use it now and then, often on a phone"}
SKETCH_FLAGS = ("name", "brand", "audience", "platforms", "feel", "theme", "surfaces", "brief")


def normalize_hex(v):
    """'2563eb', '#2563EB' or '#abc' -> '#2563eb'; None when it is not a hex color."""
    if not isinstance(v, str):
        return None
    t = v.strip().lower()
    t = t if t.startswith("#") else "#" + t
    if re.fullmatch(r"#[0-9a-f]{3}", t):
        t = "#" + "".join(c * 2 for c in t[1:])
    return t if re.fullmatch(r"#[0-9a-f]{6}", t) else None


def color_words(hx):
    """A color in plain words, 'a deep blue' or 'an orange', from its OKLCH lightness, chroma and hue (R44)."""
    L, C, H = hex_to_oklch(hx)
    if C < 0.03:
        name = "near-black" if L < 0.3 else "off-white" if L > 0.93 else ("dark " if L < 0.45 else "light " if L > 0.8 else "") + \
            (("cool " if 180 <= H < 300 else "warm ") if C >= 0.012 else "") + "gray"
    else:
        name = next(n for top, n in ((18, "pink"), (40, "red"), (75, "orange"), (120, "yellow"), (165, "green"), (215, "teal"),
                                     (280, "blue"), (315, "purple"), (345, "magenta"), (361, "pink")) if H < top)
        name = {("pink", True): "crimson", ("orange", True): "brown", ("yellow", True): "olive", ("blue", True): "navy"}.get(
            (name, L < (0.65 if name in ("pink", "yellow") else 0.6 if name == "orange" else 0.4)), name)
        if name not in ("crimson", "brown", "olive", "navy"):
            name = ("deep " if L < 0.45 else "light " if L > 0.8 else "bright " if C > 0.2 else "") + name
    return ("an " if name[0] in "aeiou" else "a ") + name


def readable_shade(hx, ratio=4.5):
    """hx when white or dark text reads on it at ratio (exact_text_on), else the shade of it (same hue and chroma where the
    gamut allows) that white text reads on at ratio, with the engine's 2% margin. Only for a color the model picked: a hex
    the person typed is never replaced (build_palette keeps it and adds a readable shade for fills that carry text)."""
    if exact_text_on(hx, ratio):
        return hx
    L, C, H = hex_to_oklch(hx)
    L2, C2 = solve_L(H, C, target_y(ratio * MARGIN, 1.0, True))
    out = oklch_to_hex(L2, C2, H)
    while contrast(out, "#ffffff") < ratio * MARGIN and L2 > 0:  # 8-bit rounding can land a hair short
        L2 -= 0.002
        out = oklch_to_hex(L2, min(C2, max_chroma(L2, H)), H)
    return out.lower()


def brand_delegated(d):
    """True when the model picked the brand color for the person (sketch --delegated brand): the latest decision says so."""
    return (_decisions(d).get("raw.brandColor") or {}).get("set_by") == "delegated"


def typed_brand(d, state):
    """(typed hex, decision id) when an older sketch replaced the hex the person typed with a readable shade, and that shade
    is still the brand color (STRESS-TEST 1); else (None, None). A color set since then is never undone."""
    last = next((x for x in reversed(_decision_log(d)) if x["path"] == "raw.brandColor"), None)
    m = re.search(r"a readable shade of (#[0-9a-fA-F]{6})", (last or {}).get("reason") or "")
    cur = normalize_hex((state.get("raw") or {}).get("brandColor") or "")
    if not m or not cur or normalize_hex(str(parse_value(last["value"]))) != cur or normalize_hex(m.group(1)) == cur:
        return None, None
    return normalize_hex(m.group(1)), last["id"]


def brand_line(meta, state, plain=False, delegated=False, hexes=False):
    """One line on what happened to the person's brand color (U5 F10): kept exactly, or changed and why, in light and dark
    mode, plus any secondary color that could not stay exact on fills that carry text. plain: no ratio or token name, and no
    hex unless hexes (DESIGN.md's summary names the colors), so a chat reply can pass it on as it is in the plain voice
    (zoom.md, R44). delegated: the model picked the color, so the line describes it in words instead of calling it theirs."""
    raw = state.get("raw") or {}
    brand = raw.get("brandColor")
    ci = (meta or {}).get("color") or {}
    if not brand:
        return ""
    B = brand.upper()
    tm = ci.get("textMin", 4.5)
    hx = lambda h: f" ({h.upper()})" if hexes or not plain else ""
    shade = lambda adj, base: "darker" if luminance(adj) < luminance(base) else "lighter"
    act = "action" in (ci.get("ramps") or [])  # buttons use raw.primaryActionColor; the brand marks the rest (as colors_lead says)
    fills = "brand fills" if act else "buttons"
    act_note = f" Buttons use your primary action color{hx(raw.get('primaryActionColor') or '')}." if act else ""
    dark = ""  # dark solids carry dark text (Material 80/20); a color too dark for it gets a lighter shade there (STRESS-TEST 6)
    if (raw.get("flags") or {}).get("darkMode", True) and ci.get("brandDark") and ci.get("brandExact") is not False \
            and not ci.get("brandPinnedDark"):
        dk = ci["brandDark"]
        dark = (f" In dark mode, {fills} use a lighter shade of it{hx(dk)}, so their dark text reads clearly." if plain else
                f" In dark mode, {fills} use {dk.upper()}, a lighter shade of it, because the dark text on dark-mode {fills} would read at "
                f"only {ci.get('brandContrastDarkMode') or 0.0:.2f}:1 on the exact color.")
    dark += act_note
    rest = ""
    for x in ci.get("secondary") or []:
        if not x.get("pinnedLight"):
            nth = "second" if x["ramp"] == "accent2" else "third"
            rest += (f" Your {nth} color{hx(x['hex'])} gets the same care: neither white nor dark text is easy to read on it, so its fills "
                     f"with text use a {shade(x['light'], x['hex'])} shade{hx(x['light'])}, and the exact color stays for art and large areas."
                     if plain else
                     f" Your {nth} color {x['hex'].upper()} takes neither white text ({x['contrastWhite']:.2f}:1) nor dark text "
                     f"({x['contrastDark']:.2f}:1) at {tm:g}:1, so its fills that carry text use {x['light'].upper()}; the exact color stays "
                     f"in color.{x['ramp']}.seed.")
        elif not x.get("pinnedDark") and (raw.get("flags") or {}).get("darkMode", True) and not plain:
            nth = "second" if x["ramp"] == "accent2" else "third"
            rest += f" Your {nth} color {x['hex'].upper()} is exact on its fills; in dark mode they use {x['dark'].upper()}, a lighter shade of it."
    if delegated:  # a chat line when plain without hexes, else a line for the documents
        shown = brand if ci.get("pinnedStep") else (ci.get("brandAdjustedTo") or brand)
        cw = contrast(shown, "#ffffff")
        text = "" if act else ", with white text that reads clearly on it" if cw >= tm else ", with dark text on it"
        marks = "links, selection and focus" if act else "buttons, links and focus"
        if plain and not hexes:
            return f"I picked {color_words(shown)} for {marks}{text}.{dark}{rest} Say if you want another color."
        return f"Picked for you, not chosen by you: {color_words(shown)}{hx(shown)} on {marks}{text}.{dark}{rest}"
    where = "marks links, selection and focus, and is on brand fills exactly" if act else "is on the buttons exactly"
    others = "brand fills" if act else "buttons and other fills"
    if plain:
        if ci.get("pinnedStep"):
            cw = ci.get("brandContrastWhite") or contrast(brand, "#ffffff")
            return f"Your brand color{hx(brand)} {where}" + (
                ", with white text that reads clearly on it." if cw >= tm else ", with dark text on it, because white text would be too faint.") + dark + rest
        if ci.get("brandPinFailed"):
            adj = ci.get("brandAdjustedTo") or brand
            return (f"Neither white nor dark text is easy to read on your brand color{hx(brand)}, so {others} with text use "
                    f"a {shade(adj, brand)} shade of it{hx(adj)}. Your exact color stays for the logo, large color areas and anything "
                    f"without text.{dark}{rest}")
        if ci.get("brandExact") is False:
            return f"{fills.capitalize()} use a shade{hx(ci.get('brandAdjustedTo') or brand)} made from your brand color.{act_note}"
        return (act_note + rest).strip()
    if ci.get("pinnedStep"):
        cw = ci.get("brandContrastWhite") or contrast(brand, "#ffffff")
        tail = f"white text on it reads at {cw:.2f}:1" if cw >= tm else "dark text on it, because white text would be too faint"
        return f"Your brand color {B} {where} ({tail}).{dark}{rest}"
    if ci.get("brandPinFailed"):
        adj = (ci.get("brandAdjustedTo") or "").upper()
        cw = ci.get("brandContrastWhite") or contrast(brand, "#ffffff")
        cd = ci.get("brandContrastDark") or 0.0
        return (f"Your brand color {B} takes neither white text ({cw:.2f}:1) nor dark text ({cd:.2f}:1) at the {tm:g}:1 that text needs, "
                f"so {others} that carry text use {adj}, a {shade(adj, brand)} shade of it. The exact color stays in "
                f"color.brand.seed for the logo, large color areas and anything without text.{dark}{rest}")
    if ci.get("brandExact") is False:
        adj = (ci.get("brandAdjustedTo") or "").upper()
        return f"{fills.capitalize()} use {adj}, made from your color {B} (Q-color-01: generate from a seed).{act_note}"
    return (act_note + rest).strip()


COLOR_WORDS = {"red", "orange", "yellow", "green", "teal", "blue", "navy", "purple", "violet", "pink", "brown", "black", "white", "gray",
               "grey", "gold", "silver", "cyan", "magenta", "maroon", "lime", "indigo", "turquoise", "beige", "cream"}


def cmd_feel(words):
    """Show how plain feel words map onto the twelve feel settings (macros); with no words, list the words it knows."""
    table = (levers().get("feelWords") or {}).get("words") or {}
    if not words:
        by = {}
        for w, ids in sorted(table.items()):
            by.setdefault(", ".join(ids), []).append(w)
        print("Feel words the engine understands (any other word is asked about, never rejected):")
        for ids, ws in sorted(by.items()):
            print(f"  {ids}: {', '.join(ws)}")
        looks = {}
        for w, ids in sorted(((styles_doc().get("styleWords") or {}).get("words") or {}).items()):
            looks.setdefault(ids[0], []).append(w)
        print("\nLook words, and the named style each one starts from (references/styles.md):")
        for sid, ws in sorted(looks.items(), key=lambda kv: style_list()[kv[0]]["name"].lower()):
            print(f"  {style_list()[sid]['name']}: {', '.join(ws)}")
        return 0
    _m, mapping, unknown, looks, look_only, _s = feel_and_looks(words)
    names = lambda ids: ", ".join(style_list()[s]["name"] for s in ids)
    for w in words:
        if w in mapping:
            also = looks.get(w)
            print(f"{w} -> {', '.join(mapping[w])}" + (f". Looks to show: {names(also)}" if also else ""))
        elif w in look_only:
            ids = looks[w]
            print(style_words_line(ids[0], w) + (f". Also show: {names(ids[1:])}" if ids[1:] else ""))
            if style_list()[ids[0]].get("note"):
                print(f"  {style_list()[ids[0]]['note']}")
        elif w in looks:  # a mood or a single trait: it suggests looks, it never starts one
            print(f"{w} -> looks to show: {names(looks[w][:4])}")
    for w in unknown:
        traits, _u = words_to_traits([w])
        if traits:  # no name yet, but the words describe traits: the style lab can find or build it
            near = [style_list()[sid]["name"] for sid, _sc, _why in search_styles([w], n=3)]
            print(f"{w} -> no named style yet; it describes {trait_words_line(traits)}"
                  + (f". Closest: {', '.join(near)}" if near else "") + f". Try: engine.py style explore \"{w}\"")
        else:
            print(f"{w} -> not known yet: is it closer to playful, calm, bold, friendly or serious?")
    return 0


# =============================================================================================
# Style lab: search, mix, mutate, explore and define styles on the 12 trait axes (references/style-lab.md)
# =============================================================================================

STRUCTURE_AXES = ("shape", "type", "scale", "layout", "density", "theme")  # bones: keep them typical, people read layout first
SKIN_AXES = ("surface", "edge", "depth", "color", "contrast", "texture", "imagery", "ornament", "motion")  # skin: where novelty pays
NEUTRAL_TRAITS = {"surface": "solid", "edge": "hairline", "depth": "ring", "shape": "subtle", "color": "neutral-accent", "contrast": "normal",
                  "type": "neo-grotesque", "scale": "moderate", "texture": "none", "imagery": "none", "ornament": "none", "layout": "grid",
                  "density": "balanced", "motion": "subtle", "theme": "light-first"}
CALM = {"surface": "solid", "edge": "hairline", "depth": "ring", "color": "vivid", "contrast": "normal", "texture": "none",
        "imagery": "illustration", "ornament": "none", "motion": "subtle"}


def _norm_words(phrase):
    return re.sub(r"\s+", " ", str(phrase).lower().strip().strip("!.?,;:'\"()"))


def words_to_traits(words):
    """({axis: value, 'motionRisks': [...]}, unknown words) from everyday words via styles.json traitWords: longer phrases win,
    first mention wins."""
    table = {}
    for ax, vals in ((styles_doc().get("traitWords") or {}).get("words") or {}).items():
        for v, ws in vals.items():
            for w in ws:
                table.setdefault(w.lower(), (ax, v))
    traits, unknown = {}, []
    for phrase in words:
        norm = _norm_words(phrase)
        hits = sorted(((m.start(), -len(k), k) for k in table for m in [re.search(rf"(?<![\w-]){re.escape(k)}(?![\w-])", norm)] if m))
        taken = []
        for pos, neg, k in hits:  # skip a word inside a longer phrase already taken ("glow" inside "neon glow")
            if any(p <= pos < p + n for p, n in taken):
                continue
            taken.append((pos, -neg))
            ax, v = table[k]
            if ax == "motionRisks":
                traits.setdefault(ax, [])
                if v not in traits[ax]:
                    traits[ax].append(v)
            else:
                traits.setdefault(ax, v)
        if not taken:
            unknown.append(phrase)
    return traits, unknown


def trait_words_line(traits, limit=4):
    """Plain words for the traits that stand out from a neutral system: 'see-through frosted panels and a soft colored glow'."""
    axes = styles_doc().get("axes") or {}
    parts = [axes[ax]["values"][v] for ax, v in traits.items() if ax in axes and v in axes[ax]["values"] and NEUTRAL_TRAITS.get(ax) != v]
    parts = parts[:limit] or ["a quiet neutral look"]
    return ", ".join(parts[:-1]) + (" and " if len(parts) > 1 else "") + parts[-1]


def trait_distance(a, b, axes=STYLE_AXES):
    return sum(1 for ax in axes if (a or {}).get(ax) != (b or {}).get(ax))


def nearest_style(traits, state=None, exclude=()):
    """(style id, distance) of the closest look in the catalogue and the person's own styles."""
    looks = [(sid, trait_distance(traits, s.get("traits"))) for sid, s in style_list(state).items()
             if s.get("kind") == "look" and s.get("traits") and sid not in exclude]
    return min(looks, key=lambda x: (x[1], x[0])) if looks else (None, len(STYLE_AXES))


def search_styles(words, state=None, n=6):
    """[(style id, score, why)] for everyday words: look words, names and aliases, then shared traits."""
    words = list(words) + ([" ".join(words)] if len(words) > 1 else [])  # "old computer" as a phrase as well as two words
    looks = look_words(words)
    traits, _u = words_to_traits(words)
    traits.pop("motionRisks", None)
    norm = [_norm_words(w) for w in words]
    tokens = {t for w in norm for t in re.split(r"[\s/,-]+", w) if len(t) > 2 and t not in FEEL_STOP | {"style", "look", "design", "but"}}
    out = []
    for sid, s in style_list(state).items():
        score, why = 0, []
        for p, ids in looks.items():
            if sid in ids:
                score += 6 - min(ids.index(sid), 3)
                why.append(f"'{p}'")
        names = {s["name"].lower(), sid, sid.replace("-", " ")} | {a.lower() for a in s.get("aliases", [])}
        if any(w in names for w in norm):
            score += 5
            why.append("its name")
        hay = re.findall(r"[a-z0-9]+", " ".join([s["name"], s.get("plain", "")] + list(s.get("aliases") or [])
                                                 + list(s.get("people_say") or [])).lower())
        said = sorted(t for t in tokens if t in hay or (t.endswith("s") and t[:-1] in hay))  # words in its own description
        score += len(said)
        why += [f"says '{t}'" for t in said]
        shared = [ax for ax, v in traits.items() if (s.get("traits") or {}).get(ax) == v]
        score += 2 * len(shared)
        why += [f"{ax} {traits[ax]}" for ax in shared]
        if score:
            out.append((sid, score, why))
    return sorted(out, key=lambda x: (-x[1], x[0]))[:n]


def _loud(t, risks=()):
    return [a for a in LOUD if t.get(a) in LOUD[a]] + (["texture"] if t.get("texture", "none") != "none" else []) + (["motion risks"] if risks else [])


def guard_traits(traits, ui_fit="core-ui", risks=()):
    """Repair a combination so it can ship: one surface effect (DC-L19-67), no pile of loud traits (S-L19-045), no glass or
    texture on dense reading screens, neon on dark. Returns (traits, plain notes). The floors themselves are never traded."""
    t, notes = dict(traits), []
    t.pop("motionRisks", None)
    effects = [(ax, t[ax]) for ax in ("depth", "surface") if (ax, t.get(ax)) in SURFACE_EFFECTS]
    for ax, v in effects[1:]:
        t[ax] = CALM[ax]
        notes.append(f"kept one surface effect ({effects[0][1]}), so {v} became {t[ax]} (DC-L19-67)")
    cap = 4 if ui_fit == "marketing" else 3
    for ax in ("motion", "ornament", "imagery", "texture", "color", "edge", "surface", "depth"):
        loud = _loud(t, risks)
        if len(loud) <= cap:
            break
        if ax in loud:
            notes.append(f"too many loud traits at once, so {ax} {t[ax]} became {CALM[ax]} (S-L19-045)")
            t[ax] = CALM[ax]
    if t.get("density") == "dense" and t.get("texture", "none") != "none":
        notes.append(f"no {t['texture']} texture on dense data screens")
        t["texture"] = "none"
    if t.get("density") == "dense" and (t.get("depth") == "glass" or t.get("surface") == "translucent"):
        t["density"] = "balanced"
        notes.append("glass does not go on dense reading screens, so the density became balanced (DC-L04-15)")
    if t.get("color") == "neon" and t.get("theme") != "dark-first":
        t["theme"] = "dark-first"
        notes.append("neon reads on dark screens, so it is designed dark first (text still meets 4.5:1)")
    if (t.get("depth") == "glass" or t.get("surface") == "translucent") and t.get("imagery") in ("photo", "3d"):
        notes.append("put a 35% dimming layer under clear glass over bright pictures, and check text at the worst spot (S-L15-073)")
    if t.get("contrast") == "low":
        notes.append("low contrast applies to decoration only: text keeps 4.5:1 and edges 3:1")
    if t.get("shape") == "pixel" and t.get("type") not in ("pixel", "mono"):
        notes.append("pixel shapes read best with pixel or monospace letters for headlines")
    if t.get("type") in ("pixel", "script", "blackletter", "handwritten", "display"):
        notes.append(f"{t['type']} letters for headlines only; body text stays a readable face")
    if t.get("motion") in ("glitchy", "bouncy"):
        notes.append(f"{t['motion']} motion gets a still version under reduced motion")
    risk_text = styles_doc().get("motionRisks") or {}
    notes += [risk_text[r] for r in risks if r in risk_text]
    return t, notes


def _style_entry(name, traits, ui_fit, parents, how, plain=None, notes=(), risks=()):
    risks = sorted(set(list(risks) + list((traits or {}).get("motionRisks") or [])))
    t, fixes = guard_traits(traits, ui_fit, risks)
    preset, _d, build = style_from_traits(t, ui_fit)
    sid = "x-" + slug(name)[:46].strip("-")
    near, dist = nearest_style(t)
    bones = trait_distance(t, style_list().get(near, {}).get("traits"), STRUCTURE_AXES) if near else 0
    return {"id": sid, "name": name, "plain": plain or trait_words_line(t), "kind": "look", "ui_fit": ui_fit, "traits": t,
            "motionRisks": risks, "preset": preset, "parents": list(parents), "experimental": True, "coined": True, "how": how,
            "novelty": dist, "bonesNovelty": bones, "nearest": near, "notes": list(notes) + fixes,
            "built": {k: v for k, v in build.items() if v not in (None, 1)}}


def blend_styles(a, b):
    """a's bones (shape, type, scale, layout, density, theme) dressed in b's skin (surface, edge, depth, color, contrast, texture,
    imagery, ornament, motion)."""
    t = {ax: (a["traits"] if ax in STRUCTURE_AXES else b["traits"]).get(ax, NEUTRAL_TRAITS[ax]) for ax in STYLE_AXES}
    fit = "marketing" if "marketing" in (a.get("ui_fit"), b.get("ui_fit")) else "core-ui"
    return _style_entry(f"{a['name']} in {b['name']} skin", t, fit, [a["id"], b["id"]], "blend", risks=b.get("motionRisks") or ())


def mutate_style(s, changes):
    t = dict(s["traits"], **{k: v for k, v in changes.items() if k in STYLE_AXES})
    words = " and ".join(styles_doc()["axes"][ax]["values"][v] for ax, v in changes.items() if ax in STYLE_AXES)
    return _style_entry(f"{s['name']} with {words}", t, s.get("ui_fit", "core-ui"), [s["id"]], "mutation",
                        risks=list(s.get("motionRisks") or []) + list(changes.get("motionRisks") or []))


NOVELTY_BUDGET = {  # (fewest, most) traits away from the nearest named look, and most of them in the bones [inferred from
    None: (3, 7, 2),          # Hekkert 2003, Tuch 2012 and Reinecke 2013: novelty pays while the bones stay typical]
    "core-ui": (2, 5, 1),
    "marketing": (4, 7, 2),
    "wild": (3, 10, len(STRUCTURE_AXES)),
}


def explore_styles(words=(), seeds=(), n=4, seed=0, wild=False, state=None, fit=None):
    """Experimental styles near the person's words: blends of the closest named looks (bones of one, skin of another) and
    mutations toward far ones. Each is repaired by guard_traits, kept new but recognizable by NOVELTY_BUDGET (fit core-ui keeps
    the bones of a core-ui style), and spread out farthest-first so no two are alike. The same words and seed give the same draw."""
    import random
    rng = random.Random(seed)
    catalogue = {sid: s for sid, s in style_list(state).items() if s.get("kind") == "look" and s.get("traits")}
    base = [catalogue[s] for s in seeds if s in catalogue]
    if not base and words:
        base = [catalogue[sid] for sid, _sc, _w in search_styles(words, state, n=12) if sid in catalogue][:4]
    if len(base) < 2:
        base += rng.sample(sorted([s for s in catalogue.values() if s not in base], key=lambda s: s["id"]), 4 - len(base))
    forced, _u = words_to_traits(words)
    bones_ok = (lambda s: s.get("ui_fit") == "core-ui") if fit == "core-ui" else (lambda s: True)
    cands = []
    for a in base:
        for b in base:
            if a is not b and bones_ok(a):
                cands.append(blend_styles(a, b))
        far = sorted(catalogue.values(), key=lambda s: (-trait_distance(a["traits"], s["traits"]), s["id"]))[:6]
        f = rng.choice(far)
        if bones_ok(a):
            cands.append(blend_styles(a, f))
        diff = [ax for ax in SKIN_AXES if f["traits"].get(ax) != a["traits"].get(ax)]
        if diff:
            ax = rng.choice(diff)
            cands.append(mutate_style(a, {ax: f["traits"][ax]}))
    lo, hi, bones_max = NOVELTY_BUDGET["wild" if wild else fit if fit in NOVELTY_BUDGET else None]
    out, seen = [], set()
    for c in cands:
        if forced:  # the person's own trait words always hold
            c = _style_entry(c["name"], dict(c["traits"], **forced), fit or c["ui_fit"], c["parents"], c["how"], risks=c["motionRisks"])
        elif fit and fit != c["ui_fit"]:
            c = _style_entry(c["name"], c["traits"], fit, c["parents"], c["how"], risks=c["motionRisks"])
        key = tuple(c["traits"][ax] for ax in STYLE_AXES)
        if key in seen or not lo <= c["novelty"] <= hi or c["bonesNovelty"] > bones_max:
            continue
        seen.add(key)
        out.append(c)
    picked = []
    while out and len(picked) < n:  # farthest-first, so the directions differ from each other
        best = max(out, key=lambda c: (min([trait_distance(c["traits"], p["traits"]) for p in picked] or [99]), c["novelty"], c["id"]))
        picked.append(best)
        out.remove(best)
    return picked


def custom_style_from(d, name, base=None, changes=None, plain=None, ui_fit=None, dials=None, parents=None, how="define", risks=()):
    """Save the person's own or experimental style into state customStyles (a decision, logged), ready for pick Q-dir-01. A name
    made here is marked coined: it is the person's, not a known style."""
    state = merge_defaults(load_state(d))
    src = style_list(state).get(base) if base else None
    if base and not src:
        raise SystemExit(f"No style '{base}'. See: engine.py style list")
    traits = dict((src or {}).get("traits") or NEUTRAL_TRAITS, **(changes or {}))
    fit = ui_fit or (src or {}).get("ui_fit") or "core-ui"
    entry = _style_entry(name, traits, fit, parents or ([base] if base else []), how, plain=plain,
                         risks=list(risks) + list((src or {}).get("motionRisks") or []))
    sid = entry["id"]
    if sid in {s["id"] for s in styles_doc().get("list", [])}:
        raise SystemExit(f"{sid} is a catalogue style; pick another name.")
    keep = {k: entry[k] for k in ("name", "plain", "kind", "ui_fit", "traits", "motionRisks", "parents", "experimental", "coined", "how", "notes")}
    if dials:
        keep["dialOverrides"] = dials
    cmd_set(d, f"customStyles.{sid}", keep, f"style lab: {how} '{name}' ({entry['plain']})", quiet=True)
    return sid, entry


def _parse_traits(tokens):
    """axis=value tokens -> ({axis: value}, other words); an unknown axis or value stops with the list to choose from."""
    axes = styles_doc().get("axes") or {}
    traits, words = {}, []
    for tkn in tokens:
        if "=" in tkn and tkn.split("=", 1)[0] in STYLE_AXES:
            ax, v = tkn.split("=", 1)
            if v not in axes[ax]["values"]:
                raise SystemExit(f"{ax} takes one of: {', '.join(axes[ax]['values'])}")
            traits[ax] = v
        else:
            words.append(tkn)
    return traits, words


def style_taste(d, state, ids):
    """Each style's fit to the person's taste index and the red lines it crosses, judged only on the dials the style itself
    sets (references/taste.md); {} when the project has no taste index. A style is never recommended without this."""
    index = taste_index(d, state) if state is not None and taste_py else None
    if not index:
        return {}
    eng = sys.modules[__name__]
    out = {}
    for sid in ids:
        dials = taste_py._look_dials(eng, state, sid)
        out[sid] = {"fit": taste_py.fit(index, dials), "redLines": taste_py.crossed(index, dials)}
    return out


def style_taste_words(t):
    """' · fit 82%', or ' · past a line you drew: too soft' for one style; '' when the index says nothing about it."""
    if not t:
        return ""
    if t["redLines"]:
        return " · past a line you drew: " + ", ".join(taste_py.line_text(r, plain=True) for r in t["redLines"])
    return f" · fit {round(t['fit'] * 100)}%" if t["fit"] is not None else ""


def _print_style(s, state=None, full=False):
    built = {k: v for k, v in (s.get("build") or s.get("built") or {}).items() if v not in (None, 1)}
    print(f"{s['name']} ({s['id']}): {s.get('plain', '')}")
    if s.get("traits"):
        print("  traits: " + ", ".join(f"{ax} {s['traits'][ax]}" for ax in STYLE_AXES if ax in s["traits"]))
    print(f"  built on preset {s.get('preset') or 'none (pairs with a look)'}" + (f"; also builds {json.dumps(built)}" if built else "")
          + (f"; fits {s['ui_fit']}" if s.get("ui_fit") else ""))
    if s.get("novelty") is not None and s.get("nearest"):
        print(f"  new: {s['novelty']} of {len(STYLE_AXES)} traits differ from the nearest named style "
              f"({style_list(state)[s['nearest']]['name']}), {s.get('bonesNovelty', 0)} of them in the bones")
    if s.get("coined") or s.get("custom"):
        print("  made here: a name you coined, not a known style")
    if s.get("motionRisks"):
        print("  motion techniques: " + ", ".join(s["motionRisks"]))
    for k in ("note", "fits", "goes_wrong", "accessibility", "origin"):
        if full and s.get(k):
            print(f"  {k.replace('_', ' ')}: {s[k]}")
    for note in s.get("notes") or []:
        print(f"  note: {note}")
    if full and s.get("sources"):
        print("  sources: " + "; ".join(src.get("url", "") for src in s["sources"][:4]))


def style_tiles(d, state, ids, extra=None, open_=False):
    """The option gallery with these styles as directions, each built for real from the person's state (or a blank one).
    extra: experimental styles not saved yet, shown without touching the state on disk."""
    s = merge_defaults(copy.deepcopy(state or default_state("Your product")))
    for sid, c in (extra or {}).items():
        s.setdefault("customStyles", {})[sid] = {k: c[k] for k in ("name", "plain", "kind", "ui_fit", "traits", "motionRisks") if k in c}
    every = style_list(s)
    labels = {sid: every[sid]["name"] + (" (new)" if sid in (extra or {}) else "") for sid in ids}
    return cmd_show(d, "option-gallery", open_=open_, values=list(ids), labels=labels, state=s, filename="style-tiles")


def cmd_style(d, action, args, n=4, seed=0, wild=False, save=None, name=None, plain=None, fit=None, use=False, tiles=False, open_=False):
    """engine.py style list|show|search|mix|mutate|explore|define|tiles (references/style-lab.md)."""
    state = merge_defaults(load_state(d)) if os.path.exists(os.path.join(d, "state.json")) else None
    every = style_list(state)
    traits, words = _parse_traits(args)
    if action == "tiles":
        ids = [w for w in words if w in every and every[w].get("kind") == "look"]
        if not ids:
            raise SystemExit("tiles takes look style ids, for example: engine.py style tiles swiss glassmorphism neo-brutalism --open")
        style_tiles(d, state, ids, open_=open_)
        return 0
    if action == "list":
        fams = {}
        for s in every.values():
            if all(s.get("traits", {}).get(ax) == v for ax, v in traits.items()) and (not fit or s.get("ui_fit") == fit):
                fams.setdefault(s.get("preset") or s.get("kind"), []).append(s)
        tt = style_taste(d, state, [s["id"] for v in fams.values() for s in v])
        order = (lambda s: (bool(tt[s["id"]]["redLines"]), -(tt[s["id"]]["fit"] or 0), s["name"].lower())) if tt else \
            (lambda s: s["name"].lower())
        if tt:
            print("Ordered by fit to your taste, best first. A style past a line you drew is marked: don't offer it.")
        for fam, items in sorted(fams.items()):
            print(f"{fam} ({len(items)}): " + ", ".join(f"{s['name']} ({s['id']})" + (" *yours" if s.get("custom") else "")
                                                         + style_taste_words(tt.get(s["id"])) for s in sorted(items, key=order)))
        print(f"{sum(len(v) for v in fams.values())} styles. Details: engine.py style show <id>. New ones: engine.py style explore <words>.")
        return 0
    if action == "show":
        for w in words:
            s = every.get(w)
            if not s:
                raise SystemExit(f"No style '{w}'. Try: engine.py style search {w}")
            _print_style(s, state, full=True)
            t = style_taste(d, state, [w]).get(w)
            if t and (t["redLines"] or t["fit"] is not None):
                print("  your taste: " + style_taste_words(t)[3:] + (" (don't offer it)" if t["redLines"] else ""))
        return 0
    if action == "search":
        hits = search_styles(words + [f"{ax} {v}" for ax, v in traits.items()], state, n=max(n, 6))
        found = dict(words_to_traits(words)[0], **traits)
        tt = style_taste(d, state, [sid for sid, _sc, _w in hits])
        past = [sid for sid in tt if tt[sid]["redLines"]]
        for sid, _sc, why in hits:
            if sid not in past:
                print(f"{every[sid]['name']} ({sid}): {every[sid].get('plain', '')}  [{', '.join(why)}]" + style_taste_words(tt.get(sid)))
        if past:
            print("Past a line you drew, so don't offer: " + "; ".join(
                f"{every[sid]['name']} ({', '.join(taste_py.line_text(r, plain=True) for r in tt[sid]['redLines'])})" for sid in past) + ".")
        fits = [(tt[sid]["fit"], sid) for sid in tt if sid not in past and tt[sid]["fit"] is not None]
        if fits:
            print(f"Best fit for your taste: {every[max(fits)[1]]['name']} ({max(fits)[1]}), {round(max(fits)[0] * 100)}%.")
        if not hits:
            print("No named style matches those words yet.")
        if found:
            print(f"Those words describe {trait_words_line(found)}. Build something new from them: engine.py style explore {' '.join(args)}")
        return 0
    if action in ("mix", "mutate", "explore"):
        if action == "mix":
            if len(words) < 2 or any(w not in every for w in words[:2]):
                raise SystemExit("mix takes two style ids, for example: engine.py style mix swiss glassmorphism (bones of the first, skin of the second)")
            cands = [blend_styles(every[words[0]], every[words[1]])]
            if traits:
                c = cands[0]
                cands = [_style_entry(c["name"], dict(c["traits"], **traits), c["ui_fit"], c["parents"], "blend")]
        elif action == "mutate":
            if not words or words[0] not in every or not traits:
                raise SystemExit("mutate takes a style id and axis=value changes, for example: engine.py style mutate swiss depth=glow")
            cands = [mutate_style(every[words[0]], traits)]
        else:
            ids = [w for w in words if w in every]
            cands = explore_styles([w for w in words if w not in every] + [f"{ax} {v}" for ax, v in traits.items()], ids, n=n, seed=seed,
                                   wild=wild, state=state, fit=fit)
            if not cands:
                print("Nothing new enough came out; try --wild, other words, or two styles to mix.")
                return 0
        for i, c in enumerate(cands, start=1):
            print(f"{i}. ", end="")
            _print_style(c, state)
        if tiles:  # show them, built for real, before anyone saves one
            style_tiles(d, state, [c["id"] for c in cands], {c["id"]: c for c in cands}, open_=open_)
        if save is not None:
            if not 1 <= save <= len(cands):
                raise SystemExit(f"--save takes 1 to {len(cands)}")
            if state is None:
                raise SystemExit("Saving needs a system: run engine.py init or sketch first.")
            c = cands[save - 1]
            sid, _e = custom_style_from(d, name or c["name"], changes=c["traits"], plain=plain or c["plain"], ui_fit=c["ui_fit"],
                                        parents=c["parents"], how=c["how"], risks=c.get("motionRisks") or ())
            print(f"Saved as {sid}. Use it: engine.py pick Q-dir-01 {sid}")
            if use:
                cmd_set(d, "answers.Q-dir-01", sid, f"style lab: use {sid}", quiet=True)
                print(f"Picked {sid} at Q-dir-01. Run engine.py build.")
        else:
            print("Keep one with --save <number> (it becomes your own style, recorded as a decision); --seed changes the draw.")
        return 0
    if action == "define":
        if state is None:
            raise SystemExit("Defining a style needs a system: run engine.py init or sketch first.")
        base = next((w for w in words if w in every), None)
        if not name:
            raise SystemExit("define needs --name, for example: engine.py style define --name \"Night market\" terminal color=neon depth=glow")
        sid, entry = custom_style_from(d, name, base=base, changes=traits, plain=plain, ui_fit=fit)
        _print_style(dict(entry, id=sid), merge_defaults(load_state(d)))
        print(f"Saved. Use it: engine.py pick Q-dir-01 {sid}")
        if use:
            cmd_set(d, "answers.Q-dir-01", sid, f"style lab: use {sid}", quiet=True)
            print(f"Picked {sid} at Q-dir-01. Run engine.py build.")
        return 0
    raise SystemExit("style actions: list, show, search, mix, mutate, explore, define, tiles")


# ---- logo colors (issue 24, U5): sketch --logo proposes brand-color candidates; the person picks, nothing is recorded for them
LOGO_HELP = "Export the logo as SVG (best) or PNG, or say its main color and pass it as --brand."
CSS_NAMED = {"black": (0, 0, 0), "white": (255, 255, 255), "red": (255, 0, 0), "green": (0, 128, 0), "blue": (0, 0, 255),
             "yellow": (255, 255, 0), "orange": (255, 165, 0), "purple": (128, 0, 128), "gray": (128, 128, 128),
             "grey": (128, 128, 128), "silver": (192, 192, 192), "maroon": (128, 0, 0), "navy": (0, 0, 128), "teal": (0, 128, 128),
             "olive": (128, 128, 0), "lime": (0, 255, 0), "aqua": (0, 255, 255), "fuchsia": (255, 0, 255)}


def png_colors(data, max_pixels=9_000_000, samples=250_000):
    """Counter of (r, g, b) for the visible pixels of a PNG (alpha 128 and up), sampled on a grid. Reads gray, RGB and
    palette files, with alpha or tRNS, at 1 to 16 bits. Interlaced and very large files are refused with a plain fix."""
    import struct
    import zlib
    from collections import Counter
    bad = f"--logo could not read this PNG. {LOGO_HELP} Nothing was written."
    pos, idat, plte, trns, hdr = 8, [], None, b"", None
    while pos + 8 <= len(data):
        n, typ = struct.unpack(">I4s", data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + n]
        if typ == b"IHDR" and n == 13:
            hdr = struct.unpack(">IIBBBBB", body)
        elif typ == b"PLTE":
            plte = [tuple(body[i:i + 3]) for i in range(0, len(body) - 2, 3)]
        elif typ == b"tRNS":
            trns = body
        elif typ == b"IDAT":
            idat.append(body)
        elif typ == b"IEND":
            break
        pos += 12 + n
    if not hdr or not idat or hdr[3] not in (0, 2, 3, 4, 6) or (hdr[3] == 3 and not plte):
        raise SystemExit(bad)
    w, h, depth, ctype, _c, _f, interlace = hdr
    if interlace:
        raise SystemExit("--logo reads ordinary PNGs, and this one is interlaced. Save a copy without interlacing (most "
                         "editors do by default), then run it again. Nothing was written.")
    if w * h > max_pixels:
        raise SystemExit(f"This logo is {w}x{h} pixels, too large to read here. Save a copy about 1000 pixels wide, or use the SVG. "
                         "Nothing was written.")
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ctype]
    bpp, stride = max(1, ch * depth // 8), (w * ch * depth + 7) // 8
    try:
        raw = zlib.decompress(b"".join(idat))
    except zlib.error:
        raise SystemExit(bad)
    if len(raw) < h * (stride + 1):
        raise SystemExit(bad)
    step = max(1, int(math.sqrt(w * h / samples)))
    mask = (1 << depth) - 1
    key = int.from_bytes(trns[:2], "big") if ctype == 0 and len(trns) >= 2 else None
    key3 = tuple(int.from_bytes(trns[i:i + 2], "big") for i in (0, 2, 4)) if ctype == 2 and len(trns) >= 6 else None
    top = 65535 if depth == 16 else mask
    eight = (lambda v: v >> 8) if depth == 16 else (lambda v: v * 255 // mask) if depth < 8 else (lambda v: v)
    out, prev, off = Counter(), bytearray(stride), 0
    for y in range(h):
        f, line = raw[off], bytearray(raw[off + 1:off + 1 + stride])
        off += 1 + stride
        if f == 1:
            for i in range(bpp, stride):
                line[i] = (line[i] + line[i - bpp]) & 255
        elif f == 2:
            line = bytearray((x + y_) & 255 for x, y_ in zip(line, prev))
        elif f == 3:
            for i in range(stride):
                line[i] = (line[i] + ((line[i - bpp] if i >= bpp else 0) + prev[i]) // 2) & 255
        elif f == 4:
            for i in range(stride):
                a_, b_, c_ = (line[i - bpp] if i >= bpp else 0), prev[i], (prev[i - bpp] if i >= bpp else 0)
                p = a_ + b_ - c_
                pa, pb, pc = abs(p - a_), abs(p - b_), abs(p - c_)
                line[i] = (line[i] + (a_ if pa <= pb and pa <= pc else b_ if pb <= pc else c_)) & 255
        prev = line
        if y % step:
            continue
        if depth == 8:
            smp = line
        elif depth == 16:
            smp = [(line[i] << 8) | line[i + 1] for i in range(0, stride, 2)]
        else:
            smp = [(b >> s) & mask for b in line for s in range(8 - depth, -1, -depth)]
        for x in range(0, w, step):
            px = smp[x * ch:x * ch + ch]
            if ctype == 3:
                i = px[0]
                if i >= len(plte) or (i < len(trns) and trns[i] < 128):
                    continue
                rgb = plte[i]
            elif ctype == 0:
                if px[0] == key:
                    continue
                rgb = (eight(px[0]),) * 3
            elif ctype == 2:
                if tuple(px) == key3:
                    continue
                rgb = tuple(eight(v) for v in px)
            else:
                if px[-1] * 255 < 128 * top:
                    continue
                rgb = (eight(px[0]),) * 3 if ctype == 4 else tuple(eight(v) for v in px[:3])
            out[rgb] += 1
    return out


def svg_colors(text):
    """(Counter of (r, g, b) for the fills, strokes and gradient stops of an SVG, 'fills'). An SVG that only wraps a
    picture is refused with a plain fix: export that picture as PNG."""
    import colorsys
    from collections import Counter
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    out = Counter()
    for m in re.finditer(r"(?<![\w-])(?:fill|stroke|stop-color)\s*[:=]\s*[\"']?\s*(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-zA-Z]+)", text):
        v = m.group(1).strip().lower()
        rgb, alpha = None, 1.0
        if v.startswith("#"):
            hx = v[1:]
            if len(hx) in (3, 4):
                hx = "".join(c * 2 for c in hx)
            if len(hx) in (6, 8):
                rgb = tuple(int(hx[i:i + 2], 16) for i in (0, 2, 4))
                alpha = int(hx[6:8], 16) / 255 if len(hx) == 8 else 1.0
        elif v.startswith(("rgb", "hsl")):
            nums = re.findall(r"-?[\d.]+%?", v)
            if len(nums) >= 3:
                val = lambda s, top: float(s[:-1]) * top / 100 if s.endswith("%") else float(s)
                if len(nums) > 3:
                    alpha = val(nums[3], 1.0)
                if v.startswith("rgb"):
                    rgb = tuple(max(0, min(255, round(val(s, 255)))) for s in nums[:3])
                else:
                    hue, sat, lig = (float(x.rstrip("%")) for x in nums[:3])
                    rgb = tuple(round(c * 255) for c in colorsys.hls_to_rgb((hue % 360) / 360, min(lig, 100) / 100, min(sat, 100) / 100))
        else:
            rgb = CSS_NAMED.get(v)  # none, currentColor, url(...) and inherit carry no color of their own
        if rgb and alpha >= 0.5:
            out[rgb] += 1
    if not out and re.search(r"<image\b", text):
        raise SystemExit("--logo: this SVG holds a picture, not shapes, so it has no colors to read. Export the logo as PNG "
                         "and run it again. Nothing was written.")
    return out, "fills"


def logo_colors(path):
    """(Counter of (r, g, b), 'area' or 'fills') from a PNG or SVG logo, read with the standard library only."""
    try:
        with open(path, "rb") as f:
            data = f.read()
    except OSError:
        raise SystemExit(f"--logo: no file at {path}. Nothing was written.")
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return png_colors(data), "area"
    head = data[:4096].decode("utf-8", "ignore").lower()
    if "<svg" in head or (path.lower().endswith(".svg") and "<svg" in data.decode("utf-8", "ignore").lower()):
        return svg_colors(data.decode("utf-8", "ignore"))
    kind = "a JPEG" if data[:3] == b"\xff\xd8\xff" else "a PDF" if data[:4] == b"%PDF" else "not a PNG or SVG"
    raise SystemExit(f"--logo reads PNG and SVG files, and this one is {kind}. {LOGO_HELP} Nothing was written.")


def logo_candidates(path, n=3, ratio=4.5):
    """Up to n brand-color candidates from a logo, largest share first, grays last: [{hex, share, words, text, gray}] and
    the kind of share ('area' or 'fills'). White, black and see-through parts are left out, near-identical shades are
    merged, and shades that only blend two other colors are dropped: anti-aliased edges, and tints of a bigger color, which
    its ramp makes anyway. Nothing is recorded."""
    counts, kind = logo_colors(path)
    bins = {}
    for rgb, c in counts.items():  # 32 levels a channel first, so a large logo stays quick
        e = bins.setdefault((rgb[0] >> 3, rgb[1] >> 3, rgb[2] >> 3), [rgb, 0, 0])
        if c > e[1]:
            e[0], e[1] = rgb, c
        e[2] += c
    keep = []
    for rgb, _c, tot in bins.values():
        L, C, H = hex_to_oklch("#%02x%02x%02x" % rgb)
        if C < 0.03 and (L > 0.93 or L < 0.3):
            continue  # the background and the ink, not a brand color
        keep.append([rgb, tot, (L, C * math.cos(math.radians(H)), C * math.sin(math.radians(H))), C])
    total = sum(k[1] for k in keep)
    clusters = []
    dist = lambda p, q: math.dist(p, q)
    for rgb, tot, lab, C in sorted(keep, key=lambda k: -k[1]):
        near = min(clusters, key=lambda k: dist(k[2], lab), default=None)
        if near and dist(near[2], lab) < 0.08:
            near[1] += tot
        elif tot >= 0.002 * total:
            clusters.append([rgb, tot, lab, C])

    def blend(x, a, b):  # x lies on the straight line between a and b (gamma-encoded, as edges are drawn)
        ab = [q - p for p, q in zip(a, b)]
        t = sum((xi - p) * d for xi, p, d in zip(x, a, ab)) / (sum(d * d for d in ab) or 1)
        return 0.1 < t < 0.9 and math.dist(x, [p + t * d for p, d in zip(a, ab)]) < 14

    out = []
    for i, (rgb, tot, _lab, C) in enumerate(clusters):
        share = tot / total
        bigger = [k[0] for k in clusters[:i]]
        if share < 0.02 or any(blend(rgb, a, b) for a in bigger for b in bigger + [(255, 255, 255), (0, 0, 0)] if a != b):
            continue
        hx = "#%02x%02x%02x" % rgb
        out.append({"hex": hx, "share": share, "words": color_words(hx), "text": exact_text_on(hx, ratio), "gray": C < 0.04})
    out.sort(key=lambda c: (c["gray"], -c["share"]))
    return out[:n], kind


def logo_lines(path, cands, kind, command):
    """What sketch --logo prints: each candidate with its share and a plain note, then the command that confirms the first."""
    name = os.path.basename(path)
    if not cands:
        return [f"No brand color in {name}: it is only white, black or gray. Run the sketch without --logo and suggest seed colors "
                "that fit their words, or pass the person's own hex with --brand. Nothing was written."]
    noun = "colored area" if kind == "area" else "color fills"
    out = [f"Colors in {name}. Nothing is recorded until the person picks one:"]
    for i, c in enumerate(cands, 1):
        note = ("white text reads on it" if c["text"] == "light" else "dark text reads on it" if c["text"] == "dark" else
                "buttons with text would use a readable shade of it, and the exact color stays for the logo and large areas")
        out.append(f"  {i}. {c['hex']}, {c['words']}: {round(c['share'] * 100)}% of its {noun}; "
                   + ("a gray, so it suits text and borders more than buttons." if c["gray"] else note + "."))
    out.append("White, black and see-through parts were left out." + (" Shares count fills, not area." if kind == "fills" else ""))
    out.append(f"Show these and let the person pick (or type their own hex). For {cands[0]['hex']}, run:")
    out.append("  " + command.replace("__BRAND__", cands[0]["hex"]))
    if len(cands) > 1:
        out.append("For another, change the --brand hex. A second strong color can become a second accent later (Q-color-04).")
    return out


def sketch_command(d, flags):
    """The sketch command line with these flags, for the person to run after a pick (__BRAND__ marks the brand hex)."""
    parts = ["engine.py", "sketch"] + (["--dir", d] if d != DEFAULT_DIR else [])
    for k in ("name", "audience", "platforms", "feel", "theme", "surfaces", "stack", "brief", "delegated", "logo", "brand"):
        v = flags.get(k)
        if v is None:
            continue
        v = ",".join(v) if isinstance(v, (list, tuple)) else str(v)
        parts += ["--delegated"] if k == "delegated" and v == "all" else [f"--{k}", v]
    return " ".join("'__BRAND__'" if p == "__BRAND__" else shlex.quote(p) for p in parts)


def cmd_sketch(d, name=None, brand=None, audience=None, platforms=None, feel=None, theme=None, quiet=False, surfaces=None, delegated=None,
               stack=None, brief=None, logo=None):
    """Level 0: about five answers give a complete, coarse system; everything else stays on defaults.
    Every input is checked before anything is written. delegated names the answers the person left to the model
    ('all' or a comma list of sketch flags); they are recorded as set_by delegated. A look word in --feel ("frosty") starts
    the system from a named style (Q-dir-01, set_by assumed), unless the style question was already answered. --brief keeps
    the person's picture of the look ("a quiet library at night") for the taste card; it is never written for them.
    --logo (PNG or SVG) without --brand writes nothing: it prints up to three brand-color candidates from the logo and the
    command that confirms one, because the person picks (issue 24). With --brand it records the logo (hook H-logo)."""
    macros, mapping, unknown, looks, look_only, start = feel_and_looks([w for w in re.split(r"\s*,\s*", feel or "") if w.strip()])
    items = [x.strip() for x in (surfaces or "").split(",") if x.strip()]
    if items and (not surface_list(items) or len(surface_list(items)) != len(items)):
        raise SystemExit(f"--surfaces takes mode words or name:mode pairs; modes are {', '.join(SURFACE_MODES)}.")
    if brand is not None:
        hx = normalize_hex(brand)
        if not hx:
            raise SystemExit(f"--brand takes a hex color like #2563EB; {brand!r} is not one. Nothing was written.")
        brand = hx
    brief = re.sub(r"\s+", " ", brief or "").strip().strip('"') or None
    if brief and len(brief) > 160:
        raise SystemExit("--brief is one short line in the person's words (160 characters at most). Nothing was written.")
    deleg = {x.strip() for x in str(delegated).split(",") if x.strip()} if delegated else set()
    bad = deleg - set(SKETCH_FLAGS) - {"all"}
    if bad:
        raise SystemExit(f"--delegated takes all or a comma list of: {', '.join(SKETCH_FLAGS)}.")
    cands = []
    if logo:
        aaa = os.path.exists(os.path.join(d, "state.json")) and (load_state(d).get("raw") or {}).get("contrastTarget") == "AAA"
        cands, kind = logo_candidates(logo, ratio=7.0 if aaa else 4.5)
        if brand is None:  # the person picks: nothing is recorded from the logo on its own
            if not quiet:
                flags = {"name": name, "audience": audience, "platforms": platforms, "feel": feel, "theme": theme, "surfaces": surfaces,
                         "stack": stack, "brief": brief, "delegated": delegated, "logo": logo, "brand": "__BRAND__"}
                print("\n".join(logo_lines(logo, cands, kind, sketch_command(d, flags))))
            return 0

    def sb(flag):
        if flag == "brand" and "brand" not in deleg:  # a hex given with --brand is the person's unless brand is named (STRESS-TEST 1)
            return None
        return "delegated" if ("all" in deleg or flag in deleg) else None

    def why_of(flag):  # a delegated answer is the model's pick, never "their words" (R20)
        return "sketch: picked for them" if sb(flag) else "sketch: Level 0 answer"
    fresh = not os.path.exists(os.path.join(d, "state.json"))
    if theme:  # a new sketch applies the house standards after its answers, so a theme one rules out is refused here (D02)
        trial = merge_defaults(default_state() if fresh else load_state(d))
        if platforms:
            trial.setdefault("answers", {})["Q-plat-01"] = {"value": [p.strip() for p in platforms.split(",") if p.strip()]}
        trial["raw"]["stack"] = (str(stack).split(",") if stack is not None else stack_of(trial) or detect_stack(doc_dir(d))[0] or [])
        house, st_ = load_standards(), std_state(trial)
        bad = [s for s in [s for s in house["standards"] if s["id"] not in st_["overridden"] and std_applies(s, trial)] + st_["project"]
               if theme in [str(x) for x in ((s.get("breaks_options") or {}).get("Q-theme-01") or [])]]
        if bad:
            raise SystemExit(f"Nothing was written: the theme {theme} breaks a standard.\n" + std_lock_message(
                trial, [], house, value=theme, breaks=[(s["id"], f"the standard lists {theme} for Q-theme-01 as an option that breaks it", s)
                                                       for s in bad]))
    if fresh:
        cmd_init(d, name=name, standards=False, detect=False)  # house standards follow the answers; the repo is read after them
    elif name and load_state(d).get("name") != name:
        cmd_set(d, "name", name, "sketch: the product's name", quiet=True, set_by=sb("name"))  # --name wins over init's folder name
    write_protocol(d, quiet=quiet)  # a system made before PROTOCOL.md existed gets it now
    if audience:
        cmd_set(d, "answers.Q-aud-01", audience, why_of("audience"), quiet=True, set_by=sb("audience"), via="sketch")
        if not (load_state(d).get("context") or {}).get("audience"):
            cmd_set(d, "context.audience", AUDIENCE_WORDS.get(audience, audience),
                    "sketch: plain words for Q-aud-01" + (", picked for them" if sb("audience") else ""), quiet=True,
                    set_by=sb("audience") or "assumed")
    if brand:
        from_logo = brand in [c["hex"] for c in cands]
        cmd_set(d, "raw.brandColor", brand, (("sketch: picked for them" if sb("brand") else "sketch: their pick") + " from the logo's colors")
                if from_logo else why_of("brand"), quiet=True, set_by=sb("brand"))
        if sb("brand"):  # the model picked it: kept when white or dark text reads on it, else a shade white text reads on (R44)
            adj = readable_shade(brand, 7.0 if (load_state(d).get("raw") or {}).get("contrastTarget") == "AAA" else 4.5)
            if adj != brand:
                cmd_set(d, "raw.brandColor", adj, f"sketch: picked for them, a readable shade of {brand} ({color_words(adj)})",
                        quiet=True, set_by="delegated")
    if logo:  # the person gave their logo: the hook is answered, and the file is kept when it sits in the project
        hk = (load_state(d).get("hooks") or {}).get("H-logo") or {}
        if hk.get("status") != "have":
            cmd_set(d, "hooks.H-logo.status", "have", f"sketch --logo {os.path.basename(logo)}", quiet=True, set_by="asset")
        rel = os.path.relpath(os.path.abspath(logo), os.path.abspath(doc_dir(d))).replace(os.sep, "/")
        if not rel.startswith("../") and rel not in (hk.get("files") or []):
            cmd_set(d, "hooks.H-logo.files", (hk.get("files") or []) + [rel], "sketch --logo: the person's logo file", quiet=True,
                    set_by="asset")
    if platforms:
        cmd_set(d, "answers.Q-plat-01", [p.strip() for p in platforms.split(",") if p.strip()], why_of("platforms"), quiet=True,
                set_by=sb("platforms"), via="sketch", resync=False)
    if stack is not None:
        cmd_set(d, "raw.stack", stack, "sketch: the code stack the person named", quiet=True, resync=False)
    if macros:
        cmd_set(d, "macros", macros, why_of("feel") + (f" ({'feel words' if sb('feel') else 'their words'}: {', '.join(mapping)})"
                                                         if mapping else ""), quiet=True, set_by=sb("feel"))
    if macros or look_only:
        cmd_set(d, "taste.feelWords", [w.strip("!.?,;: ").lower() for w in list(mapping) + [p for p in look_only if p not in mapping]],
                "sketch: feel words picked for them" if sb("feel") else "sketch: the person's own feel words", quiet=True, set_by=sb("feel"))
    if brief:
        cmd_set(d, "taste.brief", brief, "sketch: picked for them" if sb("brief") else "sketch: the person's picture of the look",
                quiet=True, set_by=sb("brief"))
    started = None
    if start:
        cur = (load_state(d).get("answers") or {}).get("Q-dir-01")
        if not cur or (isinstance(cur, dict) and cur.get("via") == "sketch" and cur.get("set_by") in ("assumed", "delegated")):
            said = ", ".join(p for p in look_only if looks[p][0] == start)
            cmd_set(d, "answers.Q-dir-01", start, f"sketch: the look words {said} name this style ({style_list()[start]['name']})",
                    quiet=True, set_by=sb("feel") or "assumed", via="sketch")
            started = start
    if theme:
        cmd_set(d, "answers.Q-theme-01", theme, why_of("theme"), quiet=True, set_by=sb("theme"), via="sketch")
    if items:
        cmd_set(d, "answers.Q-scope-06", items if len(items) > 1 or ":" in items[0] else items[0], why_of("surfaces"), quiet=True,
                set_by=sb("surfaces"), via="sketch")
    read = record_project(d)  # what their files answer and they did not: assumed, said in one line with the result
    if fresh:
        std_sync(d, initial=True, quiet=quiet)
    elif platforms or stack is not None or any(f["path"] in ("answers.Q-plat-01", "raw.stack") for f in read):
        # the standards follow the platforms and stack (R02), quietly, one line per theme
        std_rescope(d, quiet=quiet)
    code = cmd_build(d) if not quiet else 0
    if not quiet:
        if mapping and any([w] != ids for w, ids in mapping.items()):
            print("Feel: " + "; ".join(f"{w} -> {' + '.join(ids)}" for w, ids in mapping.items()) + ".")
        for w in unknown:
            if w.strip("!.?, ").lower() in COLOR_WORDS:
                print(f"'{w}' is a color, not a feel, so I left it out of the feel. Give the exact color with --brand (a hex such as #2563EB), "
                      "or share your logo and I'll read its colors.")
            else:
                print(f"I don't know the feel word '{w}' yet, so I left it out. Is it closer to playful, calm, bold, friendly or serious?")
        names = lambda ids: ", ".join(style_list()[s]["name"] for s in ids)
        for p in look_only:  # plain words first, then the name (rules.md section 2)
            st = style_list()[looks[p][0]]
            if st["id"] == started:
                print(f"'{p}': {st['plain']}; designers call it {st['name']}. I started from it, as an assumption"
                      + (f" (also close: {names(looks[p][1:])})" if looks[p][1:] else "")
                      + ". Change it at the style screen: engine.py pick Q-dir-01 <style>.")
            elif st.get("kind") == "look":
                print(f"'{p}' names another look, {st['name']} ({st['plain']}). Pick one at the style screen (Q-dir-01).")
            else:
                print(f"'{p}': {st['plain']}; designers call it {st['name']}. It pairs with a style. {st.get('note', '')}".rstrip())
        for p in [p for p in looks if p in mapping or p not in look_only]:
            print(f"'{p}' can also name a look: {names(looks[p][:4])}. Show them at the style screen (Q-dir-01).")
        mp = os.path.join(d, "tokens", "opendesigner.meta.json")
        st_ = load_state(d)
        line = brand_line(read_json(mp), st_, plain=((st_.get("profile") or {}).get("voice") or "plain") == "plain",
                          delegated=brand_delegated(d)) if os.path.exists(mp) else ""
        if line:
            print(line)
        for line in detect_lines(read, lead="Read from your repo (recorded as assumed; say if any is wrong):"):
            print(line[2:])
        ph = project_phase(load_state(d))
        if ph:
            print(f"Phase: {PHASE_WORDS[ph]}. What comes first: {PHASE_FIRST[ph]} (zoom.md, \"The project's phase\").")
        print("This is a sketch: every part works, and most choices are still defaults. Zoom into any area later (see the Zoom lines in DESIGN.md).")
        if code == 0:
            track(d, "level_complete", level="sketch")
            jl = journey.level_line(d, "sketch") if journey else ""
            if jl:
                print(jl)
    return code


TW_PALETTE_HEX = {  # Tailwind v3 palette hexes (v4 uses OKLCH equivalents), to suggest the nearest role token [inferred approximation]
    "slate-50": "#f8fafc", "slate-100": "#f1f5f9", "slate-200": "#e2e8f0", "slate-300": "#cbd5e1", "slate-400": "#94a3b8", "slate-500": "#64748b",
    "slate-600": "#475569", "slate-700": "#334155", "slate-800": "#1e293b", "slate-900": "#0f172a", "slate-950": "#020617",
    "gray-50": "#f9fafb", "gray-100": "#f3f4f6", "gray-200": "#e5e7eb", "gray-300": "#d1d5db", "gray-400": "#9ca3af", "gray-500": "#6b7280",
    "gray-600": "#4b5563", "gray-700": "#374151", "gray-800": "#1f2937", "gray-900": "#111827", "gray-950": "#030712",
    "zinc-100": "#f4f4f5", "zinc-200": "#e4e4e7", "zinc-500": "#71717a", "zinc-700": "#3f3f46", "zinc-900": "#18181b",
    "neutral-100": "#f5f5f5", "neutral-200": "#e5e5e5", "neutral-500": "#737373", "neutral-700": "#404040", "neutral-900": "#171717",
    "red-500": "#ef4444", "red-600": "#dc2626", "red-700": "#b91c1c", "orange-500": "#f97316", "amber-500": "#f59e0b", "yellow-400": "#facc15",
    "green-500": "#22c55e", "green-600": "#16a34a", "emerald-500": "#10b981", "teal-500": "#14b8a6", "cyan-500": "#06b6d4", "sky-500": "#0ea5e9",
    "blue-50": "#eff6ff", "blue-100": "#dbeafe", "blue-500": "#3b82f6", "blue-600": "#2563eb", "blue-700": "#1d4ed8", "indigo-500": "#6366f1",
    "indigo-600": "#4f46e5", "violet-500": "#8b5cf6", "purple-500": "#a855f7", "pink-500": "#ec4899", "rose-500": "#f43f5e"}


REVIEW_EXT = {".css", ".scss", ".sass", ".less", ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".html", ".swift", ".kt", ".kts"}
REVIEW_SKIP = {"node_modules", ".git", "dist", "build", ".next", "out", "vendor", "coverage", "Pods", ".gradle", "opendesigner",
               "DerivedData", "__pycache__", ".venv", "venv"}
RX_HEX = re.compile(r"(?<![\w&])#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
RX_FN = re.compile(r"\b(rgba?|hsla?|oklch)\(\s*[\d.]")
RX_SWIFT_COLOR = re.compile(r"\b(Color|UIColor|NSColor)\(\s*(red|\.sRGB|hue|white)")
RX_KT_COLOR = re.compile(r"\bColor\(\s*0x[0-9A-Fa-f]{6,8}")
RX_SIZE = re.compile(r"\b(padding|margin|gap|row-gap|column-gap|font-size|border-radius|inset|top|left|right|bottom|width|height)"
                     r"(-[a-z]+)?\s*:\s*(-?\d+(?:\.\d+)?)px")
# JSX and JS style objects (U5 F3, F30): borderRadius: 10, padding: '20px', fontSize: 15
RX_JSX_SIZE = re.compile(r"\b(padding(?:Top|Right|Bottom|Left|Inline|Block|X|Y)?|margin(?:Top|Right|Bottom|Left|Inline|Block|X|Y)?|gap|rowGap|"
                         r"columnGap|fontSize|borderRadius|border(?:Top|Bottom)(?:Left|Right)Radius|top|left|right|bottom|inset|width|height)"
                         r"\s*:\s*(['\"`]?)(-?\d+(?:\.\d+)?)(px)?(?:\s|['\"`,}])")
RX_SHADOW = re.compile(r"\b(box-shadow|text-shadow|boxShadow|textShadow)\s*:\s*['\"`]?\s*((?:inset\s+)?-?\d[^;'\"`{}]*)")
RX_DROP_SHADOW = re.compile(r"\bdrop-shadow\(\s*(-?\d[^)]*)\)")
RX_SHADOW_NATIVE = re.compile(r"\.shadow\(\s*(?:color:|radius:\s*\d|elevation\s*=\s*\d|\d+(?:\.\d+)?\.dp)")
RX_MOTION = re.compile(r"\b(transition|transition-duration|animation|animation-duration|transitionDuration|animationDuration)"
                       r"\s*:\s*['\"`]?([^;'\"`{}]*)")
RX_TIME = re.compile(r"(?<![\w.-])(\d*\.?\d+)(ms|s)\b")
RX_SWIFT_ANIM = re.compile(r"\.(easeInOut|easeIn|easeOut|linear|spring|smooth|snappy|bouncy)\(\s*duration:\s*(\d*\.?\d+)")
RX_KT_ANIM = re.compile(r"\b(?:tween\(\s*(?:durationMillis\s*=\s*)?|durationMillis\s*=\s*)(\d+)")
RX_RADIUS_NATIVE = re.compile(r"(cornerRadius\s*[:(]\s*(\d+)|RoundedCornerShape\(\s*(\d+)\.dp|\.padding\(\s*(\d+)\s*\)|(\d+)\.dp\b)")
# Tailwind: arbitrary values (bg-[#2563eb], p-[13px]) and the default scales that bypass the tokens (bg-blue-600, rounded-lg)
RX_TW_CONTEXT = re.compile(r"\b(className|class|clsx|cn|cva|twMerge|tw)\s*[=(`]|@apply\b")
RX_TW_ARB = re.compile(r"(?<![\w\[-])((?:[a-z0-9-]+:)*)(bg|text|border(?:-[trblxy])?|ring|outline|fill|stroke|p[xytrbl]?|m[xytrbl]?|"
                       r"gap(?:-[xy])?|space-[xy]|rounded(?:-[a-z]+)?|shadow|duration|delay|leading|tracking)-\[([^\]\s]+)\]")
TW_HUES = ("slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|"
           "pink|rose")
RX_TW_PALETTE = re.compile(r"(?<![\w\[-])((?:[a-z0-9-]+:)*)(bg|text|border|ring|outline|fill|stroke|from|to|via|divide|placeholder|decoration|"
                           rf"accent|caret)-(?:({TW_HUES})-(50|[1-9]00|950)|(white|black))(?:/\d+)?(?![\w-])")
RX_TW_RADIUS = re.compile(r"(?<![\w\[-])((?:[a-z0-9-]+:)*)rounded(?:-(none|xs|sm|md|lg|xl|2xl|3xl))?(?![\w\[-])")
RX_TW_SHADOW = re.compile(r"(?<![\w\[-])((?:[a-z0-9-]+:)*)shadow(?:-(2xs|xs|sm|md|lg|xl|2xl|inner))?(?![\w\[-])")
RX_TW_TEXT = re.compile(r"(?<![\w\[-])((?:[a-z0-9-]+:)*)text-(xs|sm|base|lg|xl|[2-9]xl)(?![\w-])")
TW_TEXT_PX = {"xs": 12, "sm": 14, "base": 16, "lg": 18, "xl": 20, "2xl": 24, "3xl": 30, "4xl": 36, "5xl": 48, "6xl": 60, "7xl": 72,
              "8xl": 96, "9xl": 128}
TW_RADIUS_PX = {None: 4, "none": 0, "xs": 2, "sm": 4, "md": 6, "lg": 8, "xl": 12, "2xl": 16, "3xl": 24}
TW_SHADOW_ROLE = {None: "raised", "2xs": "raised", "xs": "raised", "sm": "raised", "md": "floating", "lg": "floating", "xl": "overlay",
                  "2xl": "overlay", "inner": "raised"}
RX_STATUS_WORD = re.compile(r"error|danger|invalid|destructive|delete|remove|warn|success|valid|done|complete|info|notice|alert", re.I)
RX_ACTION_WORD = re.compile(r"button|btn|cta|primary|submit|save|action", re.I)
ROLE_OF_PROP = {"background": "bg", "background-color": "bg", "backgroundcolor": "bg", "bg": "bg", "color": "text", "text": "text",
                "border": "border", "border-color": "border", "bordercolor": "border", "outline": "border", "outline-color": "border",
                "ring": "border", "fill": "icon", "stroke": "icon", "caret-color": "text", "accent-color": "bg"}


def _nearest_color(hx, palette):
    L1 = hex_to_oklch(hx)
    a1 = oklch_to_oklab(*L1)

    def dist(h2):
        a2 = oklch_to_oklab(*hex_to_oklch(h2))
        return sum((x - y) ** 2 for x, y in zip(a1, a2)) ** 0.5
    best = min(palette.items(), key=lambda kv: (round(dist(kv[1]), 3), ROLE_RANK(kv[0]), kv[0]))
    return best[0], dist(best[1])


def ROLE_RANK(path):
    """Tie-break for equally close colors: the primary action first, then accent, text roles, neutrals, status last."""
    order = ("color.bg.action.primary", "color.text.on-action", "color.bg.accent.bold", "color.text.primary", "color.surface.base",
             "color.surface.raised", "color.border.default", "color.icon.default")
    return order.index(path) if path in order else (50 if re.search(r"\.(success|warning|danger|info|discovery)\b", path) else 20)


def _nearest_duration(ms_val, durations):
    """Duration token name for a raw time in ms: the one with exactly that value first (in ladder order), else the closest
    (instant only for 0). extra is for illustrative and marketing motion only, so it is never suggested for another value."""
    exact = [k for k, v in durations.items() if v == ms_val]
    if exact:
        return exact[0]
    cands = {k: v for k, v in durations.items() if v > 0 and k != "extra"} or durations
    return min(cands.items(), key=lambda kv: (abs(kv[1] - ms_val), kv[1]))[0]


def mask_vars(line):
    """The line with every var(...) replaced by spaces (nested ones too), so review reads the literals around it, and a
    fallback inside var() is not taken for a bypass (R18). Positions stay the same."""
    prev = None
    while prev != line:
        prev = line
        line = re.sub(r"var\([^()]*\)", lambda m: " " * len(m.group(0)), line)
    return line


RX_ROLE_EXIT = re.compile(r"exit|clos(?:e|ing)|leav(?:e|ing)|\bhid(?:e|ing)|dismiss|fade-?out|slide-?out|FadeOut|SlideOut", re.I)
RX_ROLE_ENTER = re.compile(r"menu|popover|dropdown|popup|\benter|appear|fade-?in\b|slide-?in\b|FadeIn|SlideIn", re.I)
RX_ROLE_FEEDBACK = re.compile(r"hover|focus|:active|pressed|button|btn", re.I)
RX_COLOR_PROP = re.compile(r"\b(?:color|background(?:-color)?|border(?:-color)?|box-shadow|boxShadow|fill|outline)\b", re.I)
DURATION_ROLES = (("modal", r"modal|dialog"), ("drawer", r"drawer|sheet"), ("toast", r"toast|snackbar"), ("tooltip", r"tooltip"))
RADIUS_ROLES = (("control", r"button|btn|input|field|select|textarea|chip|tag|toggle|switch|checkbox|control"),
                ("overlay", r"modal|dialog|popover|menu|dropdown|sheet|drawer|tooltip|toast|overlay"),
                ("container", r"card|panel|container|section|tile|box"), ("person", r"avatar"))


def css_selector_context(lines, i):
    """The selector of the CSS rule that line i (1-based) sits in: the text before '{' on the line itself, else before the
    nearest '{' above that is still open; '' when there is none within 80 lines."""
    if "{" in lines[i - 1]:
        return lines[i - 1].split("{", 1)[0].strip()
    depth = 0
    for j in range(i - 2, max(-1, i - 82), -1):
        depth += lines[j].count("}") - lines[j].count("{")
        if depth < 0:
            return lines[j].rsplit("{", 1)[0].strip()
    return ""


def _shadow_role(value):
    """Map a raw shadow to the elevation role of the same size: the largest blur decides (DC-L04-10)."""
    nums = [float(x) for x in re.findall(r"(-?\d*\.?\d+)px", value)]
    blur = max((abs(x) for x in nums[2::4] or nums), default=0)  # offset-x offset-y blur spread
    return "raised" if blur <= 4 else "floating" if blur <= 16 else "overlay"


def _prop_before(line, pos):
    """The CSS or JSX property a value belongs to: the last 'name:' before it on the line."""
    m = re.search(r"([A-Za-z-]+)\s*:\s*[^;:{}]*$", line[:pos])
    return m.group(1).lower() if m else ""


def role_palette(light, role, line):
    """Candidate color tokens for a raw color, narrowed by the property's role (U5 F9): backgrounds get bg/surface
    roles, text gets text roles, borders get border roles; status colors only when the line talks about a status."""
    prefixes = {"bg": ("color.bg.", "color.surface."), "text": ("color.text.",), "border": ("color.border.",),
                "icon": ("color.icon.", "color.text.")}.get(role, ("color.surface.", "color.text.", "color.bg.", "color.border.", "color.icon."))
    status_ok = bool(RX_STATUS_WORD.search(line))
    out = {p: hex_of(t["resolved"]) for p, t in light.items() if t["type"] == "color" and p.startswith(prefixes)
           and not (t["resolved"] or {}).get("alpha") and (status_ok or not re.search(r"\.(success|warning|danger|info|discovery)\b", p))
           and not p.startswith(("color.chart.", "color.workflow."))}
    if RX_ACTION_WORD.search(line) and role == "bg":
        out = {k: v for k, v in out.items() if not k.startswith("color.surface.")} or out
    return out


def tw_class_for(path):
    """Tailwind class for a semantic color token (build/tailwind/theme.css naming)."""
    for src, dst in TW_COLOR_MAP:
        if path.startswith(src):
            rest = "-".join(kebab(s_) for s_ in path[len(src):].split("."))
            util = {"color.surface.": "bg", "color.bg.": "bg", "color.text.": "text", "color.border.": "border", "color.icon.": "text"}.get(src, "bg")
            return f"{util}-{dst}{rest}"
    return path


def token_use_rx(prefix):
    """What counts as code using the system: var(--ds-...), the Swift and Compose token types, or an import of a build file."""
    P, K = prefix.upper(), prefix.capitalize()
    tw = (r"\b(?:bg|text|border|fill|stroke|ring|outline|divide)-(?:surface|fg|line|icon|overlay|chart|workflow|action|accent|success|"
          r"warning|danger|info|discovery)-[a-z0-9-]+|\b(?:p[xytblr]?|m[xytblr]?|gap(?:-[xy])?|space-[xy])-(?:inset|stack|inline)-[a-z0-9]+"
          r"|\brounded-(?:detail|control|container|overlay|person)\b|\bshadow-(?:raised|floating|overlay)\b|\btransition-feedback\b")
    return re.compile(rf"var\(\s*--{re.escape(prefix)}-|\b{P}\.(?:Colors|Space|Radius|Motion|Type|Elevation)\b|\bLocal{K}Colors\b"
                      rf"|\b{K}(?:Space|Motion|Radius|Type)\b|opendesigner/build/|{tw}")


SYSTEM_AGE_COMMITS = 10  # commits that changed code since the system last changed, before review says the system is behind


def system_age(d, project):
    """{commitsSince, since}: commits that changed the project's code after state.json or DESIGN.md last changed, read from
    git. None without git, outside a repository, or when the system was never committed."""
    import subprocess

    def git(*args):
        try:
            r = subprocess.run(["git", *args], cwd=project, capture_output=True, text=True, timeout=10)
        except (OSError, subprocess.SubprocessError):
            return None
        return r.stdout.strip() if r.returncode == 0 else None
    sys_files = [p for p in (os.path.join(d, "state.json"), os.path.join(doc_dir(d), "DESIGN.md")) if os.path.exists(p)]
    last = git("log", "-1", "--format=%H %cs", "--", *sys_files) if sys_files and git("rev-parse", "--git-dir") else None
    if not last or git("status", "--porcelain", "--", *sys_files):  # never committed, or changed since the last commit
        return None
    sha, since = last.split()
    code = [f"*{x}" for x in sorted(REVIEW_EXT - {".js", ".ts"})]  # UI files; plain .js and .ts are often servers and tests
    rel = os.path.relpath(os.path.abspath(d), os.path.abspath(project))
    skip = [f":(exclude){rel}"] if rel != "." and not rel.startswith("..") else []
    n = git("rev-list", "--count", f"{sha}..HEAD", "--", *code, *skip)
    return {"commitsSince": int(n), "since": since} if n and n.isdigit() else None


def cmd_review(d, project=None, strict=False, as_json=False, limit=40):
    """End-of-implementation check: hard-coded colors, sizes, radii, shadows and durations that bypass tokens (CSS, JSX style
    objects, Tailwind arbitrary values and default scales, SwiftUI, Compose), role-appropriate token suggestions, and stale
    or untrue DESIGN.md sections."""
    state = merge_defaults(load_state(d))
    files, meta, _ = generate_system(load_state(d))
    prefix = slug(meta.get("prefix") or "ds").replace("-", "")
    if project is None:
        project = os.path.dirname(os.path.abspath(d)) if os.path.basename(os.path.abspath(d)) == DEFAULT_DIR else os.getcwd()
    light = resolve_all(files, {"theme": meta["modes"][0]} if "theme" in files["opendesigner.resolver.json"].get("modifiers", {}) else {})
    ladder = meta["space"]["ladder"]
    # radii and durations as the tokens have them (after the person's values and the standards), not the lever ladder (R18)
    radii = {}
    for k in ("detail", "control", "container", "overlay", "person"):
        v = (light.get(f"radius.{k}") or {}).get("resolved")
        if isinstance(v, dict) and isinstance(v.get("value"), (int, float)) and v["value"] < FULL:
            radii[k] = v["value"]
    sizes = meta["type"]["sizes"]
    order = list(meta["motion"]["durations"])
    durations = {p_[16:]: duration_ms(t["resolved"]) for p_, t in sorted(
        light.items(), key=lambda kv: (order.index(kv[0][16:]) if kv[0][16:] in order else len(order), kv[0]))
        if p_.startswith("motion.duration.") and t["type"] == "duration" and duration_ms(t["resolved"]) is not None}
    durations = {k: (int(v) if float(v).is_integer() else v) for k, v in durations.items()} or dict(meta["motion"]["durations"])
    trans = {}
    for r in ("feedback", "enter", "exit", "expand"):
        t = light.get(f"motion.transition.{r}")
        v = transition_ms(t, light)[0] if t and not spring_ext(t, light) else None
        if v is not None:
            trans[r] = int(v) if float(v).is_integer() else v
    held = std_held(state) if std_has_records(state) else {}

    def cite(path):
        """'; house standard STD-x sets it' for a token a standard holds (R18)."""
        sid = held.get("overrides." + path) or held.get(path)
        return f"; {'project' if sid.startswith('PRJ-') else 'house'} standard {sid} sets it" if sid else ""
    depth_model = meta["elevation"]["model"]
    P, K = prefix.upper(), prefix.capitalize()
    tw_on = os.path.exists(os.path.join(d, "build", "tailwind", "theme.css"))
    tw_reset = (state.get("exports") or {}).get("tailwindReset", True) is not False
    styles_by_size = {}
    for pth, t in light.items():
        if t["type"] == "typography" and not pth.startswith(("text.emphasized.", "text.numeric.")):
            styles_by_size.setdefault(int(_px(t["resolved"]["fontSize"])), pth)

    def color_fix(hx, role, line, tw=False):
        pal = role_palette(light, role, line)
        if not pal:
            return "use a color token"
        tokn, dd = _nearest_color(hx.lower(), pal)
        a1, a2 = oklch_to_oklab(*hex_to_oklch(hx.lower())), oklch_to_oklab(*hex_to_oklch(pal[tokn]))
        if ((a1[1] - a2[1]) ** 2 + (a1[2] - a2[2]) ** 2) ** 0.5 > 0.12:  # another hue altogether: naming a token would mislead (R18)
            return (f"no color token is close to {hx.lower()}: use the {'class' if tw else 'token'} for the role it plays, or add this color "
                    f"as a decision (engine.py set color.<role>.<name> '\"{hx.lower()}\"' --why \"...\")")
        close = "" if dd <= 0.02 else " (closest match)"
        return (f"use {tw_class_for(tokn)}" if tw else f"use var({css_var(prefix, tokn)})") + close

    def shadow_fix(value, tw=False):
        if depth_model == "borders":
            return f"this system uses borders, not shadows (depth model: borders); use var({css_var(prefix, 'color.border.default')})"
        role = _shadow_role(value)
        return f"use shadow-{role}" if tw else f"use var({css_var(prefix, 'elevation.' + role)})"

    def text_fix(val, tw=False):
        near = min(sizes, key=lambda x: (abs(x - val), x))
        style = styles_by_size.get(near)
        if tw and style:
            return f"use {'text-' + '-'.join(style.split('.')[1:])} (a text style)" + ("" if near == val else f"; {val:g}px is not on the scale")
        return (f"use a text style (for example .{prefix}-{'-'.join(style.split('.'))}) or var({css_var(prefix, 'font.size.' + str(near))})"
                if style else f"use var({css_var(prefix, 'font.size.' + str(near))})")

    def space_fix(val, tw=False):
        near = min(ladder, key=lambda x: (abs(x - val), x))
        sem = next((k for k, v in sorted(meta["density"][meta["params"]["space.densityMode"]["value"]]["inset"].items()) if v == near), None)
        if tw:
            return (f"use p-inset-{sem} / gap-inline-{sem}" if sem else f"use the {near}px step") + ("" if near == val else f" ({val:g} is off the {meta['space']['unit']}px ladder)")
        return f"use var({css_var(prefix, 'space.' + str(near))})" + ("" if near == val else f" ({val:g} is off the {meta['space']['unit']}px ladder)")

    def radius_fix(val, tw=False, ctx=""):
        """The radius by the element's role (a button gets the control radius, R18), else the token with exactly that value,
        else the closest."""
        if not radii:
            return "use a radius token"
        role = next((r for r, rx in RADIUS_ROLES if r in radii and re.search(rx, ctx, re.I)), None)
        exact = next((k for k, v in radii.items() if v == val), None)
        k = role or exact or min(radii.items(), key=lambda kv: (abs(kv[1] - val), kv[0]))[0]
        why = f" ({fmt_num(radii[k])}px, the {k} radius{cite('radius.' + k)})"
        return (f"use rounded-{k}" if tw else f"use var({css_var(prefix, 'radius.' + k)})") + why

    TR_WORDS = {"feedback": "hover, press and color changes", "enter": "things entering", "exit": "things leaving",
                "expand": "panels and dialogs entering"}

    def motion_fix(line, v_ms, tw=False, ctx="", animation=False):
        """The duration by the element's role first (exit, close and leave get the exit transition; a modal, drawer, toast
        or tooltip its own duration; a menu the enter transition; hover, buttons and color changes feedback), then the
        token with exactly that value, then the closest one under 300ms (R18). Cites the standard that sets it."""
        text = f"{ctx} {line}"
        role = tok = None
        if RX_ROLE_EXIT.search(text) and "exit" in trans:
            role = "exit"
        else:
            tok = next((f"motion.duration.{k}" for k, rx in DURATION_ROLES if k in durations and re.search(rx, text, re.I)), None)
        if not role and not tok:
            if "feedback" in trans and (RX_ROLE_FEEDBACK.search(text) or (RX_COLOR_PROP.search(line)
                                                                        and not re.search(r"\b(opacity|transform)\b", line))):
                role = "feedback"
            elif RX_ROLE_ENTER.search(text) and "enter" in trans:
                role = "enter"
        if not role and not tok:
            ex_tr = [r for r, v in trans.items() if v == v_ms]
            ex_d = [k for k, v in durations.items() if v == v_ms and k != "extra"]
            if animation and ex_d:
                tok = f"motion.duration.{ex_d[0]}"
            elif ex_tr:
                role = ex_tr[0]
            elif ex_d:
                tok = f"motion.duration.{ex_d[0]}"
            elif trans and not animation:
                role = min(trans, key=lambda r: (abs(trans[r] - v_ms), -trans[r]))
            else:
                tok = f"motion.duration.{_nearest_duration(v_ms, durations)}"
        # a raw value over 300ms is too slow for UI, unless the token suggested for its role is itself longer (a drawer's 500ms)
        want = durations.get(tok[16:]) if tok else trans.get(role)
        slow = f"; {fmt_num(v_ms)}ms is over the 300ms UI limit (STD-easing-duration-06)" if v_ms > 300 and (want or 0) <= 300 else ""
        if tok:
            k = tok[16:]
            return (f"use the {tok} token" if tw else f"use var({css_var(prefix, tok)})") + f" ({fmt_num(durations[k])}ms{cite(tok)}{slow})"
        dur_tok = next((f"motion.duration.{k}" for k, v in durations.items() if v == trans[role]), "")
        why = f"{fmt_num(trans[role])}ms{cite(dur_tok) if dur_tok else ''}{slow}"
        if tw:
            return ("use transition-feedback" if role == "feedback" else f"use duration and easing from motion.transition.{role}") + f" ({why})"
        return (f"use var({css_var(prefix, 'motion.transition.' + role)}-duration) and its -easing "
                f"(the {role} transition: {TR_WORDS[role]}; {why})")
    findings, scanned = [], 0
    wb_std = next((x for x in std_followed(state) if x.get("id") == WHITE_BLACK_RULE), None)
    wb_seen = {}  # "white" / "black" -> (file, line, text) of the first opaque use in code
    tok_rx, token_uses = token_use_rx(prefix), 0
    std_rules = std_review_rules(state)  # house standards followed and project standards that carry a review pattern
    locked_literals = std_locked_literals(state)
    stateroot = os.path.abspath(d)
    for root, dirs, fnames in os.walk(project):
        dirs[:] = sorted(x for x in dirs if x not in REVIEW_SKIP and not x.startswith("."))
        if os.path.abspath(root).startswith(stateroot):
            continue
        for fn in sorted(fnames):
            ext = os.path.splitext(fn)[1].lower()
            if ext not in REVIEW_EXT:
                continue
            path = os.path.join(root, fn)
            try:
                if os.path.getsize(path) > 1_000_000:
                    continue
                with open(path, encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
            except OSError:
                continue
            # a token export copied into the app (tokens.css, theme.css, Tokens.swift) is the system itself, not code that bypasses it
            if "Generated by the OpenDesigner engine" in "".join(lines[:3]):
                continue
            scanned += 1
            rel = os.path.relpath(path, project)
            jsx = ext in (".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte")
            for i, line in enumerate(lines, 1):
                if re.search(r"^\s*(//|/\*|\*|<!--)", line) or "od-ignore" in line:
                    continue
                token_uses += len(tok_rx.findall(line))
                hits = []  # every standard this line breaks, merged into one finding (R28)
                for rx, std in std_rules:  # the first match that is not empty, in the first REVIEW_LINE_CAP characters
                    ms_ = next((m_ for m_ in rx.finditer(line[:REVIEW_LINE_CAP]) if m_.end() > m_.start()), None)
                    if ms_:
                        hits.append((ms_.group(0).strip()[:80], (std.get("review") or {}).get("message") or std.get("rule"), std))
                for key, comp, prop, want, std in locked_literals:  # a locked component value written as a literal
                    if comp.search(line[:REVIEW_LINE_CAP]):
                        for m_ in prop.finditer(line[:REVIEW_LINE_CAP]):
                            if float(m_.group(1)) != want:
                                hits.append((m_.group(0).strip()[:80], f"{key} is {fmt_num(want)} in this system; use the "
                                             f"{css_var(prefix, key)} token instead of {m_.group(1)}", std))
                                break
                if wb_std:
                    for k_, rx_ in RX_PURE.items():
                        m_ = k_ not in wb_seen and rx_.search(line[:REVIEW_LINE_CAP])
                        if m_:
                            wb_seen[k_] = (rel, i, m_.group(0).strip()[:60])
                if hits:
                    ids = list(dict.fromkeys(h[2]["id"] for h in hits))
                    findings.append({"kind": "standard", "file": rel, "line": i, "value": hits[0][0],
                                     "fix": "; ".join(dict.fromkeys(h[1].rstrip(" .") if len(hits) > 1 else h[1] for h in hits if h[1])),
                                     "standard": ids[0], "standards": ids,
                                     "strength": "must" if any(h[2].get("strength") == "must" for h in hits) else "should",
                                     "severity": "warning"})
                line = mask_vars(line)  # every literal is read, even next to a var(); a var() and its fallback are tokens at work (R18)
                ctx = (css_selector_context(lines, i) if ext in (".css", ".scss", ".sass", ".less") else
                       (lines[i - 2] if i > 1 else "")) + " " + line  # the selector or the line above names the element's role
                custom_prop = bool(re.match(r"\s*--", line))  # a custom property definition is a token source, not a bypass
                tw_ctx = bool(RX_TW_CONTEXT.search(line)) or (ext in (".css", ".scss") and "@apply" in line)
                add = lambda kind, value, fix: findings.append({"kind": kind, "file": rel, "line": i, "value": value, "fix": fix})
                # Tailwind arbitrary values and default scales
                spans = []
                if tw_ctx or ext in (".html", ".vue", ".svelte"):
                    for m in RX_TW_ARB.finditer(line):
                        spans.append(m.span())
                        util, val = m.group(2), m.group(3)
                        cls = m.group(0)
                        if val.startswith("#") or val.startswith(("rgb", "hsl", "oklch")):
                            role = "bg" if util == "bg" else "text" if util == "text" else "icon" if util in ("fill", "stroke") else "border"
                            hx = "#" + (val[1:] if len(val) == 7 else "".join(c * 2 for c in val[1:4])) if val.startswith("#") else None
                            add("color", cls, color_fix(hx, role, line, tw=True) if hx and re.fullmatch(r"#[0-9a-fA-F]{6}", hx) else "use a color class from the theme")
                        elif util.startswith("rounded"):
                            mv = re.match(r"(\d+(?:\.\d+)?)px", val)
                            add("radius", cls, radius_fix(float(mv.group(1)), tw=True, ctx=ctx) if mv else "use rounded-control or rounded-container")
                        elif util == "text":
                            mv = re.match(r"(\d+(?:\.\d+)?)(px|rem)", val)
                            add("size", cls, text_fix(float(mv.group(1)) * (16 if mv.group(2) == "rem" else 1), tw=True) if mv else "use a text style class")
                        elif util == "shadow":
                            add("shadow", cls, shadow_fix(val.replace("_", " "), tw=True))
                        elif util in ("duration", "delay"):
                            mv = RX_TIME.search(val)
                            v_ms = float(mv.group(1)) * (1 if mv.group(2) == "ms" else 1000) if mv else 0
                            add("duration", cls, motion_fix(line, v_ms, tw=True, ctx=ctx))
                        elif util in ("leading", "tracking"):
                            add("size", cls, "use a text style class; it sets line height and letter spacing together")
                        else:
                            mv = re.match(r"(-?\d+(?:\.\d+)?)(px|rem)", val)
                            add("size", cls, space_fix(float(mv.group(1)) * (16 if mv.group(2) == "rem" else 1), tw=True) if mv else "use a spacing class")
                    if tw_on and tw_ctx:
                        gone = " (it does not exist once Tailwind's defaults are off)" if tw_reset else ""
                        for m in RX_TW_PALETTE.finditer(line):
                            util = m.group(2)
                            hx = TW_PALETTE_HEX.get(f"{m.group(3)}-{m.group(4)}") if m.group(3) else ("#ffffff" if m.group(5) == "white" else "#000000")
                            role = "bg" if util in ("bg", "from", "to", "via", "accent") else "text" if util in ("text", "placeholder", "caret", "decoration") \
                                else "icon" if util in ("fill", "stroke") else "border"
                            add("color", m.group(0), color_fix(hx, role, line, tw=True) + gone if hx else "use a color class from the theme" + gone)
                        for m in RX_TW_RADIUS.finditer(line):
                            add("radius", m.group(0), radius_fix(TW_RADIUS_PX.get(m.group(2), 4), tw=True, ctx=ctx) + gone)
                        for m in RX_TW_SHADOW.finditer(line):
                            add("shadow", m.group(0), f"use shadow-{TW_SHADOW_ROLE.get(m.group(2), 'raised')}" + gone)
                        for m in RX_TW_TEXT.finditer(line):
                            add("size", m.group(0), text_fix(TW_TEXT_PX[m.group(2)], tw=True) + gone)
                shadow_m = RX_SHADOW.search(line) or RX_DROP_SHADOW.search(line)
                if shadow_m:
                    spans.append(shadow_m.span())
                for m in RX_HEX.finditer(line):  # a raw shadow is replaced whole, color included; other hexes on the line still count
                    if custom_prop or any(a <= m.start() < b for a, b in spans):
                        continue
                    hx = "#" + (m.group(1) if len(m.group(1)) == 6 else "".join(c * 2 for c in m.group(1)))
                    role = ROLE_OF_PROP.get(_prop_before(line, m.start()).replace("_", "-"), None)
                    add("color", hx, color_fix(hx.lower(), role, line))
                if RX_FN.search(line) and not shadow_m and not custom_prop:
                    fm_ = RX_FN.search(line)
                    if not any(a <= fm_.start() < b for a, b in spans):
                        add("color", fm_.group(0) + "...)", "use a color token (var(--" + prefix + "-color-...))")
                if ext == ".swift" and RX_SWIFT_COLOR.search(line):
                    add("color", RX_SWIFT_COLOR.search(line).group(0) + "...)", f"use {P}.Colors.<role> from build/swift/DesignTokens.swift")
                if ext in (".kt", ".kts") and RX_KT_COLOR.search(line) and "DesignTokens" not in rel:
                    add("color", RX_KT_COLOR.search(line).group(0) + ")", f"use Local{K}Colors.current.<role>")
                for m in RX_SIZE.finditer(line):
                    prop, val = m.group(1), float(m.group(3))
                    if val == 0 or (prop in ("width", "height", "top", "left", "right", "bottom", "inset") and val not in ladder):
                        continue
                    if prop == "border-radius":
                        add("radius", f"{prop}: {val:g}px", radius_fix(val, ctx=ctx))
                    elif prop == "font-size":
                        add("size", f"{prop}: {val:g}px", text_fix(val))
                    else:
                        add("size", f"{prop}: {val:g}px", space_fix(val))
                if jsx and not custom_prop:
                    for m in RX_JSX_SIZE.finditer(line):
                        prop, val = m.group(1), float(m.group(3))
                        if val == 0 or (prop in ("width", "height", "top", "left", "right", "bottom", "inset") and val not in ladder):
                            continue
                        if prop.startswith("border") and prop.endswith("Radius"):
                            add("radius", f"{prop}: {m.group(3)}", radius_fix(val, ctx=ctx))
                        elif prop == "fontSize":
                            add("size", f"{prop}: {m.group(3)}", text_fix(val))
                        else:
                            add("size", f"{prop}: {m.group(3)}", space_fix(val))
                if shadow_m and not custom_prop:
                    val = shadow_m.group(0)
                    add("shadow", val.strip()[:80], shadow_fix(val))
                m = RX_MOTION.search(line)
                if m and not custom_prop and "infinite" not in m.group(2):  # looping spinners are not on the duration ladder
                    tm = RX_TIME.search(m.group(2))
                    if tm:
                        v_ms = float(tm.group(1)) * (1 if tm.group(2) == "ms" else 1000)
                        if v_ms > 0:
                            fix = motion_fix(line, v_ms, ctx=ctx,
                                             animation=m.group(1) not in ("transition", "transitionDuration", "transition-duration"))
                            add("duration", f"{m.group(1)}: {tm.group(0)}", fix)
                native = ext in (".swift", ".kt", ".kts") and "DesignTokens" not in rel
                if native and RX_SHADOW_NATIVE.search(line):
                    add("shadow", RX_SHADOW_NATIVE.search(line).group(0) + "...)",
                        "use an elevation token: the raised, floating or overlay shadow in build/swift or build/compose")
                    continue
                if native:
                    ma = RX_SWIFT_ANIM.search(line) if ext == ".swift" else RX_KT_ANIM.search(line)
                    if ma:
                        v_ms = float(ma.group(ma.lastindex)) * (1000 if ext == ".swift" else 1)
                        near = _nearest_duration(v_ms, durations) if v_ms > 0 else "instant"
                        name = camel(["duration", near])
                        add("duration", ma.group(0) + ")", f"use {P}.Motion.{name}" if ext == ".swift" else f"use {K}Motion.{name}Ms")
                        continue
                if native:
                    for m in RX_RADIUS_NATIVE.finditer(line):
                        add("size", m.group(0), f"use {P}.Space / {P}.Radius (Swift) or {K}Space (Compose)")
                        break
    # stale or untrue DESIGN.md / PRODUCT.md sections: render now and compare section by section
    stale, untrue = [], []
    out_dir = os.path.dirname(os.path.abspath(d)) if os.path.basename(os.path.abspath(d)) == DEFAULT_DIR else d
    dm = os.path.join(out_dir, "DESIGN.md")
    if os.path.exists(dm):
        with open(dm, encoding="utf-8") as f:
            cur = f.read()
        fresh = render_design_md(d, files, meta, state, cur)

        def secs(text):
            return {x.split("\n", 1)[0].strip(): x for x in re.split(r"^## ", text, flags=re.M)[1:]}
        a, b = secs(cur), secs(fresh)
        stale = [t for t in b if a.get(t) != b[t]]
        missing = [t for t in b if t not in a]
        answered = answered_ids(state)
        for fname in ("DESIGN.md", "PRODUCT.md"):
            fp = os.path.join(out_dir, fname)
            if os.path.exists(fp):
                with open(fp, encoding="utf-8") as f:
                    for q in re.findall(r"not recorded yet \((Q-[a-z]+-\d+)\)", f.read(), flags=re.I):
                        if q in answered:
                            untrue.append(f"{fname} says {q} is not recorded, but it was answered")
    else:
        missing = ["DESIGN.md"]
    if wb_std and len(wb_seen) == 2:  # one finding for the pair, placed at the black
        (wf, wl, wv), (bf, bl, bv) = wb_seen["white"], wb_seen["black"]
        findings.append({"kind": "standard", "file": bf, "line": bl, "value": bv,
                         "fix": f"pure black here and pure white at {wf}:{wl} ({wv}): never both in one product; use an off-black "
                                "such as #111111 with white, or an off-white with black",
                         "standard": WHITE_BLACK_RULE, "standards": [WHITE_BLACK_RULE], "strength": "must", "severity": "warning"})
    by = {}
    for f_ in findings:
        by[f_["kind"]] = by.get(f_["kind"], 0) + 1
    taste = taste_index(d, state)  # dials that moved away from the person's taste: flagged, never a failure (taste is theirs)
    drift = taste_py.drift(taste, meta["dials"]) if taste else []
    r_errs, r_notes = research_py.review(d, state) if research_py else ([], [])
    hard = sum(1 for f_ in findings if f_["kind"] != "standard")
    age = system_age(d, project) if scanned else None
    result = {"project": project, "filesScanned": scanned, "counts": by, "tokenUses": token_uses, "systemAge": age,
              "tokens": "none" if hard and not token_uses else "losing" if hard > token_uses else "ok",
              "systemBehind": bool(age and age["commitsSince"] >= SYSTEM_AGE_COMMITS),
              "findings": findings[:500], "staleSections": stale,
              "missing": missing, "untrue": sorted(set(untrue)), "tasteDrift": drift,
              "research": {"errors": r_errs, "notes": r_notes, "status": (state.get("research") or {}).get("status") or "none"}}
    if as_json:
        print(json.dumps(result, indent=2))
    else:
        tokf = [f_ for f_ in findings if f_["kind"] != "standard"]
        stdf = [f_ for f_ in findings if f_["kind"] == "standard"]
        total = len(tokf)
        print(f"Review of {project}: {scanned} files scanned.")
        if not scanned:
            print("No code yet, so there is nothing to check.")
        elif total:
            print(f"{total} hard-coded value{'s' if total != 1 else ''} skip the tokens: "
                  + ", ".join(f"{n} {k}{'s' if n != 1 else ''}" for k, n in sorted(by.items()) if k != "standard") + ".")
            for f_ in tokf[:limit]:
                print(f"  {f_['file']}:{f_['line']}  {f_['value']}  ->  {f_['fix']}")
            if total > limit:
                print(f"  ... and {total - limit} more (use --json for all).")
            print("  To keep a raw value on purpose, add the comment od-ignore on that line.")
        else:
            print("No hard-coded colors, sizes, radii, shadows or durations found: the code uses the tokens.")
        if result["tokens"] == "none":
            print(f"Tokens are not in charge: the code uses none of them (no var(--{prefix}-...)). Import "
                  "opendesigner/build/css/tokens.css, or the export for your stack, and move these values onto tokens before the next draft.")
        elif result["tokens"] == "losing":
            print(f"Tokens are losing: {token_uses} token use{'s' if token_uses != 1 else ''} against {hard} hard-coded values. "
                  "Move values onto tokens before the next draft.")
        if result["systemBehind"]:
            print(f"The system is behind the code: {age['commitsSince']} commits changed code since state.json or DESIGN.md last "
                  f"changed ({age['since']}). Record what the code decided since (engine.py set, then design-md), or bring the code "
                  "back to the tokens, before the next draft.")
        if stdf:
            print(f"{len(stdf)} line{'s' if len(stdf) != 1 else ''} break{'s' if len(stdf) == 1 else ''} a standard:")
            for f_ in stdf[:limit]:
                print(f"  {f_['file']}:{f_['line']}  {f_['value']}  ->  {f_['fix']} ({', '.join(f_.get('standards') or [f_['standard']])}, "
                      f"{f_['strength']})")
            if len(stdf) > limit:
                print(f"  ... and {len(stdf) - limit} more (use --json for all).")
            ids_ = {x for f_ in stdf for x in f_.get("standards") or [f_["standard"]]}
            if any(not i.startswith("PRJ-") for i in ids_):
                print("  Fix the code. A house standard changes only when the person asks: engine.py standard override <id> --why \"<their words>\".")
            if any(i.startswith("PRJ-") for i in ids_):
                print("  Fix the code. A project standard (PRJ-...) is the person's own rule; it goes only when they ask: "
                      "engine.py standard remove <id> --why \"<their words>\".")
        for u in sorted(set(untrue)):
            print(f"Untrue: {u}. Fix: run `engine.py design-md`.")
        if missing == ["DESIGN.md"]:
            print("DESIGN.md is missing. Run `engine.py design-md`.")
        elif stale:
            print(f"DESIGN.md is out of date in {len(stale)} section{'s' if len(stale) != 1 else ''}: {', '.join(stale)}. "
                  "Fix: run `engine.py design-md`. Notes inside od:keep blocks are kept.")
        elif not untrue:
            print("DESIGN.md matches state.json.")
        if drift:
            print(f"{len(drift)} dial{'s' if len(drift) != 1 else ''} moved away from the person's taste (taste index):")
            for t_ in drift:
                why = (f"; past a red line: {', '.join(taste_py.line_text(r) for r in t_['redLines'])}" if t_["redLines"] else "")
                print(f"  {t_['dial']} is {t_['system']}; their taste is {t_['taste']} ({round(t_['conf'] * 100)}% sure: {t_['sources']}){why}")
            print("  Show them the difference and ask. To go back: engine.py set dials.<dial> <taste value> --set-by assumed; "
                  "if they keep it, record it as chosen and the index follows.")
        elif taste:
            print("The system matches the person's taste index.")
        for t_ in r_errs:
            print(f"User research: {t_}. Fix the file, then engine.py research add {research_py.FILE}.")
        for t_ in r_notes:
            print(f"User research: {t_}")
    track(d, "review")
    return 1 if strict and (findings or stale or missing or untrue or r_errs) else 0


# =============================================================================================
# show: fill a visual template with real values from the current state (U5 F19, F34)
# =============================================================================================

TEMPLATE_QUESTIONS = {"palette": ("Q-color-03", ["tonal", "vivid", "monochrome", "expressive"]),
                      "type-scale": ("Q-type-09", ["1.2", "1.25", "1.333"]),
                      "spacing-ruler": ("Q-space-01", ["4-grid-8-rhythm", "8"]),
                      "radius": ("Q-shape-01", ["square", "subtle", "soft", "pill"]),
                      "elevation": ("Q-depth-01", ["borders", "ring-shadow", "tonal", "shadow"]),
                      "motion": ("Q-motion-01", ["productive", "two-mode", "springs"]),
                      "component-sheet": ("Q-dir-01", []),
                      "option-gallery": ("Q-dir-01", ["flat2", "tonal", "glass"])}


def what_if(state, qid=None, value=None, keep_locked=False):
    """A generated system for the state with one answer applied; the state on disk is never touched. keep_locked: the
    answer does not move a value the person locked or a standard holds, so the option shows only what it can still
    change (R10)."""
    s2 = merge_defaults(copy.deepcopy(state))
    held = std_held(s2) if keep_locked and std_has_records(s2) else {}
    if qid:
        s2.setdefault("answers", {})[qid] = {"value": value, "set_by": "chosen"}
        for pth, v in answer_effects(qid, value, s2).items():
            if keep_locked and (is_locked(s2, pth) or pth in held):
                continue
            _store(s2, pth, v, "chosen", "what-if", False)
    files, meta, ctx = generate_system(s2)
    return files, meta, s2


def _css_shadow(val):
    layers = val if isinstance(val, list) else [val]
    out = []
    for lay in layers:
        for sub in (lay if isinstance(lay, list) else [lay]):
            if not isinstance(sub, dict):
                continue
            col = css_color(sub["color"]) if isinstance(sub.get("color"), dict) else "transparent"
            nums = " ".join(f"{fmt_num(_px(sub[k]))}px" for k in ("offsetX", "offsetY", "blur", "spread"))
            if any(_px(sub[k]) for k in ("offsetY", "blur", "spread")):
                out.append(("inset " if sub.get("inset") else "") + f"{nums} {col}")
    return ", ".join(out) or "none"


def _css_gradient(t):
    """CSS for one resolved gradient token, from its stops and the kind, angle and interpolation in $extensions."""
    ext = (t.get("$extensions") or {}).get(NS, {})
    stops = ", ".join(f"{css_color(s_['color'])} {fmt_num(rnd(s_['position'] * 100, 2))}%" for s_ in t["resolved"])
    how = f"in {ext.get('interpolation', 'oklab')}"
    if ext.get("kind") == "radial":
        x, y = ext.get("at") or [50, 50]
        return f"radial-gradient({ext.get('shape', 'circle')} at {fmt_num(x)}% {fmt_num(y)}% {how}, {stops})"
    return f"linear-gradient({fmt_num(ext.get('angle', 180))}deg {how}, {stops})"


def _style_slots(fl, meta, v):
    """The option gallery's style slots, from real tokens: thick outlines, button shadows for the offset, extruded, clay and
    glow models, glass on cards, a mesh page and a texture layer. Absent tokens leave the template's plain defaults."""
    out = {}
    bd = (meta.get("shape") or {}).get("borderDefault", 1)
    if bd > 1:
        out.update({"border-w": f"{bd}px", "border": v.get("fg"), "border-strong": v.get("fg"), "btn-edge": v.get("fg")})
    if (meta.get("elevation") or {}).get("model") in ("offset", "extruded", "clay", "glow") and "elevation.raised" in fl:
        out["btn-shadow"] = _css_shadow(fl["elevation.raised"]["resolved"])
    if "color.surface.glass" in fl:
        out["card-bg"] = css_color(fl["color.surface.glass"]["resolved"])
        if "material.glass.blur" in fl:
            out["backdrop"] = f"blur({fmt_num(_px(fl['material.glass.blur']['resolved']))}px) saturate(180%)"
    mesh = sorted((p for p in fl if re.fullmatch(r"gradient\.mesh\.\d+", p)))
    if mesh and v.get("bg"):  # a veil of the page color keeps text on the mesh readable (DC-L01-25: 4.5:1 at the worst spot)
        r_, g_, b_ = hex_to_rgb8(v["bg"])
        veil = f"rgb({r_} {g_} {b_} / 0.55)"
        out["page"] = f"linear-gradient({veil}, {veil}), " + ", ".join(_css_gradient(fl[p]) for p in mesh) + f", {v['bg']}"
    ink = v.get("fg") or "#000000"
    paint = {"grain": ("url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E"
                       "%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E"
                       "%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", "overlay"),
             "halftone": (f"radial-gradient({ink} 1.5px, transparent 1.6px) 0 0 / 8px 8px", "normal"),
             "scanlines": (f"repeating-linear-gradient(0deg, {ink} 0 1px, transparent 1px 3px)", "normal")}
    for kind, (image, blend) in paint.items():
        if f"texture.{kind}.opacity" in fl:
            out.update({"texture": image, "texture-o": fmt_num(fl[f"texture.{kind}.opacity"]["resolved"]), "texture-blend": blend})
    return out


def template_vars(files, meta):
    """The --t-* variables the component-sheet and option-gallery templates read, from generated tokens."""
    res = files["opendesigner.resolver.json"]
    mods = res.get("modifiers", {})
    dens = meta["density"][meta["params"]["space.densityMode"]["value"]]
    base = resolve_all(files, {})
    fam = base["font.family.text"]["resolved"]
    shared = {"font": ", ".join(f'"{f}"' if " " in f else f for f in (fam if isinstance(fam, list) else [fam])),
              "size": f"{meta['type']['base']}px", "radius-control": f"{meta['shape']['control'] if meta['shape']['control'] != 'full' else 999}px",
              "radius-container": f"{meta['shape']['container']}px", "control-h": f"{dens['control']['md']}px",
              "pad-x": f"{dens['inset']['lg']}px", "gap": f"{dens['stack']['md']}px", "ratio": str(meta["type"]["ratio"]),
              "heading-weight": str(meta["type"]["weights"]["heading"])}
    out = {"shared": shared}
    for mode in (meta.get("modes") or ["light"]):
        fl = resolve_all(files, {"theme": mode} if "theme" in mods else {})
        H = lambda p: hex_of(fl[p]["resolved"]) if p in fl else None
        v = {"bg": H("color.surface.base"), "surface": H("color.surface.raised"), "surface-2": H("color.bg.neutral.subtle"),
             "fg": H("color.text.primary"), "fg-muted": H("color.text.secondary"), "border": H("color.border.subtle"),
             "border-strong": H("color.border.strong"), "accent": H("color.bg.action.primary"), "accent-hover": H("color.bg.action.primary-hover"),
             "accent-pressed": H("color.bg.action.primary-pressed"), "on-accent": H("color.text.on-action"), "accent-subtle": H("color.bg.accent.subtle"),
             "focus": H("color.border.focus"), "danger": H("color.bg.danger.bold"), "on-danger": H("color.text.on-danger"),
             "danger-subtle": H("color.bg.danger.subtle"), "success-subtle": H("color.bg.success.subtle"), "on-success-subtle": H("color.text.success"),
             "warning-subtle": H("color.bg.warning.subtle"), "on-warning-subtle": H("color.text.warning"),
             "shadow-1": _css_shadow(fl["elevation.raised"]["resolved"]) if "elevation.raised" in fl else "none",
             "shadow-2": _css_shadow(fl["elevation.floating"]["resolved"]) if "elevation.floating" in fl else "none"}
        v.update(_style_slots(fl, meta, v))
        out[mode] = {k: x for k, x in v.items() if x}
    if "dark" not in out:
        out["dark"] = dict(out.get("light", {}))
    return out


def motion_option(files, meta):
    """The motion template's numbers for one generated system, read from its resolved tokens (after the person's values
    and the standards), never from the lever ladder: durations, the exit that goes with the long step, curves as CSS,
    the enter scale, and off when motion is off (R10)."""
    fl = resolve_all(files, {"motion": "standard"} if "motion" in files["opendesigner.resolver.json"].get("modifiers", {}) else {})
    dur = lambda k, dflt: duration_ms((fl.get(f"motion.duration.{k}") or {}).get("resolved")) or dflt
    ease = lambda k: (fl.get(f"motion.easing.{k}") or {}).get("resolved")
    mo = meta["motion"]
    out = {"durations": {"short": dur("short", mo["durations"]["short"]), "medium": dur("medium", mo["durations"]["medium"]),
                         "long": dur("long", mo["durations"]["long"]), "long-exit": dur("long-exit", mo["durations"]["long-exit"])},
           "easing": {k: css_easing_text(ease(k) if isinstance(ease(k), list) else mo[k]) for k in ("standard", "enter", "exit")},
           "scale": (fl.get("motion.scale.enter") or {}).get("resolved") if isinstance((fl.get("motion.scale.enter") or {}).get("resolved"), (int, float)) else 0.95}
    out["durations"] = {k: int(v) if float(v).is_integer() else v for k, v in out["durations"].items()}
    sp = spring_ext(fl.get("motion.spring.spatial.fast") or {}, fl)  # a switch knob moves on the small-component spring
    if sp and "css" in sp:
        out["toggle"] = {"duration": sp["css"]["durationMs"], "easing": sp["css"]["easing"]}
    if mo.get("motionOff"):
        out["off"] = True
        out["durations"] = {k: 0 for k in out["durations"]}
    return out


def css_easing_text(v):
    """cubic-bezier(...) for a curve list; a string (a CSS keyword or linear()) as it is."""
    return css_bezier(v) if isinstance(v, list) else str(v)


def taste_index(d, state=None):
    """The project's taste index (scripts/taste.py), computed now from the poll, the person's decisions, references, style
    pick and feel words; None without any taste evidence. It never leaves the project."""
    if taste_py is None or not d or not os.path.isdir(d):
        return None
    index = taste_py.build_index(d, sys.modules[__name__], state)
    return index if taste_py.has_evidence(index) else None


# The pairs the palette preview shows, in plain words: the ones a person reads most. validate checks every pair the system
# promises (contrast_pairs); these are the same pairs, measured the same way, with the minimum validate uses.
PALETTE_PAIRS = [("Body text on the page", "color.text.primary", "color.surface.base", None),
                 ("Muted text on the page", "color.text.secondary", "color.surface.base", None),
                 ("Faint text on the page", "color.text.tertiary", "color.surface.base", None),
                 ("Link on the page", "color.text.link", "color.surface.base", "Read more"),
                 ("Label on the main button", "color.text.on-action", "color.bg.action.primary", "Save"),
                 ("Error text on the page", "color.text.danger", "color.surface.base", "Try again"),
                 ("Input border", "color.border.input", "color.surface.base", None),
                 ("Focus ring", "color.border.focus", "color.surface.base", None)]


def palette_pairs(files, meta):
    """PALETTE_PAIRS with each colour resolved per mode, for the palette template. The page measures the ratio itself from
    these hex values, so the table cannot drift from the swatches."""
    res = files["opendesigner.resolver.json"]
    has_theme = "theme" in res.get("modifiers", {})
    modes = meta.get("modes") or (list(res["modifiers"]["theme"]["contexts"]) if has_theme else ["light"])
    toks = {m: resolve_all(files, {"theme": m} if has_theme else {}) for m in modes}
    promised = {(pr["mode"], pr["fg"], pr["bg"]): pr for pr in meta.get("contrastPairs", [])}
    out = []
    for label, fg, bg, sample in PALETTE_PAIRS:
        prs = {m: promised.get((m, fg, bg)) for m in modes}
        if not all(prs.values()) or not all(fg in toks[m] and bg in toks[m] for m in modes):
            continue  # this system has no such pair (for example no danger colour)
        first = prs[modes[0]]
        row = {"label": label, "fg": {}, "bg": {}, "min": first["min"], "kind": "text" if first["kind"] == "text" else "edge"}
        for m in modes:
            row["fg"][m], row["bg"][m] = pair_hexes(toks[m], prs[m])
            if prs[m].get("inner") and prs[m]["inner"] in toks[m]:
                row.setdefault("inner", {})[m] = hex_of(toks[m][prs[m]["inner"]]["resolved"])
        if any(r["fg"] == row["fg"] and r["bg"] == row["bg"] for r in out):
            continue  # same colours as a row above (faint text often shares the muted step): one row says it
        if sample:
            row["sample"] = sample
        out.append(row)
    return out


def build_payload(state, template, values=None, labels=None, taste=None):
    """The od-data payload for one template, from the current state and what-if copies (one per option). values and labels
    replace the template's own options (the style lab's tiles: any named or experimental style at Q-dir-01). taste: the
    project's taste index; the option gallery is then ordered by fit and leaves out a direction past a red line on a dial
    the directions differ on (if every one is past a line, all stay, with a warning)."""
    if template not in TEMPLATE_QUESTIONS:
        raise SystemExit(f"unknown template {template!r}; choose one of: {', '.join(TEMPLATE_QUESTIONS)}")
    qid, values = TEMPLATE_QUESTIONS[template][0], values or TEMPLATE_QUESTIONS[template][1]
    cur = answer_value((state.get("answers") or {}).get(qid)) if (state.get("answers") or {}).get(qid) else None
    name = state.get("name") or "Your product"
    q = questions().get(qid) or {}
    label = lambda v: (labels or {}).get(v) or option_label(qid, v) or str(v)
    fixed = sorted(k for k, v in (state.get("dials") or {}).items() if dial_value(v) is not None)
    note_fixed = (f" Your earlier answers fix {', '.join(fixed)}, so the options differ in the rest." if fixed else "")
    payload = {"question": qid, "recommended": str(cur or question_default(state, qid) or (values[0] if values else "")),
               "generatedBy": f"engine.py show {template} (OpenDesigner engine {ENGINE_VERSION}); real values from {name}'s state"}
    if template == "palette":
        payload.update(title=f"{name}: how colorful", subtitle="Each option is your palette, built for real. The shades go from light to dark; "
                       "the number under each is its contrast with the first shade. The table below checks the pairs people read "
                       "most; engine.py validate checks every pair." + note_fixed, options=[])
        for v in values:
            files, meta, s2 = what_if(state, qid, v)
            ramps = [{"name": n, "light": meta["ramps"][n]["light"]["hex"], "dark": meta["ramps"][n]["dark"]["hex"]}
                     for n in ("accent", "accent2", "neutral") if n in meta["ramps"]]
            ci_ = meta["color"]
            note = {"monochrome": "almost no color", "neutral": "a little color", "tonalSpot": "calm color", "expressive": "strong color",
                    "vibrant": "the strongest color"}.get(ci_["scheme"], ci_["scheme"])
            note += f", {ci_.get('accentCount', 1)} accent{'s' if ci_.get('accentCount', 1) != 1 else ''}"
            note += "; your brand color exactly on buttons" if ci_.get("pinnedStep") else (f"; buttons {ci_.get('brandAdjustedTo')}" if ci_.get("brandAdjustedTo") else "")
            payload["options"].append({"value": v, "label": label(v), "note": note, "ramps": ramps, "pairs": palette_pairs(files, meta)})
    elif template == "type-scale":
        files, meta, s2 = what_if(state)
        payload.update(title=f"{name}: text sizes", subtitle="Your body size with three ratios. Each size is the one below it times the ratio, "
                       "rounded to whole pixels.", options=[{"value": v, "label": label(v), "note": {"1.2": "calm, dense screens", "1.25": "balanced",
                                                                                                     "1.333": "expressive, marketing"}[v],
                                                          "base": meta["type"]["base"], "ratio": float(v)} for v in values],
                       adjust={"base": "OD:set raw.baseSize={v}", "ratio": "OD:set Q-type-09={v}"},
                       sample={"persuade": f"{name}: join us", "finance": "Bills due this week", "read": f"Getting started with {name}"}.get(
                           preview_kind(state), "Users waiting for review"), fontHref=None)
    elif template == "spacing-ruler":
        payload.update(title=f"{name}: spacing steps", subtitle="The ruler is drawn at real size. Red dashes mark padding; red numbers mark gaps.",
                       options=[])
        for v in values:
            files, meta, s2 = what_if(state, qid, v)
            lad = [x for x in meta["space"]["ladder"] if x > 0][:9]
            dens = meta["density"][meta["params"]["space.densityMode"]["value"]]
            payload["options"].append({"value": v, "label": label(v), "note": f"{meta['space']['unit']}px unit",
                                       "steps": [{"name": str(i + 1), "px": x} for i, x in enumerate(lad)],
                                       "demo": {"pad": str(min(4, len(lad))), "gap": str(min(3, len(lad))), "inner": "1"},
                                       "controls": dens["control"]})
    elif template == "radius":
        files, meta0, _s = what_if(state)
        fl = resolve_all(files, {"theme": "light"} if "theme" in files["opendesigner.resolver.json"].get("modifiers", {}) else {})
        payload.update(title=f"{name}: corners", subtitle="Pick a style, or drag the Roundness dial. Cards get about 1.5 times the button corners.",
                       options=[], dial={"line": "OD:set dials.roundness={v}", "value": meta0["dials"]["roundness"],
                                         "bands": lever_index()["radius.control"]["map"]["bands"]},
                       surface={"light": [hex_of(fl["color.surface.raised"]["resolved"]), hex_of(fl["color.text.primary"]["resolved"])],
                                "dark": [hex_of(fl["color.surface.raised"]["resolved"]), hex_of(fl["color.text.primary"]["resolved"])]})
        for v in values:
            files, meta, s2 = what_if(state, qid, v)
            c = meta["shape"]["control"]
            payload["options"].append({"value": v, "label": label(v), "note": f"buttons {c if c != 'full' else 'pill'}{'px' if c != 'full' else ''}",
                                       "radii": {"control": 9999 if c == "full" else c, "container": meta["shape"]["container"]}})
    elif template == "elevation":
        payload.update(title=f"{name}: depth", subtitle="Three surfaces on the page, then every level with its exact CSS." + note_fixed, options=[])
        for v in values:
            files, meta, s2 = what_if(state, qid, v)
            levels = {}
            for mode in meta.get("modes") or ["light"]:
                fl = resolve_all(files, {"theme": mode} if "theme" in files["opendesigner.resolver.json"].get("modifiers", {}) else {})
                row = [{"name": "0", "border": f"1px solid {hex_of(fl['color.border.subtle']['resolved'])}"}]
                for i, e in enumerate(("raised", "floating", "overlay"), 1):
                    sh = _css_shadow(fl[f"elevation.{e}"]["resolved"])
                    ent = {"name": str(i), "shadow": sh} if sh != "none" else {"name": str(i), "border": f"1px solid {hex_of(fl['color.border.default']['resolved'])}"}
                    if mode == "dark":
                        ent["bg"] = hex_of(fl["color.surface." + ("raised" if i == 1 else "overlay")]["resolved"])
                    row.append(ent)
                levels[mode] = row
            payload["options"].append({"value": v, "label": label(v), "note": meta["elevation"]["model"], "levels": levels})
    elif template == "motion":
        payload.update(title=f"{name}: motion", subtitle="Press Play to feel each option. Each one is built from your own tokens, with the "
                       "house standards and anything you locked kept, so only what the answer can still change differs. Things leave "
                       "about 20% faster than they arrive." + note_fixed, options=[])
        notes = {"none": "nothing moves; changes happen in place", "productive": "quick, no overshoot", "two-mode": "quick, a few bolder moments",
                 "springs": "springs where a finger moves things"}
        now = motion_option(*what_if(state)[:2])
        payload["options"].append(dict(now, value="current", label=f"{name} as it is now", od=[],
                                       keep="(no change: keep the motion as it is)", note="your tokens today"))
        for v in ["none"] + values:
            files, meta, s2 = what_if(state, qid, v, keep_locked=True)
            breaks = [s_["id"] for s_, _v in std_option_breaks(state, qid, v)]
            opt = motion_option(files, meta)
            same = " (the same as now: standards or your locks fix these values)" if opt == now else ""
            payload["options"].append(dict(opt, value=v, label=label(v),
                                           note=notes.get(v, "") + same + (f" (breaks {', '.join(breaks)})" if breaks else ""),
                                           **({"breaks": breaks} if breaks else {})))
        rec = payload["recommended"]
        if any(o["value"] == rec and o.get("breaks") for o in payload["options"]):
            payload["recommended"] = "current"  # never recommend an option a standard rules out
    elif template == "component-sheet":
        files, meta, s2 = what_if(state)
        pid = effective_preset(state)[0] or "custom"
        payload.update(title=f"{name}: components", subtitle="Every part here uses only your tokens. Hover, press Tab to move the focus, "
                       "and flip the switch.", recommended=pid,
                       options=[{"value": pid, "label": f"{name} as it is now", "note": brand_line(meta, s2, plain=True) or "",
                                 "vars": template_vars(files, meta)}])
    elif template == "option-gallery":
        payload.update(title=f"{name}: {len(values)} directions" if labels else f"{name}: three directions",
                       subtitle="Each direction is built for real from your answers. Pick one, or take one "
                       "part from another. The logo spot stays empty on purpose." + note_fixed, remix=["color", "type", "shape", "depth"], options=[])
        if labels:
            payload["recommended"] = str(cur) if cur in values else values[len(values) // 2]  # a recommendation sits in the middle
        for v in values:
            files, meta, s2 = what_if(state, qid, v)
            dw = {k: meta["dials"][k] for k in DIALS}
            st_ = effective_style(s2)
            payload["options"].append({"value": v, "label": label(v),
                                       "summary": (f"{st_['plain']}. " if st_ else "") + f"{meta['elevation']['model']} depth, corners "
                                                  f"{meta['shape']['control']}, {meta['color']['scheme']} color, body {meta['type']['base']}px.",
                                       "safe": [f"Contrast passes in light and dark ({meta['color']['textMin']}:1 text)"],
                                       "risks": ([{"what": "Glass on bars", "gain": "depth and polish", "cost": "can hide content; needs solid fallbacks"}]
                                                 if v == "glass" else []),
                                       "dials": dw, "vars": template_vars(files, meta)})
        if taste:  # the person's taste orders the directions and leaves out one past a red line (references/taste.md)
            payload["options"], left, past = taste_py.rank(taste, payload["options"], keep=cur)
            shown = [str(o["value"]) for o in payload["options"]]
            if left:  # the title counts the directions shown, not the ones left out
                n = len(shown)
                payload["title"] = f"{name}: {n if labels else ('one', 'two', 'three')[n - 1]} direction{'s' if n != 1 else ''}"
                payload["subtitle"] += " Left out, past a line you drew: " + taste_py.past_text(left) + "."
            if past:  # every direction is past a line: show them all and say so, never an empty gallery
                payload["warning"] = "Every direction crosses a line you drew, so none is left out: " + taste_py.past_text(past) + "."
                payload["subtitle"] += " " + payload["warning"]
            if taste_py.sure(taste) and shown:
                payload["subtitle"] += " Ordered by how well each fits your taste, best first."
                if str(cur) not in shown:
                    payload["recommended"] = shown[0]
            if shown and payload["recommended"] not in shown:
                payload["recommended"] = shown[0]  # never recommend a direction that was left out
    return payload


def cmd_show(d, template, out=None, open_=False, as_json=False, values=None, labels=None, state=None, filename=None):
    """Fill assets/templates/<template>.html with the current state (show.py's od-data substitution) and write it."""
    state = state if state is not None else merge_defaults(load_state(d))
    name = template[:-5] if template.endswith(".html") else template
    payload = build_payload(state, name, values=values, labels=labels,
                            taste=taste_index(d, state) if name == "option-gallery" else None)
    if as_json:
        print(json.dumps(payload, indent=1, ensure_ascii=False))
        return payload
    tdir = os.path.join(SKILL_ROOT, "assets", "templates")
    tpath = os.path.join(tdir, f"{name}.html")
    if not os.path.exists(tpath):
        raise SystemExit(f"no template at {tpath}")
    with open(tpath, encoding="utf-8") as f:
        html = f.read()
    blob = json.dumps(payload, indent=1, ensure_ascii=False).replace("</", "<\\/")
    html = html.replace(">Acme<", f">{_esc(state.get('name') or 'Your product')}<")  # the templates' stand-in name
    html, n = re.subn(r'(<script type="application/json" id="od-data">).*?(</script>)',
                      lambda m: m.group(1) + "\n" + blob + "\n" + m.group(2), html, count=1, flags=re.S)
    if n != 1:
        raise SystemExit("template has no od-data block")
    dest = os.path.join(out or os.path.join(d, "preview"), f"{filename or name}.html")
    write_text(dest, html)
    print(f"wrote {dest}")
    if open_:
        webbrowser.open("file://" + os.path.abspath(dest))
    return dest


FEEDBACK_KINDS = {"gap": "gap", "bug": "bug", "confusing": "confusing", "idea": "enhancement"}
ISSUES_URL = "https://github.com/ckryptickunal/OpenDesigner/issues/new"


NOTE_STOP = frozenset("a all also an and are as at be by do does each every for from in is it its just make must of on or our "
                      "please should so that the them then this to we with you your".split())
NOTE_SPELLING = {"center": "centre", "centered": "centred", "centering": "centring", "color": "colour", "colors": "colours",
                 "gray": "grey", "grays": "greys", "removed": "remove", "removing": "remove", "added": "add", "adding": "add",
                 "doesnt": "dont"}
RX_NOTE_ROW = re.compile(r"^\|\s*(N-\d+)\s*\|\s*(.*?)\s*\|\s*(\d+)\s*\|\s*([^|]*?)\s*\|")
NOTE_MATCH = 0.6  # share of the shorter note's words that must match an earlier note for it to count as a repeat
NOTE_POLAR = frozenset("no not never dont don without avoid more less bigger smaller larger lighter darker wider narrower add remove"
                       .split())  # two notes that differ in these say opposite things, so they are never one note


def note_words(text):
    """The words that carry a note's meaning, roughly stemmed, so "Centre every heading" matches "center the headings"."""
    out = set()
    for w in re.findall(r"[a-z0-9#]+", text.lower()):
        w = NOTE_SPELLING.get(w, w)
        if w in NOTE_STOP or len(w) < 2:
            continue
        if w in NOTE_POLAR:
            out.add(w)
            continue
        for suf in ("ings", "ing", "ed", "s"):
            if w.endswith(suf) and len(w) - len(suf) >= 4:
                w = w[:-len(suf)]
                break
        out.add(w[:-1] if len(w) > 4 and w.endswith("e") else w)
    return out


def read_notes(fp):
    """[{id, text, said, last}] from opendesigner/RULES.md, in file order."""
    if not os.path.exists(fp):
        return []
    with open(fp, encoding="utf-8") as f:
        return [{"id": m.group(1), "text": m.group(2), "said": int(m.group(3)), "last": m.group(4)}
                for m in (RX_NOTE_ROW.match(x.rstrip("\n")) for x in f) if m]


def write_rules(fp, notes):
    def table(rows, head):
        return f"| # | {head} | Said | Last |\n|---|---|---|---|\n" + "".join(
            f"| {n['id']} | {n['text']} | {n['said']} | {n['last']} |\n" for n in rows)
    write_text(fp, "# Rules\n\nThe owner's notes on this project, from `engine.py feedback --kind note`. Read this before every round. "
                   "A note said twice is a rule: apply it everywhere, in every later round. Edit rows in place; text outside the "
                   "tables is not kept.\n\n"
                   "## Rules (said twice or more)\n" + table([n for n in notes if n["said"] >= 2], "Rule") +
                   "\n## Notes (said once)\n" + table([n for n in notes if n["said"] < 2], "Note"))


def record_note(d, text, same=None, quiet=False):
    """An owner's note on the work, counted. A repeat (same words, or --same N-xx) adds to the earlier note: said twice it is a
    rule in RULES.md; at three times the agent offers a GitHub issue, which needs the person's yes."""
    fp = os.path.join(d, "RULES.md")
    notes, today = read_notes(fp), _dt.date.today().isoformat()
    text = text.replace("|", "/")
    if same and same.lower() == "new":
        hit = None
    elif same:
        hit = next((n for n in notes if n["id"] == same.upper()), None)
        if not hit:
            raise SystemExit(f"{same} is not in {fp}. Nothing was written.")
    else:
        mine = note_words(text)

        def score(n):
            theirs = note_words(n["text"])
            both = len(mine & theirs)
            if not both or (mine & NOTE_POLAR) != (theirs & NOTE_POLAR):
                return 0
            return both / min(len(mine), len(theirs))
        best = max(notes, key=score, default=None)
        hit = best if best and score(best) >= NOTE_MATCH else None
    if hit:  # the earlier wording stays; edit the row in RULES.md to restate the rule
        hit.update(said=hit["said"] + 1, last=today)
    else:
        hit = {"id": f"N-{max([int(n['id'][2:]) for n in notes] + [0]) + 1:02d}", "text": text, "said": 1, "last": today}
        notes.append(hit)
    write_rules(fp, notes)
    if not quiet:
        nid, n = hit["id"], hit["said"]
        if n == 1:
            print(f"Noted as {nid} in {fp}. Apply it to every instance of the same kind.")
        else:
            print(f"Counted as a repeat of {nid}: \"{hit['text']}\". Wrong match? Edit {fp}, then run again with --same new.")
        if n == 2:
            print(f"Said twice: {nid} is now a rule in {fp}. Apply it in every later round. If it fixes a value or a pattern, "
                  f"also lock it: engine.py standard add --rule {shlex.quote(hit['text'])} --why \"said twice\" "
                  f"--source \"person, {today}\" ...")
        elif n > 2:
            print(f"Said {n} times: {nid}. Write a check that finds every case, and run it before every showing.")
        if n == 3:
            print("Ask once: \"Want me to draft a GitHub issue so OpenDesigner keeps notes like this?\" After a yes: "
                  "engine.py feedback \"<the rule, about OpenDesigner, nothing private>\" --kind gap")
    return hit


def cmd_feedback(d, text, kind="idea", quiet=False, area=None, question=None, same=None):
    """Record feedback locally and print a pre-filled issue link. Nothing is posted: the person decides. kind note is the
    owner's note on the work: counted in RULES.md (record_note), with no link."""
    from urllib.parse import quote
    if same and kind != "note":
        raise SystemExit("--same goes with --kind note.")
    if kind == "note":
        if not " ".join(str(text).split()):
            raise SystemExit("Add the note, in quotes: the rule in one line.")
        return record_note(d, " ".join(str(text).split()), same=same, quiet=quiet)
    if kind not in FEEDBACK_KINDS:
        raise SystemExit(f"--kind must be one of {', '.join(FEEDBACK_KINDS)}")
    text = " ".join(str(text).split())
    if not text:
        raise SystemExit("Add the feedback text, in quotes.")
    fp = os.path.join(d, "feedback.md")
    if not os.path.exists(fp):
        write_text(fp, "# Feedback\n\nGaps, bugs, confusing steps and ideas found while using OpenDesigner. Each entry has a ready-to-file "
                       "issue link. Nothing is posted unless you open the link and submit it yourself.\n")
    title = f"[{kind}]" + (f"[{area}]" if area else "") + f" {text[:70]}" + ("..." if len(text) > 70 else "")
    where = ", ".join(x for x in (f"area {area}" if area else "", f"question {question}" if question else "") if x)
    body = (f"**Kind:** {kind}\n\n" + (f"**Where:** {where}\n\n" if where else "") + f"**What happened or what is missing:**\n{text}\n\n"
            f"**OpenDesigner:** {OPENDESIGNER_VERSION} (engine {ENGINE_VERSION}, Python {sys.version_info.major}.{sys.version_info.minor})\n\n"
            "_Filed from `engine.py feedback`. Please remove anything private before submitting._")
    url = f"{ISSUES_URL}?title={quote(title)}&body={quote(body)}&labels={quote(FEEDBACK_KINDS[kind] + ',from-engine')}"
    with open(fp, encoding="utf-8") as f:
        n = sum(1 for line in f if line.startswith("## F-"))
    with open(fp, "a", encoding="utf-8", newline="\n") as f:
        f.write(f"\n## F-{n + 1:03d} · {_dt.date.today().isoformat()} · {kind}" + (f" · {where}" if where else "")
                + f"\n{text}\n\n[File this as an issue]({url})\n")
    track(d, "feedback_filed", kind=kind, step=question)
    if not quiet:
        print(f"Saved to {fp}.")
        print("To report it, open this link, check it, and submit it yourself (nothing was posted):")
        print(url)
    return url


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BrokenPipeError:  # output piped into head or less that closed early
        os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())
        sys.exit(1)
