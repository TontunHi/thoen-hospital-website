#!/usr/bin/env python3
"""Read design values from a repo's CSS and token files (or from read_page.js output) and fit them
to OpenDesigner's formulas run backwards (synthesis/LEVERS.md section E).

    python3 css_scan.py path/to/repo [more paths]      scan .css .scss .less .html .jsx .tsx .vue .svelte, tailwind config, *.tokens.json
    python3 css_scan.py --from-json page.json          analyse values captured in a browser by read_page.js
    add --json for machine output (default: a short readable report)

Every value is labelled with how it was obtained: "declared" (written in source files; not necessarily
rendered) or "computed" (read from a live page). Values are measured by role:
  body size       the most common size of running text by characters (not headings, nav, captions,
                  legal text, controls or code), and its ratio to the largest heading
  accent          chromatic colors on buttons, links, focus rings and selected states, ranked by
                  count x OKLCH chroma; grays, near-neutrals, black and white are skipped
  radius          control radius (buttons, inputs) and container radius (cards, dialogs, menus) apart;
                  inline links, badges, pills used as decoration and images are ignored
  depth           elevation shadows classified by blur and offset; hard shadows (no blur) apart; white or
                  transparent fades, glows, insets and text shadows are ignored; 1 px rings are counted
                  apart; from read_page.js also borders drawn by ::before/::after, offset slabs, frames
                  and windows drawn with stacked boxes
  motion          UI transitions (durations and easings, cubic-bezier(...) and linear(...) intact; moves
                  versus colour fades) apart from loops that always run and one-shot entrances
  surfaces        (read_page.js) the area share of every background colour, full-width sections in page
                  order (colour as a place), imagery, gradients and whitespace; text colour shares
  type roles      (read_page.js) family, weights, sizes, tracking and case per text role; loaded faces
Several captures of one site (different pages) merge: --from-json a.json --from-json b.json.
Each measurement carries a confidence (high, medium, low, none) and the element or rule count behind
it. The accent hex and typeface names are measurements of the reference's identity, never values to
adopt. Nothing here decides anything: the person accepts, adjusts or ignores each value.
Standard library only; no network.
"""
import argparse, json, math, re, sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
INTAKE = HERE.parent / "references" / "reference-intake.json"
EXT = {".css", ".scss", ".less", ".html", ".htm", ".jsx", ".tsx", ".js", ".ts", ".vue", ".svelte"}
RULE_EXT = {".css", ".scss", ".less", ".html", ".htm", ".vue", ".svelte"}
SKIP = {"node_modules", ".git", "dist", "build", ".next", "vendor", "coverage", "opendesigner"}
NUM = r"(-?\d*\.?\d+)(px|rem|em|ms|s)?"
NEUTRAL_MAX_C = 0.05   # OKLCH chroma under this is a gray or tinted neutral (slate reaches about 0.046)
ACCENT_WEIGHT = {"button": 3, "focus": 3, "selected": 2, "area": 1, "control": 2, "ring": 2, "emphasis": 2, "buttonBorder": 1,
                 "buttonText": 1, "link": 1, "hover": 1, "token": 1, "fieldBorder": 0.5}
UA_LINK = {"#0000ee", "#551a8b", "#ee0000"}  # the browser's own link colours: shown on wrapper links, never chosen
ERROR_STATE = re.compile(r"invalid|error|destructive|danger|warning|alert|success", re.I)
WEIGHT_WORDS = re.compile(r"\s+(thin|hairline|extra ?light|ultra ?light|light|book|regular|normal|roman|medium|semi ?bold|demi ?bold|"
                          r"bold|extra ?bold|ultra ?bold|heavy|black|italic|oblique|placeholder|fallback|variable|var)$", re.I)
SYSTEM_FACES = {"-apple-system", "blinkmacsystemfont", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace",
                "ui-rounded", "sans-serif", "serif", "monospace", "cursive", "fantasy", "segoe ui", "helvetica neue",
                "helvetica", "arial", "sf pro text", "sf pro display", "sf mono", "menlo", "monaco", "consolas",
                "courier new", "courier", "times", "times new roman", "georgia", "verdana", "tahoma",
                "apple color emoji", "segoe ui emoji", "noto color emoji", "inherit", "initial"}
EASING_RE = re.compile(r"cubic-bezier\([^()]*\)|linear\([^()]*\)|steps\([^()]*\)|ease-in-out|ease-in|ease-out|"
                       r"step-start|step-end|\bease\b|\blinear\b")


def px(v, unit):
    v = float(v)
    return v * 16 if unit in ("rem", "em") else v


def split_top(s, sep=","):
    """Split on sep outside parentheses, so cubic-bezier(0.25, 0.1, 0.25, 1) stays whole."""
    out, depth, cur = [], 0, ""
    for ch in s or "":
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch == sep and depth == 0:
            if cur.strip():
                out.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


# ---------- colour maths ----------
def hex_norm(h):
    h = h.lstrip("#").lower()
    if len(h) in (3, 4):
        h = "".join(c * 2 for c in h)
    return "#" + h[:6] if len(h) in (6, 8) else None


def oklch(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in (r, g, b)]
    l = 0.4122214708 * lin[0] + 0.5363325363 * lin[1] + 0.0514459929 * lin[2]
    m = 0.2119034982 * lin[0] + 0.6806995451 * lin[1] + 0.1073969566 * lin[2]
    s = 0.0883024619 * lin[0] + 0.2817188376 * lin[1] + 0.6299787005 * lin[2]
    l, m, s = (math.copysign(abs(x) ** (1 / 3), x) for x in (l, m, s))
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return round(L, 3), round(math.hypot(a, bb), 3), round(math.degrees(math.atan2(bb, a)) % 360)


def _to_hex(rgb):
    return "#" + "".join(f"{max(0, min(255, round(v * 255))):02x}" for v in rgb)


def _oklch_to_rgb(L, C, H):
    a, b = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
    l_, m_, s_ = L + 0.3963377774 * a + 0.2158037573 * b, L - 0.1055613458 * a - 0.0638541728 * b, L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    lin = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    return [12.92 * c if c <= 0.0031308 else 1.055 * max(c, 0) ** (1 / 2.4) - 0.055 for c in lin]


def _hsl_to_rgb(h, s, l):
    c = (1 - abs(2 * l - 1)) * s
    x, m = c * (1 - abs((h / 60) % 2 - 1)), l - c / 2
    r, g, b = [(c, x, 0), (x, c, 0), (0, c, x), (0, x, c), (x, 0, c), (c, 0, x)][int(h // 60) % 6]
    return [r + m, g + m, b + m]


COLOR_RE = re.compile(r"#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|oklch)\([^()]*\)|\b(?:white|black|transparent)\b", re.I)


def parse_color(tok):
    """'#abc', 'rgb(...)', 'hsl(...)', 'oklch(...)', 'white', 'black', 'transparent' -> (hex, alpha) or None."""
    t = tok.strip().lower()
    if t in ("white", "black", "transparent"):
        return {"white": ("#ffffff", 1.0), "black": ("#000000", 1.0), "transparent": ("#000000", 0.0)}[t]
    if t.startswith("#"):
        h = t[1:]
        if len(h) in (3, 4):
            h = "".join(c * 2 for c in h)
        if len(h) not in (6, 8) or not re.fullmatch(r"[0-9a-f]+", h):
            return None
        return "#" + h[:6], (int(h[6:8], 16) / 255 if len(h) == 8 else 1.0)
    m = re.match(r"(rgba?|hsla?|oklch)\(([^()]*)\)", t)
    if not m:
        return None
    fn, parts = m.group(1), [p for p in re.split(r"[\s,/]+", m.group(2).strip()) if p]
    if len(parts) < 3:
        return None
    try:
        a = (float(parts[3][:-1]) / 100 if parts[3].endswith("%") else float(parts[3])) if len(parts) > 3 else 1.0
        if fn.startswith("rgb"):
            rgb = [float(p[:-1]) / 100 if p.endswith("%") else float(p) / 255 for p in parts[:3]]
        elif fn.startswith("hsl"):
            rgb = _hsl_to_rgb(float(parts[0].replace("deg", "")) % 360, float(parts[1].rstrip("%")) / 100, float(parts[2].rstrip("%")) / 100)
        else:
            L = float(parts[0][:-1]) / 100 if parts[0].endswith("%") else float(parts[0])
            C = float(parts[1][:-1]) / 100 * 0.4 if parts[1].endswith("%") else float(parts[1])
            rgb = _oklch_to_rgb(L, C, 0.0 if parts[2] == "none" else float(parts[2].replace("deg", "")))
    except ValueError:
        return None
    return _to_hex(rgb), max(0.0, min(1.0, a))


def is_neutral(h):
    return oklch(h)[1] < NEUTRAL_MAX_C


# ---------- selectors and roles (declared files) ----------
def compounds(sel):
    """'.card > a.btn:hover' -> ['.card', 'a.btn:hover'] (split on combinators outside [] and ())."""
    sel = re.sub(r":not\([^()]*\)", "", sel)
    out, depth, cur = [], 0, ""
    for ch in sel.strip():
        depth += ch in "[(" and 1 or 0
        depth -= ch in "])" and 1 or 0
        if depth == 0 and (ch.isspace() or ch in ">+~"):
            if cur:
                out.append(cur)
            cur = ""
        else:
            cur += ch
    if cur:
        out.append(cur)
    return out or [sel]


def parse_compound(c):
    tag = (re.match(r"^[a-zA-Z][\w-]*|^:root", c) or [""])[0].lower()
    words = set()
    for name in re.findall(r"[.#]([\w-]+)", c):
        words |= {w.lower() for w in re.split(r"[-_]+|(?<=[a-z])(?=[A-Z])", name) if w}
    attrs = " ".join(re.findall(r"\[([^\]]*)\]", c)).lower()
    pseudos = {p.lower() for p in re.findall(r"::?([\w-]+)", c)}
    return tag, words, attrs, pseudos


def text_role(sel):
    comps = [parse_compound(c) for c in compounds(sel)]
    tag, words, attrs, _ = comps[-1]
    anc_tags = {t for t, *_ in comps[:-1]}
    anc_words = set().union(*[w for _, w, _, _ in comps[:-1]]) if len(comps) > 1 else set()
    if tag in ("pre", "code", "kbd", "samp") or words & {"code", "mono", "pre"}:
        return "code"
    if re.fullmatch(r"h[1-6]", tag) or words & {"heading", "headline", "title", "display", "h1", "h2", "h3"} or "role=heading" in attrs.replace('"', ""):
        return "heading"
    if tag in ("button", "input", "select", "textarea", "label") or words & {"btn", "button", "input", "field", "label", "tab", "cta"}:
        return "control"
    caption_words = {"caption", "legal", "footnote", "disclaimer", "copyright", "fineprint", "overline", "eyebrow", "hint", "helper", "footer"}
    if tag in ("small", "figcaption", "caption", "sup", "sub", "footer") or words & caption_words or anc_tags & {"footer", "small", "figcaption"} or anc_words & caption_words:
        return "caption"
    nav_words = {"nav", "navbar", "navigation", "menu", "breadcrumb", "breadcrumbs", "sidebar", "toolbar", "tabs"}
    if tag == "nav" or words & nav_words or "nav" in anc_tags or anc_words & nav_words:
        return "nav"
    if tag in ("html", "body", ":root", "p", "li", "dd", "td", "blockquote", "article", "main") or words & {"body", "prose", "content", "paragraph", "copy", "article", "description"}:
        return "body"
    return "other"


def radius_role(sel):
    tag, words, attrs, _ = parse_compound(compounds(sel)[-1])
    if tag in ("img", "video", "picture", "svg", "canvas", "iframe") or words & {"avatar", "image", "img", "thumb", "thumbnail", "media", "photo"}:
        return "media"
    if tag in ("button", "input", "select", "textarea") or "role=button" in attrs.replace('"', "") or \
            words & {"btn", "button", "input", "field", "select", "textarea", "textbox", "combobox", "control", "cta"}:
        return "control"
    if words & {"badge", "pill", "tag", "chip", "dot", "indicator", "status", "kbd", "label"}:
        return "decor"
    if tag == "dialog" or words & {"card", "modal", "dialog", "popover", "panel", "sheet", "tile", "dropdown", "menu",
                                   "toast", "tooltip", "popup", "drawer", "callout", "alert"}:
        return "container"
    if tag == "a" or "link" in words:
        return "link"
    return "other"


def accent_source(sel, prop, value):
    if ERROR_STATE.search(sel):
        return None  # error, warning and success states carry status colours, never the accent
    tag, words, attrs, pseudos = parse_compound(compounds(sel)[-1])
    if prop in ("outline", "outline-color") or (pseudos & {"focus", "focus-visible", "focus-within"} and prop in ("box-shadow", "border-color", "border")):
        return "focus"
    if prop == "accent-color":
        return "control"
    if re.search(r"aria-(selected|current|pressed|checked)|data-state", attrs) or "checked" in pseudos or words & {"active", "selected", "current", "checked"}:
        return "selected" if prop in ("background", "background-color", "color", "border-color", "border") else None
    role = radius_role(sel)
    is_button = tag == "button" or words & {"btn", "button", "cta"} or "role=button" in attrs.replace('"', "")
    is_link = tag == "a" or "link" in words
    if pseudos & {"hover", "active"} and (is_button or is_link) and prop in ("background", "background-color", "color", "border-color"):
        return "hover"
    if is_button:
        return {"background": "button", "background-color": "button", "border": "buttonBorder",
                "border-color": "buttonBorder", "color": "buttonText"}.get(prop)
    if role == "control" and prop in ("border", "border-color"):
        return "fieldBorder"
    if is_link and prop == "color":
        return "link"
    return None


def resolve_vars(value, props, depth=0):
    if "var(" not in value or depth > 6:
        return value

    def sub(m):
        name, fb = m.group(1), (m.group(2) or "").strip()
        return props.get(name, fb)
    return resolve_vars(re.sub(r"var\((--[\w-]+)\s*(?:,([^()]*))?\)", sub, value), props, depth + 1)


def iter_rules(text, suffix):
    """(selector, [(prop, value)]) from CSS text, <style> blocks and inline style attributes."""
    if suffix in (".html", ".htm", ".vue", ".svelte"):
        for tag, attrs in re.findall(r"<([a-zA-Z][\w-]*)\b([^>]*)>", text):
            st = re.search(r"\bstyle\s*=\s*\"([^\"]*)\"|\bstyle\s*=\s*'([^']*)'", attrs)
            if st:
                cls = re.search(r"\bclass\s*=\s*[\"']([^\"']*)[\"']", attrs)
                role = re.search(r"\brole\s*=\s*[\"']([^\"']*)[\"']", attrs)
                sel = tag.lower() + "".join("." + c for c in (cls.group(1).split() if cls else [])) + (f"[role={role.group(1)}]" if role else "")
                yield sel, decls(st.group(1) or st.group(2) or "")
        text = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", text, re.S | re.I))
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", text):
        sel = sel.split(";")[-1].strip()
        if not sel or sel.startswith("@") or re.fullmatch(r"[\s,]*((from|to|\d+(\.\d+)?%)[\s,]*)+", sel):
            continue
        yield sel, decls(body)


def decls(body):
    out = []
    for d in split_top(body, ";"):
        if ":" in d:
            k, v = d.split(":", 1)
            out.append((k.strip().lower(), re.sub(r"!important", "", v).strip()))
    return out


# ---------- capture from files ----------
def scan_files(paths):
    V = {k: Counter() for k in ("colors", "fontFamilies", "fontSizes", "lineHeights", "fontWeights",
                                "spacing", "radii", "shadows", "durations", "easings")}
    loops = {"durations": Counter(), "easings": Counter(), "count": 0}
    R = {k: {} for k in ("textSizes", "textElements", "radiiByRole", "accentSources")}
    props, files, rules, raw_families = {}, 0, [], Counter()

    def add(group, role, key, n=1):
        R[group].setdefault(role, Counter())[key] += n

    for root in paths:
        root = Path(root)
        items = [root] if root.is_file() else [p for p in root.rglob("*") if p.is_file()
                                               and not (set(p.parts) & SKIP)]
        for f in items:
            name = f.name.lower()
            if f.suffix.lower() not in EXT and not name.startswith("tailwind.config") and not name.endswith(".tokens.json"):
                continue
            try:
                t = f.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            if len(t) > 2_000_000:
                continue
            files += 1
            for k, v in re.findall(r"(--[\w-]+)\s*:\s*([^;}\n]+)", t):
                props.setdefault(k, v.strip())
            for tok in re.findall(r"#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|oklch)\([^()]*\)", t):
                c = parse_color(tok)
                if c and c[1] > 0:
                    V["colors"][c[0]] += 1
            for m in re.findall(r"(?<![\w-])font-family\s*:\s*([^;}\n]+)", t):
                raw_families[m.strip()] += 1
            for v, u in re.findall(r"font-size\s*:\s*" + NUM, t):
                if u in ("px", "rem", "em"):
                    V["fontSizes"][round(px(v, u))] += 1
            for v in re.findall(r"font-weight\s*:\s*(\d{3})", t):
                V["fontWeights"][int(v)] += 1
            for v, u in re.findall(r"line-height\s*:\s*" + NUM, t):
                V["lineHeights"][f"{v}{u or ''}"] += 1
            for prop, rest in re.findall(r"\b(padding|margin|gap|row-gap|column-gap)[\w-]*\s*:\s*([^;}\n]+)", t):
                for v, u in re.findall(NUM, rest):
                    if u in ("px", "rem") and 0 < px(v, u) <= 160:
                        V["spacing"][round(px(v, u))] += 1
            for rest in re.findall(r"border-radius\s*:\s*([^;}\n]+)", t):
                for v, u in re.findall(NUM, rest)[:1]:
                    if u in ("px", "rem"):
                        V["radii"][round(px(v, u))] += 1
                    elif "%" in rest or "9999" in rest:
                        V["radii"]["full"] += 1
            for m in re.findall(r"(?<![\w-])box-shadow\s*:\s*([^;}\n]+)", t):
                V["shadows"][m.strip()] += 1
            for prop, rest in re.findall(r"\b(transition|animation)(?:-duration|-timing-function)?\s*:\s*([^;}\n]+)", t):
                for layer in split_top(rest):
                    times = re.findall(r"(-?\d*\.?\d+)(ms|s)\b", layer)
                    ease = EASING_RE.search(layer)
                    if prop == "animation" and re.search(r"\binfinite\b", layer) and times and float(times[0][0]) > 0:
                        loops["count"] += 1  # an animation that never stops is ambient motion, not UI timing
                        loops["durations"][round(float(times[0][0]) * (1000 if times[0][1] == "s" else 1))] += 1
                        loops["easings"][ease.group(0) if ease else "ease"] += 1
                    elif times and float(times[0][0]) > 0:
                        V["durations"][round(float(times[0][0]) * (1000 if times[0][1] == "s" else 1))] += 1
                        if ease:
                            V["easings"][ease.group(0)] += 1
                    elif ease and not times:
                        V["easings"][ease.group(0)] += 1
            if f.suffix.lower() in RULE_EXT:
                rules += list(iter_rules(t, f.suffix.lower()))
    # role-aware pass (after all custom properties are known, so var() resolves)
    for v, n in raw_families.items():
        first = split_top(resolve_vars(v, props))[:1]
        if first and "var(" not in first[0]:
            V["fontFamilies"][first[0].strip(" '\"")] += n
    raw_shadows, V["shadows"] = V["shadows"], Counter()
    for k, v in props.items():
        if re.search(r"shadow|elevation", k):
            raw_shadows[v] += 1
    for v, n in raw_shadows.items():
        v = resolve_vars(v, props)
        if v and v != "none" and "var(" not in v:
            V["shadows"][v] += n
    for k, v in props.items():
        if re.search(r"primary|accent|brand|link|focus|ring|interactive|action|cta|highlight", k) and not re.search(r"foreground|-fg|on-|contrast|text|muted", k) \
                and not ERROR_STATE.search(k):
            c = parse_color(resolve_vars(v, props))
            if c and c[1] >= 0.5:
                add("accentSources", "token", c[0])
    for sel_group, ds in rules:
        for sel in split_top(sel_group):
            for prop, raw in ds:
                val = resolve_vars(raw, props)
                if prop in ("font-size", "font"):
                    m = re.search(NUM, val) if prop == "font-size" else re.search(r"(\d*\.?\d+)(px|rem|em)\b", val)
                    if m and m.group(2) in ("px", "rem", "em"):
                        role = text_role(sel)
                        w = 3 if parse_compound(compounds(sel)[-1])[0] in ("html", "body", ":root") else (
                            2 if parse_compound(compounds(sel)[-1])[0] in ("p", "li", "dd", "td", "blockquote", "article", "main") else 1)
                        add("textSizes", role, round(px(m.group(1), m.group(2))), w)
                        add("textElements", role, round(px(m.group(1), m.group(2))))
                elif prop == "border-radius":
                    m = re.search(r"(-?\d*\.?\d+)(px|rem|em|%)?", val)
                    if m:
                        n = float(m.group(1))
                        r = "full" if (m.group(2) == "%" and n >= 50) or n >= 999 else round(px(n, m.group(2)))
                        if r == 0 and "." not in compounds(sel)[-1]:
                            continue  # reset such as Tailwind preflight's `button, input { border-radius: 0 }`
                        add("radiiByRole", radius_role(sel), r)
                elif prop in ("background", "background-color", "color", "border", "border-color", "outline", "outline-color",
                              "box-shadow", "accent-color"):
                    src = accent_source(sel, prop, val)
                    if src:
                        for tok in COLOR_RE.findall(val):
                            c = parse_color(tok)
                            if c and c[1] >= 0.5:
                                add("accentSources", src, c[0])
    vals = {k: dict(v.most_common(40)) for k, v in V.items()}
    vals["loops"] = {"durations": dict(loops["durations"]), "easings": dict(loops["easings"]), "count": loops["count"]}
    for k, groups in R.items():
        vals[k] = {role: dict(c.most_common(40)) for role, c in groups.items()}
    return {"method": "declared", "files": files, "customProperties": props, "values": vals}


# ---------- analysis ----------
def level(count, share, high, medium):
    """Confidence from how many elements/rules back a value and how dominant it is."""
    if count >= high[0] and share >= high[1]:
        return "high"
    if count >= medium[0] and share >= medium[1]:
        return "medium"
    return "low" if count else "none"


def _num(k):
    try:
        return float(k)
    except (TypeError, ValueError):
        return None


RATIOS = (1.618, 1.5, 1.414, 1.333, 1.25, 1.2, 1.125, 1.067)


def fit_type(sizes, base=None):
    """Fit sizes to base x ratio^n. The base is the measured body size; only the ratio is fitted.
    Larger ratios are preferred unless a smaller one fits clearly better (a dense grid fits anything)."""
    s = sorted({float(x) for x in sizes if _num(x) is not None and 9 <= float(x) <= 120})
    if len(s) < 3:
        return None
    if base is None:
        base = min((x for x in s if 12 <= x <= 20), key=lambda x: abs(x - 16), default=s[0])
    best = None
    for r in RATIOS:
        lr = math.log(r)
        err = sum(min(abs(math.log(x / base) - n * lr) for n in range(-4, 17)) for x in s) / len(s)
        if best is None or err / lr < best[2] - 0.02:
            best = (r, err, err / lr)
    r, err, rel = best
    return {"base": base, "ratio": r, "meanLogResidual": round(err, 4), "relativeResidual": round(rel, 3),
            "reading": "modular scale" if err < 0.03 and rel < 0.15 else "loose fit: keep measured sizes as overrides",
            "sizes": s}


def fit_space(vals):
    v = [float(x) for x in vals for _ in range(int(vals[x]))]
    if not v:
        return None
    share = {u: round(sum(1 for x in v if x % u == 0) / len(v), 2) for u in (8, 5, 4)}
    unit = next((u for u in (8, 5, 4) if share[u] >= 0.7), 4)
    return {"unit": unit, "shareDivisible": share, "steps": sorted({int(float(x)) for x in vals})[:16],
            "count": len(v), "confidence": level(len(v), share[unit], (40, 0.8), (10, 0.7))}


def dial_from_band(drives, param, value):
    for d in drives:
        if d["param"] == param and d["map"]["kind"] == "bands":
            for lo, hi, out in d["map"]["bands"]:
                if out == value:
                    return (lo + hi) // 2
            nums = [(abs(out - value), (lo + hi) // 2) for lo, hi, out in d["map"]["bands"]
                    if isinstance(out, (int, float)) and isinstance(value, (int, float))]
            if nums:
                return min(nums)[1]
    return None


def measure_type(vals, computed):
    ts, te = vals.get("textSizes") or {}, vals.get("textElements") or {}
    out = {}
    if ts.get("body") or ts.get("label"):
        # running text counts in full; short UI text and link lists count at half weight, so a page made
        # of cards still gives a reading, but prose wins wherever there is some
        prose = {float(k): n for k, n in (ts.get("body") or {}).items()}
        labels = {float(k): n * 0.5 for k, n in (ts.get("label") or {}).items()}
        sizes = {k: prose.get(k, 0) + labels.get(k, 0) for k in set(prose) | set(labels)}
        body = max(sizes, key=lambda k: (sizes[k], -abs(k - 16)))
        share = sizes[body] / sum(sizes.values())
        els = sum(n for r in ("body", "label") for k, n in (te.get(r) or {}).items() if float(k) == body) or int(sizes[body])
        conf = level(els, share, (10, 0.5), (3, 0.3)) if computed else level(els, share, (2, 0.5), (1, 0.3))
        mostly_labels = labels.get(body, 0) > prose.get(body, 0)
        if mostly_labels and conf == "high":
            conf = "medium"
        out["body"] = {"px": body, "share": round(share, 2), "count": els, "confidence": conf,
                       "basis": (f"{round(share * 100)}% of the running text by characters" if computed else
                                 f"{round(share * 100)}% of the weighted font-size declarations on body, p and prose selectors")
                       + (" (mostly short text such as card copy and link lists: an article page reads better)" if mostly_labels else "")}
    else:
        fs = {float(k): n for k, n in (vals.get("fontSizes") or {}).items() if _num(k) is not None and 12 <= float(k) <= 20}
        if fs:
            body = max(fs, key=lambda k: (fs[k], -abs(k - 16)))
            out["body"] = {"px": body, "share": round(fs[body] / sum(fs.values()), 2), "count": int(fs[body]), "confidence": "low",
                           "basis": "most common size between 12 and 20 px by element count; this capture has no text roles "
                                    "(headings, nav and captions are mixed in): re-run read_page.js for a better reading"}
    heads = {float(k): n for k, n in (ts.get("heading") or {}).items()}
    if heads:
        top = max(heads)
        out["largestHeading"] = {"px": top, "count": sum(n for k, n in (te.get("heading") or {}).items() if float(k) == top) or 1}
    elif out.get("body"):
        allsz = [float(k) for k in (vals.get("fontSizes") or {}) if _num(k) is not None]
        if allsz and max(allsz) > out["body"]["px"]:
            out["largestHeading"] = {"px": max(allsz), "count": 1, "note": "no heading elements found; largest text on the page"}
    if out.get("body") and out.get("largestHeading"):
        conf = "medium" if out["body"]["confidence"] in ("high", "medium") and "note" not in out["largestHeading"] else "low"
        out["headingRatio"] = {"value": round(out["largestHeading"]["px"] / out["body"]["px"], 2), "confidence": conf,
                               "basis": "largest heading / body size; one page can mislead"}
    pool = set()
    for role, sz in ts.items():
        if role != "code":
            pool |= {k for k in sz}
    out["scale"] = fit_type(pool or vals.get("fontSizes", {}), out["body"]["px"] if out.get("body") else None)
    fams = Counter()
    for k, n in (vals.get("fontFamilies") or {}).items():
        fams[face_name(k)] += n
    total = sum(fams.values()) or 1
    faces = [f for f, n in fams.most_common() if f and f.lower() not in SYSTEM_FACES and n / total >= 0.05]
    out["families"] = faces[:5]  # the reference's own typefaces (identity): named, never recommended
    out["minorFaces"] = [f for f, n in fams.most_common() if f and f.lower() not in SYSTEM_FACES and n / total < 0.05][:5]
    out["systemFaces"] = [f for f, _ in fams.most_common() if f.lower() in SYSTEM_FACES][:5]
    if fams:
        out["primaryIsSystem"] = fams.most_common(1)[0][0].lower() in SYSTEM_FACES
    out["weights"] = sorted({int(w) for w in vals.get("fontWeights", {}) if str(w).isdigit()})
    return out


def measure_accent(vals, computed, rings, areas=None):
    src = {k: dict(v) for k, v in (vals.get("accentSources") or {}).items()}
    if rings:
        src["ring"] = rings
    if areas:  # a chromatic colour that paints much of the page is evidence too, capped so it never outvotes real buttons
        big = {hex_norm(h): min(10, round(v * 100)) for h, v in areas.items() if hex_norm(h) and not is_neutral(hex_norm(h)) and v >= 0.02}
        chromatic = any(hex_norm(h) and not is_neutral(hex_norm(h)) and 0.1 <= oklch(hex_norm(h))[0] <= 0.97
                        for s_, colors in src.items() if s_ != "link" for h in colors)
        if big and chromatic:  # only when a button, link, focus ring or token already has a colour of its own
            src["area"] = big
    cand = {}
    for source, colors in src.items():
        for h, n in colors.items():
            h = hex_norm(h)
            if not h or (source == "link" and h in UA_LINK):
                continue
            L, C, H = oklch(h)
            if C < NEUTRAL_MAX_C or L > 0.97 or L < 0.1:
                continue  # grays, tinted neutrals, black, white
            c = cand.setdefault(h, {"hex": h, "count": 0, "oklch": [L, C, H], "sources": {}, "_w": 0})
            c["count"] += n
            c["sources"][source] = c["sources"].get(source, 0) + n
            c["_w"] += n * ACCENT_WEIGHT.get(source, 1)
    interactive = bool(cand)
    if not cand:  # no interactive evidence: rank every chromatic color, low confidence
        for h, n in (vals.get("colors") or {}).items():
            h = hex_norm(h)
            if h:
                L, C, H = oklch(h)
                if C >= NEUTRAL_MAX_C and 0.1 <= L <= 0.97:
                    cand[h] = {"hex": h, "count": n, "oklch": [L, C, H], "sources": {"anywhere": n}, "_w": n}
    ranked = sorted(cand.values(), key=lambda c: -c["_w"] * c["oklch"][1])
    for c in ranked:
        c["score"] = round(c.pop("_w") * c["oklch"][1], 2)
    if not ranked:
        return [], {"confidence": "none", "count": 0, "basis": "no chromatic color on buttons, links, focus rings or selected states"}
    top = ranked[0]
    rival = next((c for c in ranked[1:] if min(abs(c["oklch"][2] - top["oklch"][2]), 360 - abs(c["oklch"][2] - top["oklch"][2])) > 25), None)
    margin = top["score"] / rival["score"] if rival and rival["score"] else 9
    if not interactive:
        conf = "low"
    elif computed:
        conf = "high" if top["count"] >= 5 and (len(top["sources"]) >= 2 or top["sources"].get("button", 0) >= 5) and margin >= 1.5 else (
            "medium" if top["count"] >= 2 else "low")
    else:
        conf = "high" if top["count"] >= 2 and len(top["sources"]) >= 2 and margin >= 1.5 else ("medium" if top["count"] >= 1 else "low")
    basis = (f"on {', '.join(sorted(top['sources']))}; ranked by count x chroma" if interactive else
             "no interactive elements with a chromatic color; ranked every color by count x chroma")
    return ranked, {"confidence": conf, "count": top["count"], "basis": basis}


def parse_shadow_layer(layer):
    layer = layer.strip()
    inset = bool(re.search(r"\binset\b", layer))
    ctok = COLOR_RE.search(layer)
    col = parse_color(ctok.group(0)) if ctok else None
    rest = COLOR_RE.sub(" ", layer).replace("inset", " ")
    nums = [px(v, u or "px") for v, u in re.findall(r"(-?\d*\.?\d+)(px|rem|em)?\b", rest)]
    if len(nums) < 2:
        return None
    x, y, blur, spread = (nums + [0, 0])[:4]
    return {"x": x, "y": y, "blur": blur, "spread": spread, "inset": inset,
            "hex": col[0] if col else None, "alpha": round(col[1], 3) if col else None}


def classify_layer(s):
    if s["alpha"] == 0:
        return "transparent"
    if s["inset"]:
        return "inset"
    if s["x"] == 0 and s["y"] == 0 and s["blur"] == 0:
        return "ring" if s["spread"] > 0 else "transparent"
    if s["hex"] and oklch(s["hex"])[0] >= 0.9 and oklch(s["hex"])[1] < NEUTRAL_MAX_C:
        return "fade"
    if s["x"] == 0 and s["y"] == 0 and s["spread"] >= s["blur"]:
        return "glow"
    if s["blur"] == 0:  # a solid offset copy with no blur is drawn depth (retro, neo-brutalist), not elevation;
        # a faint 1 px offset is a hairline under a button, not a shadow style
        strong = (s["alpha"] if s["alpha"] is not None else 1) >= 0.3 and max(abs(s["x"]), abs(s["y"])) >= 2
        return "hard" if strong else "line"
    b = max(s["blur"], abs(s["y"]) * 2)
    return "low" if b <= 4 else "medium" if b <= 16 else "high" if b <= 32 else "overlay"


def fmt_layer(s):
    col = f"rgba({int(s['hex'][1:3], 16)}, {int(s['hex'][3:5], 16)}, {int(s['hex'][5:7], 16)}, {s['alpha']})" if s["hex"] else "currentColor"
    return f"{s['x']:g}px {s['y']:g}px {s['blur']:g}px {s['spread']:g}px {col}"


def _parse_windows(raw):
    out = []
    for k, n in (raw or {}).items():
        try:
            w = json.loads(k) if isinstance(k, str) else dict(k)
        except ValueError:
            continue
        out.append({**w, "count": n})
    return sorted(out, key=lambda w: -w["count"])


def measure_depth(vals, computed, elements, patterns=None):
    """Elevation shadows by level, hard (no-blur) shadows apart, and from read_page.js the depth drawn with elements:
    borders drawn by ::before/::after, offset slabs and twins (hard shadows built from boxes), frames and windows."""
    ignored, levels, elev, rings, hard = Counter(), {}, Counter(), Counter(), Counter()
    with_ring = only_ring = 0
    for value, n in (vals.get("shadows") or {}).items():
        layers = [s for s in (parse_shadow_layer(l) for l in split_top(value)) if s]
        kinds = [classify_layer(s) for s in layers]
        keep = [s for s, k in zip(layers, kinds) if k in ("low", "medium", "high", "overlay")]
        for s, k in zip(layers, kinds):
            if k == "ring" and s["hex"]:
                rings[s["hex"]] += n
            if k == "hard":
                hard[fmt_layer(s)] += n
            if k not in ("low", "medium", "high", "overlay", "ring", "hard"):
                ignored[k] += n
        if keep:
            elev[", ".join(fmt_layer(s) for s in keep)] += n
            for s, k in zip(layers, kinds):
                if k in ("low", "medium", "high", "overlay"):
                    lv = levels.setdefault(k, {"level": k, "blur": s["blur"], "y": s["y"], "alpha": s["alpha"], "count": 0})
                    lv["count"] += n
            with_ring += n if "ring" in kinds else 0
        elif "ring" in kinds:
            only_ring += n
    pat = patterns or {}
    drawn = Counter(pat.get("drawnOffsets") or {})
    frames = Counter(pat.get("frames") or {})
    windows = _parse_windows(pat.get("windows"))
    borders = vals.get("borders")
    B = sum(borders.values()) if isinstance(borders, dict) else None
    E, H = sum(elev.values()), sum(hard.values()) + sum(drawn.values())
    minor = 0
    if H >= 2 and H >= E:
        hint = "hard-offset"
        conf = level(H, 1, (5, 0), (2, 0))
    elif E and not (B is not None and E < 3 and E * 4 < B):
        hint = "ring+faint-shadow" if with_ring * 2 >= E else "shadow-ladder"
        conf = level(E, 1, (5, 0), (2, 0)) if computed else level(E, 1, (3, 0), (1, 0))
    else:
        hint, minor = "borders", E
        conf = ("high" if (B or 0) >= 10 else "medium" if (elements or 0) >= 100 or B else "low") if computed else "low"
    order = ["low", "medium", "high", "overlay"]
    basis = {"hard-offset": f"{H} hard shadow(s) with no blur" + (f", {sum(drawn.values())} drawn with stacked boxes" if drawn else ""),
             "borders": (f"{B} bordered box(es)" if B else "no elevation shadows")
             + (f", {minor} minor soft shadow(s) on {minor} element(s) only" if minor else "")}.get(hint,
            f"{E} element(s) with elevation shadows, levels by blur and offset")
    if ignored or not E:
        basis += "; white or transparent fades, glows, insets and text shadows ignored"
    out = {"shadows": [s for s, _ in elev.most_common(5)], "hint": hint,
           "levels": sorted(levels.values(), key=lambda l: order.index(l["level"])),
           "rings": only_ring + with_ring, "ignored": dict(ignored), "count": H if hint == "hard-offset" else E if hint != "borders" else (B or 0),
           "confidence": conf, "basis": basis}
    if hard or drawn:
        out["hard"] = [k for k, _ in (hard + Counter({f"{k} (drawn with boxes)": n for k, n in drawn.items()})).most_common(4)]
    if B is not None:
        out["borders"] = dict(sorted(borders.items(), key=lambda kv: -kv[1])[:4])
    if frames:
        out["frames"] = [{"band": k.split()[0], "color": k.split()[1], "count": n} for k, n in frames.most_common(3)]
    if windows:
        out["windows"] = windows[:4]
        out["windowCount"] = sum(w["count"] for w in windows)
    if minor:
        out["minorShadows"] = minor
    chroma_rings = {h: n for h, n in rings.items() if not is_neutral(h)}
    return out, chroma_rings


def mode(counter):
    items = [(k, n) for k, n in counter.items()]
    if not items:
        return None, 0, 0
    k, n = max(items, key=lambda kv: (kv[1], -(_num(kv[0]) if _num(kv[0]) is not None else 999)))
    k = "full" if k == "full" else int(float(k))
    return k, n, n / sum(n for _, n in items)


def measure_radius(vals, computed, dials):
    rr = vals.get("radiiByRole") or {}
    out = {}
    th = ((5, 0.6), (2, 0.4)) if computed else ((3, 0.6), (1, 0.4))
    if rr:
        for role in ("control", "container"):
            v, n, share = mode(rr.get(role) or {})
            if v is not None:
                out[role] = {"px": v, "count": n, "share": round(share, 2), "confidence": level(n, share, *th),
                             "values": {str(k): c for k, c in sorted((rr.get(role) or {}).items(), key=lambda kv: -kv[1])[:6]}}
        out["ignored"] = {r: sum(c.values()) for r, c in rr.items() if r not in ("control", "container") and c}
        out["basis"] = "controls (buttons, inputs) and containers (cards, dialogs, menus) apart; inline links, badges, decorative pills and images ignored"
        if "control" not in out and not computed and rr.get("other"):
            v, n, share = mode(rr["other"])
            out["control"] = {"px": v, "count": n, "share": round(share, 2), "confidence": "low",
                              "values": {str(k): c for k, c in sorted(rr["other"].items(), key=lambda kv: -kv[1])[:6]},
                              "note": "no button or input selectors recognised: most common radius on other selectors"}
    else:
        flat = Counter({k: n for k, n in (vals.get("radii") or {}).items() if k == "full" or (_num(k) or 0) >= 2})
        v, n, share = mode(flat)
        if v is not None:
            out["control"] = {"px": v, "count": n, "share": round(share, 2), "confidence": "low"}
        out["basis"] = "no roles in this capture (all elements mixed; 1 px corners dropped): re-run read_page.js for control and container radii"
    if "control" in out:
        out["mostCommon"] = out["control"]["px"]  # engine.py intake reads this as the control radius
        out["roundnessDial"] = dial_from_band(dials.get("roundness", {}).get("drives", []), "radius.control", out["control"]["px"])
    return out


def ease_kind(e):
    """linear, stepped, springy (overshoots) or eased."""
    e = str(e).strip()
    if e.startswith("steps(") or e in ("step-start", "step-end"):
        return "stepped"
    if e == "linear":
        return "linear"
    if e.startswith("linear("):
        nums = [float(x) for x in re.findall(r"-?\d*\.?\d+", re.sub(r"-?\d*\.?\d+%", "", e[7:-1]))]
        return "springy" if any(v > 1.0001 or v < -0.0001 for v in nums) else "eased"
    if e.startswith("cubic-bezier("):
        n = [float(x) for x in re.findall(r"-?\d*\.?\d+", e)]
        return "springy" if len(n) == 4 and not (0 <= n[1] <= 1 and 0 <= n[3] <= 1) else "eased"
    return "eased"


def _median(pairs):
    pairs = sorted(pairs)
    total, acc = sum(n for _, n in pairs), 0
    for d, n in pairs:
        acc += n
        if acc * 2 >= total:
            return d
    return pairs[-1][0] if pairs else None


def measure_motion(vals, computed):
    """UI transitions (the Energy dial reads these) apart from loops that always run and one-shot entrances. Easing is kept
    as a trait (linear, stepped, eased, springy), and transitions are split into moves and colour or opacity fades."""
    lp = vals.get("loops") or {}
    loops = None
    if lp.get("count"):
        le = Counter(lp.get("easings") or {})
        kinds = Counter()
        for e, n in le.items():
            kinds[ease_kind(e)] += n
        loops = {"count": lp["count"], "durations": sorted({float(k) for k in lp.get("durations") or {}})[:8],
                 "easings": [e for e, _ in le.most_common(4)], "character": kinds.most_common(1)[0][0] if kinds else "eased",
                 "basis": "animations that repeat forever (or run 2 s or longer, more than once): ambient motion, not UI timing"}
    ent = vals.get("entrances") or {}
    entrances = {"count": sum(ent.values()), "median": _median([(float(k), n) for k, n in ent.items()])} if ent else None
    du = [(float(k), n) for k, n in (vals.get("durations") or {}).items() if _num(k) and float(k) > 0]
    if not du:
        out = {"note": "no UI transitions found" + ("; loops are listed apart" if loops else "; do not infer Energy from this source"),
               "count": 0, "confidence": "low" if loops else "none"}
    else:
        total = sum(n for _, n in du)
        med = _median(du)
        eas = Counter({k: n for k, n in (vals.get("easings") or {}).items()})
        overshoot = any(ease_kind(e) == "springy" for e in eas)
        ekinds = Counter()
        for e, n in eas.items():
            ekinds[ease_kind(e)] += n
        out = {"durations": sorted(d for d, _ in du)[:10], "median": med, "durationMultiplier": round(med / 275, 2),
               "easings": [e for e, _ in eas.most_common(5)], "overshoot": overshoot, "count": total,
               "character": ekinds.most_common(1)[0][0] if ekinds else "eased",
               "confidence": "medium" if total >= (10 if computed else 5) else "low",
               "note": "CSS transitions and Web Animations only; canvas drawing and states that need interaction are not visible" + (
                   "; declared, not necessarily rendered" if not computed else "")}
        tk = vals.get("transitionKinds") or {}
        if tk:
            out["moves"] = tk.get("spatial", 0)
            out["fades"] = tk.get("color", 0) + tk.get("opacity", 0)
            out["fadesOnly"] = out["moves"] == 0
    if loops:
        out["loops"] = loops
    if entrances:
        out["entrances"] = entrances
    return out


def face_name(f):
    """'Die Grotesk C Medium' -> 'Die Grotesk C' (the family, without a weight or style word a builder put in the name)."""
    f = str(f or "").strip(" '\"")
    prev = None
    while prev != f:
        prev, f = f, WEIGHT_WORDS.sub("", f).strip()
    return f or prev


def measure_roles(vals, loaded=None):
    """Per text role: the family (exact name), its share of the characters, weights, sizes, tracking, case and line height;
    then the voices: the families that carry at least 5% of the text, with the roles each speaks in."""
    roles, total = {}, sum((r.get("chars") or 0) for r in (vals.get("typeRoles") or {}).values()) or 1
    voices = Counter()
    where = {}
    for role, R in (vals.get("typeRoles") or {}).items():
        fams = Counter()
        for f, n in (R.get("families") or {}).items():
            fams[face_name(f)] += n
        if not fams:
            continue
        top = lambda c, k=3: [x for x, _ in Counter(c).most_common(k)]
        tr = Counter(R.get("transform") or {})
        faces = {}
        for f, fc in (R.get("faces") or {}).items():  # sizes and weights of each face within the role
            g = faces.setdefault(face_name(f), {"sizes": Counter(), "weights": Counter()})
            g["sizes"].update(fc.get("sizes") or {})
            g["weights"].update(fc.get("weights") or {})
        roles[role] = {"family": fams.most_common(1)[0][0], "families": dict(fams.most_common(3)),
                       "faces": {f: {"sizes": [float(x) for x, _ in g["sizes"].most_common(4)], "weights": [x for x, _ in g["weights"].most_common(3)]}
                                 for f, g in faces.items()},
                       "share": round((R.get("chars") or 0) / total, 3),
                       "weights": top(R.get("weights") or {}), "sizes": [float(x) for x in top(R.get("sizes") or {}, 6)],
                       "tracking": float(top(R.get("tracking") or {0: 1}, 1)[0]),
                       "case": tr.most_common(1)[0][0] if tr and tr.most_common(1)[0][1] * 2 >= (R.get("chars") or 1) else None,
                       "lineHeight": float(top(R.get("lineHeight") or {}, 1)[0]) if R.get("lineHeight") else None}
        for f, n in fams.items():
            voices[f] += n
            where.setdefault(f, set()).add(role)
    vt = sum(voices.values()) or 1
    out = {"roles": roles,
           "voices": [{"family": f, "share": round(n / vt, 3), "roles": sorted(where[f]), "system": f.lower() in SYSTEM_FACES}
                      for f, n in voices.most_common() if n / vt >= 0.05]}
    if loaded:
        fl = {}
        for k in loaded:
            fam, _, rest = str(k).partition("|")
            fl.setdefault(face_name(fam), set()).add(rest.split("|")[0])
        out["loaded"] = {f: sorted(w) for f, w in fl.items()}
    return out


def measure_surfaces(cap):
    """The page as painted: the area share of each background colour, text colour shares, full-width sections in page order
    (colour as a place), imagery, gradients and whitespace. None for captures without read_page.js surfaces."""
    s = cap.get("surfaces")
    if not s:
        return None
    areas, text = Counter(), Counter()
    for h, v in (s.get("areas") or {}).items():
        if hex_norm(h):
            areas[hex_norm(h)] += v
    for h, v in (s.get("text") or {}).items():
        if hex_norm(h):
            text[hex_norm(h)] += v
    ts = float(s.get("textShare") or 0)
    doc_h = (cap.get("layout") or {}).get("docHeight") or 0
    ground = hex_norm(s.get("pageBg") or "#ffffff")  # a band in the page's own colour is ground, not another place
    secs = [x for x in s.get("sections") or [] if (not doc_h or x["h"] < 0.9 * doc_h) and hex_norm(x["hex"]) != ground]
    worlds = Counter()
    for x in secs:
        worlds[hex_norm(x["hex"])] += x["h"]
    covered = sum(worlds.values())
    chroma_bg = sum(v for h, v in areas.items() if not is_neutral(h))
    chroma_text = sum(v for h, v in text.items() if not is_neutral(h)) * ts
    row = lambda h, v: {"hex": h, "share": round(v, 3), "oklch": list(oklch(h)), "chromatic": not is_neutral(h)}
    out = {"pageBg": ground,
           "areas": [row(h, v) for h, v in areas.most_common(12) if v >= 0.001],
           "text": [row(h, v) for h, v in text.most_common(8) if v >= 0.005], "textShare": ts,
           "chromaticShare": round(chroma_bg + chroma_text, 3), "chromaticBackground": round(chroma_bg, 3), "chromaticText": round(chroma_text, 3),
           "worlds": [{**row(h, n / doc_h if doc_h else 0), "sections": sum(1 for x in secs if hex_norm(x["hex"]) == h)} for h, n in worlds.most_common(8)],
           "order": [hex_norm(x["hex"]) for x in secs],
           "colourIsPlace": len(worlds) >= 2 and doc_h > 0 and covered / doc_h >= 0.4,
           "gradients": int(s.get("gradients") or 0), "imagery": s.get("imagery"), "whitespace": s.get("whitespace"),
           "blankRows": s.get("blankRows"), "air": s.get("air"),
           "confidence": "medium" if cap.get("pages", 1) == 1 else "high",
           "basis": "area of each background colour on a 16 px grid over the whole page (document order approximates paint order)"}
    return out


def _parse_sigs(raw):
    out = {}
    for group, sigs in (raw or {}).items():
        rows = []
        for k, n in sigs.items():
            try:
                rows.append({**json.loads(k), "count": n})
            except ValueError:
                continue
        out[group] = sorted(rows, key=lambda r: -r["count"])
    return out


def _add(into, other):
    """Add nested counters (dicts of numbers) from other into into."""
    for k, v in (other or {}).items():
        if isinstance(v, dict):
            _add(into.setdefault(k, {}), v)
        elif isinstance(v, (int, float)) and not isinstance(v, bool):
            into[k] = (into.get(k) or 0) + v
        else:
            into.setdefault(k, v)
    return into


def merge_captures(caps):
    """Several read_page.js captures of one site (different pages) as one: counters add, areas and whitespace are weighted by
    page area, sections keep page order."""
    if len(caps) == 1:
        return caps[0]
    out = {"method": "computed", "source": ", ".join(str(c.get("source")) for c in caps), "pages": len(caps),
           "elements": sum(c.get("elements") or 0 for c in caps), "values": {}, "customProperties": {}, "patterns": {},
           "components": {}, "targetsUnder24": sum(c.get("targetsUnder24") or 0 for c in caps), "fontsLoaded": [],
           "viewport": caps[0].get("viewport")}
    weights, offset, sections, areas, text, voice = [], 0, [], Counter(), Counter(), {}
    for c in caps:
        _add(out["values"], c.get("values"))
        for k, v in (c.get("customProperties") or {}).items():
            out["customProperties"].setdefault(k, v)
        _add(out["patterns"], c.get("patterns"))
        _add(out["components"], c.get("components"))
        out["fontsLoaded"] += [f for f in c.get("fontsLoaded") or [] if f not in out["fontsLoaded"]]
        _add(voice, c.get("voice"))
        s, lay = c.get("surfaces") or {}, c.get("layout") or {}
        h = lay.get("docHeight") or 1
        w = (c.get("viewport") or [1440])[0] * h
        weights.append((w, s))
        for k, v in (s.get("areas") or {}).items():
            areas[k] += v * w
        for k, v in (s.get("text") or {}).items():
            text[k] += v * w * float(s.get("textShare") or 0)
        sections += [{**x, "y": x["y"] + offset} for x in s.get("sections") or []]
        offset += h
    W = sum(w for w, _ in weights) or 1
    tw = sum(text.values()) or 1
    surf = [s for _, s in weights if s]
    if surf:
        out["surfaces"] = {"grid": surf[0].get("grid"), "pageBg": Counter(s.get("pageBg") for s in surf).most_common(1)[0][0],
                           "areas": {k: round(v / W, 3) for k, v in areas.items()}, "text": {k: round(v / tw, 3) for k, v in text.items()},
                           "textShare": round(sum(float(s.get("textShare") or 0) * w for w, s in weights) / W, 3), "sections": sections,
                           "imagery": round(sum(float(s.get("imagery") or 0) * w for w, s in weights) / W, 3),
                           "whitespace": round(sum(float(s.get("whitespace") or 0) * w for w, s in weights) / W, 3),
                           "blankRows": round(sum(float(s.get("blankRows") or 0) * w for w, s in weights) / W, 3),
                           "air": _median([(float(s["air"]), w) for w, s in weights if s.get("air") is not None]),
                           "gradients": sum(int(s.get("gradients") or 0) for s in surf),
                           "imageBackgrounds": sum(int(s.get("imageBackgrounds") or 0) for s in surf)}
    for role, v in voice.items():  # words per line were averaged per page: average again by line count
        if isinstance(v, dict) and v.get("n") and "words" in v:
            v["words"] = round(sum((c.get("voice") or {}).get(role, {}).get("words", 0) * (c.get("voice") or {}).get(role, {}).get("n", 0)
                                   for c in caps) / v["n"], 1)
    pr = [(c.get("voice") or {}).get("prose") or {} for c in caps]
    if (voice.get("prose") or {}).get("paragraphs"):  # words per sentence: averaged by paragraphs, never added
        n = sum(p.get("paragraphs") or 0 for p in pr if p.get("wordsPerSentence") is not None)
        voice["prose"]["wordsPerSentence"] = round(sum((p.get("wordsPerSentence") or 0) * (p.get("paragraphs") or 0) for p in pr) / n, 1) if n else None
    out["voice"] = voice
    out["layout"] = {"docHeight": offset, "maxTextWidth": max(((c.get("layout") or {}).get("maxTextWidth") or 0) for c in caps) or None}
    return out


def analyse(cap):
    vals = cap["values"]
    computed = cap.get("method") == "computed"
    dials = {d["id"]: d for d in json.loads(INTAKE.read_text())["dials"]} if INTAKE.exists() else {}
    out = {"method": cap.get("method"), "source": cap.get("source"), "files": cap.get("files"), "elements": cap.get("elements")}
    depth, ring_colors = measure_depth(vals, computed, cap.get("elements"), cap.get("patterns"))
    accents, aconf = measure_accent(vals, computed, ring_colors, (cap.get("surfaces") or {}).get("areas"))
    neutrals = []
    for h, n in (vals.get("colors") or {}).items():
        h = hex_norm(h)
        if h and is_neutral(h):
            neutrals.append({"hex": h, "count": n, "oklch": list(oklch(h))})
    neutrals.sort(key=lambda x: -x["count"])
    out["color"] = {"accents": accents[:6], "neutrals": neutrals[:8], **aconf,
                    "borders": {hex_norm(h): n for h, n in sorted((vals.get("borderColors") or {}).items(), key=lambda kv: -kv[1])[:4] if hex_norm(h)},
                    "note": "the accent hex is the reference's identity, a measurement only: carry its role and chroma level, never the hue as the person's primary"}
    mids = [x for x in neutrals if 0.25 <= x["oklch"][0] <= 0.85]
    if mids or neutrals:
        mid = max(mids, key=lambda x: x["count"]) if mids else min(neutrals, key=lambda x: abs(x["oklch"][0] - 0.6))
        out["color"]["neutralTint"] = {"chroma": mid["oklch"][1], "hue": mid["oklch"][2], "count": mid["count"],
                                       "confidence": level(mid["count"], 1, (10, 0), (3, 0))}
    if accents:
        out["color"]["accentChroma"] = accents[0]["oklch"][1]
    ty = measure_type(vals, computed)
    if vals.get("typeRoles"):
        ty.update(measure_roles(vals, cap.get("fontsLoaded")))
    out["type"] = ty
    if ty.get("body"):
        out["bodySize"] = ty["body"]["px"]  # engine.py intake reads this before type.scale.base
    out["space"] = fit_space(vals.get("spacing", {}))
    rad = measure_radius(vals, computed, dials)
    if rad:
        out["radius"] = rad
    out["depth"] = depth
    out["motion"] = measure_motion(vals, computed)
    surf = measure_surfaces(cap)
    if surf:
        out["surfaces"] = surf
        for k in ("whitespace", "blankRows", "air"):  # engine.py intake reads air and blankRows for the Density dial
            out[k] = surf.get(k)
        out["color"]["chromaticShare"] = surf["chromaticShare"]  # and this for Colorfulness
    if cap.get("components"):
        out["components"] = _parse_sigs(cap["components"])
    for k in ("voice", "layout"):
        if cap.get(k):
            out[k] = cap[k]
    if cap.get("pages"):
        out["pages"] = cap["pages"]
    out["summary"] = summarize(out)
    out["identity"] = {"rule": "measurements of the reference's identity, never values to adopt: carry role, chroma level, "
                               "structure and rhythm; ask for the person's own brand color and typeface",
                       "accentHue": accents[0]["hex"] if accents else None, "typefaces": ty.get("families", [])}
    out["neverInferred"] = ["brandPresence (always ask)", "intent, audience, principles"]
    return out


def summarize(a):
    S = {}

    def put(key, value, block, basis=None):
        if value is not None and block:
            S[key] = {"value": value, "confidence": block.get("confidence", "low"), "count": block.get("count"),
                      "basis": basis or block.get("basis")}
    t = a["type"]
    put("bodySize", (t.get("body") or {}).get("px"), t.get("body"))
    if t.get("headingRatio"):
        put("headingRatio", t["headingRatio"]["value"], {**t["headingRatio"], "count": t["largestHeading"]["count"]},
            f"largest heading {t['largestHeading']['px']:g} px / body; one page can mislead")
    c = a["color"]
    if c.get("accents"):
        top = c["accents"][0]
        put("accent", {"chroma": top["oklch"][1], "usedOn": sorted(top["sources"])}, c,
            c["basis"] + "; the hue is identity and is not carried")
    if c.get("neutralTint"):
        put("neutralTint", {"chroma": c["neutralTint"]["chroma"], "hue": c["neutralTint"]["hue"]}, c["neutralTint"],
            "most-used mid-tone neutral")
    r = a.get("radius") or {}
    put("radiusControl", (r.get("control") or {}).get("px"), r.get("control"), r.get("basis"))
    put("radiusContainer", (r.get("container") or {}).get("px"), r.get("container"), r.get("basis"))
    put("depth", a["depth"]["hint"], a["depth"])
    m = a["motion"]
    put("motionMedianMs", m.get("median"), m, m.get("note"))
    if a.get("space"):
        put("spaceUnit", a["space"]["unit"], a["space"], f"share divisible {a['space']['shareDivisible']}")
    sf = a.get("surfaces")
    if sf:
        put("whitespace", sf["whitespace"], sf, "share of the page with no text, control or card-sized box (media is imagery)")
        if sf.get("air") is not None:
            put("air", sf["air"], sf, "median gap to the next block of text below, in multiples of its type size")
        put("colorShare", sf["chromaticShare"], sf, "share of the page painted in a chromatic colour (backgrounds plus coloured text)")
    if m.get("loops"):
        put("loops", m["loops"]["count"], {"confidence": "medium", "count": m["loops"]["count"]}, m["loops"]["basis"])
    return S


def report(a):
    S = a["summary"]

    def line(label, key, fmt):
        if key not in S:
            return f"{label}: not measured"
        s = S[key]
        return f"{label}: {fmt(s['value'])}  [{s['confidence']}, n={s['count']}]"
    where = f"{a.get('files') or 0} files" if a["method"] == "declared" else f"{a.get('elements') or 0} elements"
    L = [f"Source method: {a['method']} ({where})",
         line("Body size", "bodySize", lambda v: f"{v:g} px"),
         line("Heading ratio", "headingRatio", lambda v: f"x{v} (largest heading / body)"),
         line("Accent", "accent", lambda v: f"chroma {v['chroma']} on {', '.join(v['usedOn'])} (hue not carried)"),
         line("Neutral tint", "neutralTint", lambda v: f"chroma {v['chroma']}, hue {v['hue']} (Warmth dial)"),
         line("Control radius", "radiusControl", lambda v: f"{v} px" if v != "full" else "full (pill)"),
         line("Container radius", "radiusContainer", lambda v: f"{v} px" if v != "full" else "full"),
         line("Depth", "depth", str),
         line("Motion", "motionMedianMs", lambda v: f"median {v:g} ms, multiplier {a['motion']['durationMultiplier']}"),
         line("Spacing unit", "spaceUnit", str)]
    if "whitespace" in S:
        L.append(line("Whitespace", "whitespace", lambda v: f"{round(v * 100)}% of the page"
                      + (f"; {round(a['surfaces']['blankRows'] * 100)}% of its height blank" if a["surfaces"].get("blankRows") is not None else "")))
        if "air" in S:
            L.append(line("Air", "air", lambda v: f"text blocks {v} type sizes apart (median)"))
        L.append(line("Colour area", "colorShare", lambda v: f"{round(v * 100, 1):g}% of the page is chromatic"))
        sf = a["surfaces"]
        if sf.get("worlds"):
            L.append("Sections: " + ", ".join(f"{w['hex']} {round(w['share'] * 100)}%" for w in sf["worlds"]) + (
                " (colour as a place)" if sf.get("colourIsPlace") else ""))
    m = a["motion"]
    if m.get("loops"):
        L.append(f"Loops: {m['loops']['count']} always running, {m['loops']['character']} ({', '.join(f'{d:g} ms' for d in m['loops']['durations'][:4])})")
    if m.get("fadesOnly"):
        L.append(f"UI motion: colour and opacity fades only ({m['fades']}), nothing moves in space")
    if a["depth"].get("windowCount"):
        L.append(f"Windows: {a['depth']['windowCount']} boxes with a title bar ({a['depth']['windows'][0]['bar']})")
    t = a["type"]
    if t.get("scale"):
        L.append(f"Type scale: base {t['scale']['base']:g} x {t['scale']['ratio']} ({t['scale']['reading']})")
    if a.get("radius", {}).get("roundnessDial") is not None:
        L.append(f"Roundness dial about {a['radius']['roundnessDial']}")
    if a["depth"].get("ignored"):
        L.append("Shadows ignored: " + ", ".join(f"{k} x{n}" for k, n in a["depth"]["ignored"].items()))
    idn = a["identity"]
    L.append("Identity, not carried unless this is the person's own product: " + ", ".join(filter(None, [f"accent hue {idn['accentHue']}" if idn["accentHue"] else "",
                                                              "typeface " + ", ".join(idn["typefaces"]) if idn["typefaces"] else "",
                                                              "logo, name, copy"])))
    L.append("Always ask: brand presence, intent, audience.")
    return "\n".join(L)


def look_differences(caps):
    """Pages that do not share one look should not be merged: one Taste Index per look (the reel keeps one per surface).
    Compares each page's depth model, control corners and share of colour with the first page's."""
    if len(caps) < 2:
        return []
    read = [analyse(c) for c in caps]
    out = []
    first = read[0]
    for i, r in enumerate(read[1:], 2):
        diffs = []
        if r["depth"]["hint"] != first["depth"]["hint"]:
            diffs.append(f"depth {first['depth']['hint']} vs {r['depth']['hint']}")
        c0, c1 = (((x.get("radius") or {}).get("control") or {}).get("px") for x in (first, r))
        if (isinstance(c0, (int, float)) and isinstance(c1, (int, float)) and abs(c0 - c1) > 4) or (c0 == "full") != (c1 == "full"):
            diffs.append(f"control corners {c0} vs {c1} px")
        s0, s1 = ((x.get("surfaces") or {}).get("chromaticShare") for x in (first, r))
        if s0 is not None and s1 is not None and abs(s0 - s1) > 0.3:
            diffs.append(f"{round(s0 * 100)}% vs {round(s1 * 100)}% of the page in colour")
        if len(diffs) >= 2:
            out.append(f"page {i} looks different from page 1 ({'; '.join(diffs)}). Merge only pages that share one look; "
                       "give a different look its own Taste Index.")
    return out


def load_capture(path):
    cap = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(cap, str):  # a browser tool may hand back the JSON as a quoted string
        cap = json.loads(cap)
    cap.setdefault("method", "computed")
    return cap


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--from-json", action="append", help="output of read_page.js saved to a file; repeat for several pages of one site")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    if a.from_json:
        caps = [load_capture(f) for f in a.from_json]
        for line in look_differences(caps):
            print("warning: " + line, file=sys.stderr)
        cap = merge_captures(caps)
    elif a.paths:
        cap = scan_files(a.paths)
        cap["source"] = ", ".join(a.paths)
    else:
        ap.error("give paths to scan or --from-json")
    res = analyse(cap)
    print(json.dumps(res, indent=1) if a.json else report(res))


if __name__ == "__main__":
    main()
