#!/usr/bin/env python3
"""OpenDesigner preflight: catch the silly mistakes before an export. Read-only.

  preflight.py html  <file.html> [--medium web|app|watch|video]   type and font checks from the page's CSS
  preflight.py video <file.mp4> [--ignore 0-17]         frozen time with timestamps, black frames, flashing, audio, length
               [--flash-field tablet|phone|PX] [--flash-where worst.png]
  preflight.py frames <file.mp4> [--every 0.5] [--out DIR]   full-size frames plus 390 px phone copies
  preflight.py audio <clip.wav> [...]                     noise bursts or clicks at the start or end of each clip

Exit code 1 when an error is found. Standard library only, no network; video modes need ffmpeg and ffprobe.
The html check reads CSS, not the rendered page. See ../references/checklist.md for the checks a script cannot make.
"""
import argparse, html as htmllib, json, math, re, shutil, subprocess, sys, tempfile
from pathlib import Path

GENERIC = {"serif", "sans-serif", "monospace", "system-ui", "ui-monospace", "ui-sans-serif", "ui-serif", "ui-rounded",
           "-apple-system", "blinkmacsystemfont", "inherit", "initial", "unset", "cursive", "fantasy", "emoji", "math"}
# Smallest text, as (error below, warn below) in CSS px. On app and watch pages laid out at the device's width in
# points, 1 CSS px = 1 pt. Sources: Apple HIG Typography (iOS 11 pt, watchOS 12 pt minimum), Material 3 (label-small
# 11, body-small 12), and stage 11 of the opendesigner skill (12 px on the web, 11 pt on mobile).
MIN = {"web": (11, 12), "app": (11, 11), "watch": (12, 12), "video": (40, 54)}
WHY = {"web": "below 11 px is under every platform minimum; 12 px is the web floor for text people read, and 11 px "
              "fits only short labels (stage 11, Material label-small)",
       "app": "11 pt is the iOS and Android minimum (Apple HIG, Material label-small)",
       "watch": "12 pt is the watchOS minimum (Apple HIG)",
       "video": "a 1920 px frame watched 390 pt wide on a phone needs about 54 px for 11 pt; check it on a 390 px wide frame"}
SIZE_WORDS = {"xx-small", "x-small", "small", "medium", "large", "x-large", "xx-large", "xxx-large", "smaller", "larger"}


class Report:
    def __init__(self):
        self.errors = 0
        self.warns = 0

    def err(self, msg):
        self.errors += 1
        print(f"ERROR  {msg}")

    def warn(self, msg):
        self.warns += 1
        print(f"WARN   {msg}")

    def info(self, msg):
        print(f"       {msg}")


def split_top(s: str, seps: str) -> list:
    """Split on any character in `seps` outside parentheses and quotes."""
    parts, cur, depth, quote = [], [], 0, None
    for ch in s:
        if quote:
            quote = None if ch == quote else quote
        elif ch in "\"'":
            quote = ch
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        elif depth == 0 and ch in seps:
            parts.append("".join(cur))
            cur = []
            continue
        cur.append(ch)
    parts.append("".join(cur))
    return [p.strip() for p in parts if p.strip()]


def unquote_url(s: str) -> str:
    return re.sub(r"%([0-9A-Fa-f]{2})", lambda m: chr(int(m.group(1), 16)), s.replace("+", " "))


def google_families(url: str) -> list:
    """Families named in a Google Fonts stylesheet URL (css and css2 APIs). No request is made."""
    fams = []
    for value in re.findall(r"[?&]family=([^&]+)", htmllib.unescape(url)):
        for part in unquote_url(value).split("|"):
            name = part.split(":")[0].strip()
            if name:
                fams.append(name)
    return fams


def find_local(href: str, base: Path, html_dir: Path):
    """A stylesheet path on disk: relative to the file that links it, or root-relative (searched upward)."""
    href = href.split("#")[0].split("?")[0]
    if not href.startswith("/"):
        p = (base / href).resolve()
        return p if p.is_file() else None
    for d in [html_dir, *html_dir.parents]:
        p = d / href.lstrip("/")
        if p.is_file():
            return p
    return None


class Sheets:
    """Every stylesheet a page loads, in document order: <style>, <link rel=stylesheet> and @import."""

    def __init__(self, html_path: Path, html: str):
        self.html_dir = html_path.parent.resolve()
        self.css, self.google, self.remote, self.missing = [], {}, [], []
        for m in re.finditer(r"<style[^>]*>(.*?)</style>|<link\b[^>]*>", html, re.S | re.I):
            if m.group(1) is not None:
                self.add_css(m.group(1), self.html_dir, 0)
                continue
            attrs = {k.lower(): v for k, v in re.findall(r'([\w-]+)\s*=\s*["\']([^"\']*)["\']', m.group(0))}
            rel = attrs.get("rel", "").lower().split()
            if "stylesheet" in rel or ("preload" in rel and attrs.get("as", "").lower() == "style"):
                self.add_href(attrs.get("href", ""), self.html_dir, 0)

    def add_href(self, href: str, base: Path, depth: int):
        href = htmllib.unescape(href.strip())
        if not href or depth > 4:
            return
        if re.match(r"(https?:)?//", href, re.I):
            if re.search(r"//fonts\.googleapis\.com/css", href, re.I):
                for f in google_families(href):
                    self.google.setdefault(f, href)
            elif href not in self.remote:
                self.remote.append(href)
            return
        p = find_local(href, base, self.html_dir)
        if p is None:
            self.missing.append(href)
        else:
            self.add_css(p.read_text(encoding="utf-8", errors="replace"), p.parent, depth + 1)

    def add_css(self, css: str, base: Path, depth: int):
        css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
        for imp in re.findall(r"@import\s+(?:url\(\s*)?[\"']?([^\"')\s;]+)", css, re.I):
            self.add_href(imp, base, depth)
        self.css.append(css)


def css_blocks(css: str) -> list:
    """(prelude, body, enclosing at-rules) for every innermost block, in order."""
    out, stack, start, leaf, i, n = [], [], 0, False, 0, len(css)
    while i < n:
        c = css[i]
        if c in "\"'":
            j = css.find(c, i + 1)
            i = n if j < 0 else j + 1
            continue
        if c == "{":
            stack.append(css[start:i].rsplit(";", 1)[-1].strip())
            start, leaf = i + 1, True
        elif c == "}":
            if stack:
                pre = stack.pop()
                if leaf:
                    out.append((pre, css[start:i], list(stack)))
            start, leaf = i + 1, False
        i += 1
    return out


def decls(body: str) -> list:
    out = []
    for d in split_top(body, ";"):
        if ":" in d:
            prop, val = d.split(":", 1)
            out.append((prop.strip().lower() if not prop.strip().startswith("--") else prop.strip(),
                        re.sub(r"\s*!important\s*$", "", val.strip(), flags=re.I)))
    return out


def length_px(tok: str, root: float):
    m = re.fullmatch(r"(-?\d*\.?\d+)(px|rem|pt|pc)", tok.strip(), re.I)
    if not m:
        return None
    v, unit = float(m.group(1)), m.group(2).lower()
    return v * {"px": 1, "rem": root, "pt": 4 / 3, "pc": 16}[unit]


def size_px(val: str, root: float):
    """Font sizes a value can render at, in CSS px. None when it depends on the parent or the window."""
    val = val.strip()
    m = re.fullmatch(r"(clamp|min|max)\((.*)\)", val, re.I | re.S)
    if m:
        args = split_top(m.group(2), ",")
        if m.group(1).lower() == "clamp" and len(args) == 3:
            args = [args[0], args[2]]
        got = [x for x in (length_px(a, root) for a in args) if x is not None]
        return got or None
    x = length_px(val, root)
    return None if x is None else [x]


# A custom property that holds a font size, by the common ways of naming one: --font-size-* and fontSize (most systems, the
# engine's --ds-font-size-*), --fs-*, Tailwind v4's --text-*, --type-*, --font-sm, Material's --md-sys-typescale-*-size and
# Utopia's --step-0. Never its line height, tracking, weight, family or colour, which share those prefixes.
SIZE_TOKEN = re.compile(r"font-?size|typescale.*size$|(?:^--|[-_])(?:fs|text|type|font)(?:[-_]|$)|^--step--?\d+$", re.I)
NOT_SIZE_TOKEN = re.compile(r"line-?height|leading|tracking|letter|spacing|weight|family|face|colou?r|shadow|decoration|"
                            r"indent|offset|stroke|width|gap|radius|wrap|align", re.I)


def size_token(name: str) -> bool:
    return bool(SIZE_TOKEN.search(name)) and not NOT_SIZE_TOKEN.search(name)


WIDTHS = (320, 390, 768, 1024, 1440, 1920)   # where a fluid size (vw, clamp) is measured, with a 900 px tall window
UNITS = {"px": lambda v, c: v, "rem": lambda v, c: v * c[0], "pt": lambda v, c: v * 4 / 3, "pc": lambda v, c: v * 16,
         "vw": lambda v, c: v * c[1] / 100, "svw": lambda v, c: v * c[1] / 100, "lvw": lambda v, c: v * c[1] / 100, "dvw": lambda v, c: v * c[1] / 100,
         "vh": lambda v, c: v * c[2] / 100, "svh": lambda v, c: v * c[2] / 100, "lvh": lambda v, c: v * c[2] / 100, "dvh": lambda v, c: v * c[2] / 100,
         "vmin": lambda v, c: v * min(c[1], c[2]) / 100, "vmax": lambda v, c: v * max(c[1], c[2]) / 100}


def css_px(val: str, root: float, vw: float, vh: float = 900):
    """A length as the browser computes it at one window size: px, rem, pt, vw, vh and calc(), min(), max(), clamp() of them.
    None when it depends on the parent (em, %, ch, container units) or cannot be read."""
    toks = re.findall(r"(-?\d*\.?\d+)([a-z%]*)|([a-z-]+)\(|([()+*/,-])", val.strip().lower())
    pos = [0]

    def peek():
        return toks[pos[0]] if pos[0] < len(toks) else None

    def take():
        pos[0] += 1
        return toks[pos[0] - 1]

    def args():
        out = [expr()]
        while peek() and peek()[3] == ",":
            take()
            out.append(expr())
        if not peek() or take()[3] != ")":
            raise ValueError
        return out

    def factor():
        t = take()
        num, unit, fn, op = t
        if num:
            if not unit:
                return (float(num), False)
            if unit not in UNITS:
                raise ValueError
            return (UNITS[unit](float(num), (root, vw, vh)), True)
        if fn in ("calc", "min", "max", "clamp"):
            a = args()
            if fn == "calc":
                return a[0]
            vals = [x[0] for x in a]
            if fn == "clamp" and len(vals) == 3:
                return (max(vals[0], min(vals[1], vals[2])), True)
            return ((min if fn == "min" else max)(vals), True)
        if op == "(":
            v = expr()
            take()
            return v
        if op == "-":
            v = factor()
            return (-v[0], v[1])
        raise ValueError

    def term():
        v = factor()
        while peek() and peek()[3] in ("*", "/"):
            op = take()[3]
            w = factor()
            v = (v[0] * w[0], v[1] or w[1]) if op == "*" else (v[0] / w[0], v[1])
        return v

    def expr():
        v = term()
        while peek() and peek()[3] in ("+", "-") or (peek() and peek()[0].startswith("-") and peek()[0] != "-"):
            if peek()[3] in ("+", "-"):
                op = take()[3]
                w = term()
            else:                       # "1rem -0.5vw" tokenises the minus into the number
                op, w = "+", term()
            v = (v[0] + w[0] if op == "+" else v[0] - w[0], v[1] or w[1])
        return v

    try:
        v = expr()
        return round(v[0], 2) if v[1] and pos[0] == len(toks) else None
    except (ValueError, IndexError, ZeroDivisionError):
        return None


def first_family(stack: str):
    names = split_top(stack, ",")
    if not names or names[0].startswith("var("):
        return None
    name = names[0].strip("'\"").strip()
    return None if name.lower() in GENERIC else name


def parse_font(val: str):
    """The `font` shorthand, `[style] [variant] [weight] [stretch] size[/line-height] family`, as (size, family)."""
    toks = split_top(val, " \t\r\n")
    for i, t in enumerate(toks):
        head = split_top(t, "/")[0] if "/" in t and not t.startswith("/") else t
        if re.fullmatch(r"-?\d*\.?\d+(px|rem|em|pt|pc|%|vw|vh|vmin|vmax|cqi|ch|ex)", head, re.I) \
                or re.match(r"(clamp|min|max|calc)\(", head, re.I) or head.lower() in SIZE_WORDS:
            rest = i + 1
            if t.endswith("/"):
                rest = i + 2
            elif "/" not in t and rest < len(toks) and toks[rest].startswith("/"):
                rest += 2 if toks[rest] == "/" else 1
            return head, " ".join(toks[rest:])
    return None, None


PURE = {"white": re.compile(r"#(?:fff|ffffff)(?![0-9a-z])|\brgb\(\s*255\s*,\s*255\s*,\s*255\s*\)|\bwhite\b", re.I),
        "black": re.compile(r"#(?:000|000000)(?![0-9a-z])|\brgb\(\s*0\s*,\s*0\s*,\s*0\s*\)|\bblack\b", re.I)}


def check_html(path: Path, medium: str) -> Report:
    r = Report()
    page = path.read_text(encoding="utf-8", errors="replace")
    sheets = Sheets(path, page)
    blocks = [b for css in sheets.css for b in css_blocks(css)]
    no_style = re.sub(r"<style[^>]*>.*?</style>", "", page, flags=re.S | re.I)
    words = set(re.findall(r"[\w-]+", no_style))
    for attr in re.findall(r"\sstyle\s*=\s*(?:\"([^\"]*)\"|'([^']*)')", no_style):
        blocks.append(("[style]", htmllib.unescape(attr[0] or attr[1]), []))

    def is_root(sel, at):
        return not any(a.startswith("@") and not a.lower().startswith("@layer") for a in at) and \
            any(s in (":root", "html") for s in split_top(sel, ","))

    def used(sel):  # a rule counts when every class and id it names appears in the page (markup or script)
        if sel == "[style]":
            return True
        for item in split_top(sel, ","):
            item = re.sub(r"\[[^\]]*\]|:(not|has)\([^)]*\)", "", item)
            if all(n in words for n in re.findall(r"[.#](-?[A-Za-z_][\w-]*)", item)):
                return True
        return False

    root_props, any_props, faces, scale = {}, {}, set(), set()
    for sel, body, at in blocks:
        ds = decls(body)
        if sel.lower().startswith("@font-face"):
            faces |= {v.strip("'\" ") for p, v in ds if p == "font-family"}
            continue
        for p, v in ds:
            if p.startswith("--"):
                any_props.setdefault(p, v)
                if is_root(sel, at):
                    root_props[p] = v

    def resolve(value, local, depth=0):
        if depth > 8 or "var(" not in value:
            return value

        def sub(m):
            name, fb = m.group(1), m.group(2)
            v = local.get(name, root_props.get(name, any_props.get(name)))
            return resolve(v, local, depth + 1) if v is not None else (resolve(fb.strip(), local, depth + 1) if fb else m.group(0))
        return re.sub(r"var\(\s*(--[\w-]+)\s*(?:,((?:[^()]|\([^()]*\))*))?\)", sub, value)

    root_px = 16.0
    for sel, body, at in blocks:
        if is_root(sel, at):
            for p, v in decls(body):
                if p == "font-size":
                    v = resolve(v, {})
                    pct = re.fullmatch(r"(\d*\.?\d+)%", v.strip())
                    root_px = 16 * float(pct.group(1)) / 100 if pct else (length_px(v, 16) or root_px)
    for name, v in any_props.items():
        if size_token(name):
            for x in size_px(resolve(v, {}), root_px) or []:
                scale.add(round(x, 1))

    sizes, families, tracking, loose = [], set(), [], 0
    kern = {"off": [], "px": [], "pct": [], "wide": [], "caps": [], "speed": []}  # kerning.md, checklist 57 [M58]
    pure = {"white": [], "black": []}  # opaque #ffffff and #000000 as colours, checklist 58 [M59]
    rules, fluid = [], {}   # (selector, size at 1440 px, tracking, capitals) per rule; selector -> size at each width
    for sel, body, at in blocks:
        if sel.startswith("@") or not used(sel):
            continue
        ds = decls(body)
        local = {p: v for p, v in ds if p.startswith("--")}
        props = {p: resolve(v, local).strip().lower() for p, v in ds if not p.startswith("--")}
        where = sel if sel != "[style]" else "a style attribute"
        ls = props.get("letter-spacing", "")
        caps = props.get("text-transform") == "uppercase" or "all-small-caps" in props.get("font-variant", "") + props.get("font-variant-caps", "")
        for p_, v_ in props.items():
            if re.fullmatch(r"color|background(-color)?|fill|stroke|border(-[a-z]+)*|outline(-color)?|caret-color", p_):
                for k_, rx_ in PURE.items():
                    if rx_.search(v_):
                        pure[k_].append(f"{where} {p_}: {v_[:40]}")
        if props.get("font-kerning") == "none" or re.search(r"[\"']kern[\"']\s*(0|off)\b", props.get("font-feature-settings", "")):
            kern["off"].append(where)
        if props.get("text-rendering") == "optimizespeed":
            kern["speed"].append(where)
        if re.search(r"(?<![\w.])-?(?:\d*\.)?\d*[1-9]\d*px\b", ls):
            kern["px"].append(f"{where} {ls}")
        if re.search(r"-?\d*\.?\d+%", ls):
            kern["pct"].append(f"{where} {ls}")
        ems = [float(x) for x in re.findall(r"(-?\d*\.?\d+)em\b", ls)]
        if not caps and any(abs(e) >= 0.5 for e in ems):
            kern["wide"].append(f"{where} {ls}")
        if caps and (ems and max(ems) == 0 or ls in ("0", "normal")):  # below 0 is the [M5] error above
            kern["caps"].append(f"{where} {ls}")
        rule = {"size": None, "ls": None, "caps": False}
        for prop, raw in ds:
            if prop.startswith("--"):
                continue
            val = resolve(raw, local)
            size_val = None
            if prop == "font-size":
                size_val = val
            elif prop == "font":
                size_val, fam = parse_font(val)
                f = first_family(fam) if fam else None
                if f:
                    families.add(f)
            elif prop == "font-family":
                f = first_family(val)
                if f:
                    families.add(f)
            elif prop == "letter-spacing":
                rule["ls"] = val.strip().lower()
            elif (prop == "text-transform" and "uppercase" in val.lower()) or (prop == "font-variant-caps" and re.search(r"all-(small|petite)-caps", val, re.I)):
                rule["caps"] = True
            if size_val is not None and size_val.lower() not in ("inherit", "initial", "unset", "revert"):
                got = size_px(size_val, root_px)
                at = [css_px(size_val, root_px, w) for w in WIDTHS]
                if got:
                    sizes += got
                elif None not in at:            # fluid (vw, calc): measured at each width, as a browser would draw it
                    fluid[sel] = at
                else:
                    loose += 1
                rule["size"] = at[WIDTHS.index(1440)] if None not in at else (got[-1] if got else None)
        if rule["ls"] is not None:
            m = re.fullmatch(r"(-?\d*\.?\d+)em", rule["ls"])
            px_ = css_px(rule["ls"], root_px, 1440) if not m else None
            em = float(m.group(1)) if m else (px_ / rule["size"] if px_ is not None and rule["size"] else None)
            if rule["ls"] == "normal":
                em = 0.0
            if em is not None:
                tracking.append(round(em, 3))
                rules.append((sel, rule["size"], round(em, 3), rule["caps"]))
    # families set from scripts (for example GSAP fontFamily)
    for f in re.findall(r"fontFamily\s*:\s*[\"']([^\"']+)[\"']", page):
        ff = first_family(f)
        if ff:
            families.add(ff)

    lower = lambda names: {n.lower() for n in names}
    google = sorted(f for f in families if f.lower() in lower(sheets.google))
    for f in sorted(families):
        if f.lower() in lower(faces) or f.lower() in lower(sheets.google):
            continue
        if sheets.remote:
            r.warn(f'font "{f}" has no @font-face here; it may come from {", ".join(sheets.remote)}, which this '
                   f"script does not fetch. Check document.fonts in a browser  [M9]")
        else:
            r.err(f'font "{f}" is used but has no @font-face, so another face may render  [M9]')
    if google:
        msg = f"loaded from Google Fonts: {', '.join(google)}"
        if medium == "video":
            r.warn(msg + "; a renderer can capture frames before a web font arrives. Ship the font file, or wait "
                         "for document.fonts.ready before the first frame  [M9]")
        else:
            r.info(msg + " (needs the network when the page loads)")
    for href in sheets.missing:
        r.warn(f"stylesheet {href} is linked but not found next to the page, so its sizes and fonts were not read")

    distinct = sorted(set(round(s, 1) for s in sizes))
    fmt = lambda xs: "[" + ", ".join(f"{x:g}" for x in xs) + "]"
    r.info(f"font sizes in px: {fmt(distinct)}" + (f" (1rem = {root_px:g}px)" if root_px != 16 else ""))
    if fluid:
        per = {w: sorted({round(v[i], 1) for v in fluid.values()} | set(distinct)) for i, w in enumerate(WIDTHS)}
        frac = sorted({round(x, 1) for v in fluid.values() for x in v if abs(x - round(x)) >= 0.05})
        r.info(f"{len(fluid)} fluid font size(s) (vw, clamp), measured at each width: " + "; ".join(f"{w} px: {fmt([round(v[i], 1) for v in fluid.values()])}" for i, w in enumerate(WIDTHS) if w in (390, 1440)))
        worst = max(per, key=lambda w: len(per[w]))
        if len(per[worst]) > 10 and len(distinct) <= 10:
            r.warn(f"{len(per[worst])} distinct font sizes at {worst} px once fluid sizes are drawn; a scale has about 8  [M6]")
        if frac:
            r.info(f"fluid sizes land between whole pixels at most widths ({fmt(frac[:6])}); step them at breakpoints if sizes must match a scale  [M6]")
        small = sorted({round(v[0], 1) for v in fluid.values() if v[0] < MIN[medium][0]})
        if small:
            r.err(f"fluid text under {MIN[medium][0]}px at 320 px wide: {fmt(small)}; {WHY[medium]}  [M8]")
    if loose:
        r.info(f"{loose} font size(s) depend on the parent (em, %) and were not counted; measure them rendered")
    if not distinct:
        r.warn("no font sizes found; measure type in the rendered page instead  [M6]")
    if len(distinct) > 10:
        r.warn(f"{len(distinct)} distinct font sizes; a scale has about 8  [M6]")
    close = [(a, b) for a, b in zip(distinct, distinct[1:]) if a and (b - a) / a < 0.10]
    if close:
        r.warn(f"sizes within 10% of each other: {', '.join(f'{a:g}/{b:g}' for a, b in close)}  [M6]")
    if len(scale) >= 3 and medium == "video":
        r.info("video sizes map the token scale to the frame; compare them with the mapping you wrote down  [M2]")
    elif len(scale) >= 3:
        off = [s for s in distinct if not any(abs(s - t) <= 0.5 for t in scale)]
        if off:
            r.warn(f"sizes outside the token scale {fmt(sorted(scale))}: {fmt(off)}  [M2, M6]")
    lo_err, lo_warn = MIN[medium]
    if [s for s in distinct if s < lo_err]:
        r.err(f"text under {lo_err}px for {medium}: {fmt([s for s in distinct if s < lo_err])}; {WHY[medium]}  [M8]")
    elif [s for s in distinct if s < lo_warn]:
        r.warn(f"text under {lo_warn}px for {medium}: {fmt([s for s in distinct if s < lo_warn])}; {WHY[medium]}  [M8]")
    r.info("sizes are as written; text inside a scaled container (transform: scale) is smaller on screen  [M31]")
    tight = sorted(set(t for t in tracking if t < -0.03))
    if tight:
        r.warn(f"letter-spacing tighter than -0.03em: {tight}; check glyphs and word spaces at 200%  [M5]")
    caps = [(s, em) for s, _, em, c in rules if c and em < 0]
    if caps:
        r.err("capitals tracked tight: " + ", ".join(f"{s} at {em:g}em" for s, em in caps[:4]) + "; uppercase needs open tracking (about +0.02 to +0.08em), never negative  [M5]")
    sized = sorted((x for x in rules if x[1] and not x[3]), key=lambda x: x[1])
    back = [(a, b) for i, a in enumerate(sized) for b in sized[i + 1:] if b[1] >= a[1] * 1.25 and b[2] > a[2] + 0.005]
    if back:
        a, b = max(back, key=lambda ab: ab[1][2] - ab[0][2])
        r.warn(f"tracking gets looser as type gets bigger: {b[0]} is {b[1]:g}px at {b[2]:g}em, {a[0]} is {a[1]:g}px at {a[2]:g}em; tighten as size grows  [M5]")
    if len(set(tracking)) > 4:
        r.warn(f"{len(set(tracking))} letter-spacing values: {sorted(set(tracking))}; about 4 (body, display, capitals) come with the type styles  [M5]")
    if kern["off"]:
        r.err(f"kerning switched off (font-kerning: none or \"kern\" 0) in {', '.join(kern['off'][:6])}; remove it, and set "
              "font-kerning: normal on display text  [M58]")
    if kern["speed"]:
        r.warn(f"text-rendering: optimizeSpeed in {', '.join(kern['speed'][:6])} can skip kerning and ligatures; remove it  [M58]")
    if kern["px"]:
        r.warn(f"letter-spacing in px: {'; '.join(kern['px'][:6])}; write tracking in em so it scales with the size and text zoom  [M58]")
    if kern["pct"]:
        r.warn(f"letter-spacing in %: {'; '.join(kern['pct'][:6])}; CSS % is a share of the space width, not Figma's percent "
               "(Figma -2% is -0.02em)  [M58]")
    if kern["wide"]:
        r.warn(f"letter-spacing of 0.5em or more on mixed-case text: {'; '.join(kern['wide'][:6])}; usually a unit copied "
               "from a mock (Figma -2% is -0.02em)  [M58]")
    if kern["caps"]:
        r.warn(f"uppercase text tracked at 0: {'; '.join(kern['caps'][:6])}; capitals need about +0.04 to +0.1em  [M58]")
    if pure["white"] and pure["black"]:
        r.warn(f"pure white ({pure['white'][0]}) and pure black ({pure['black'][0]}) on one page; use an off-black such as "
               "#111111 with white, or an off-white with black (house standard STD-visual-details-66)  [M59]")
    code = " ".join(re.findall(r"<script[^>]*>(.*?)</script>", page, flags=re.S | re.I))
    splits = re.search(r"SplitText\([^)]*chars|type\s*:\s*[\"'][^\"']*chars|\bSplitting\("
                       r"|(?:split\(\s*(?:\"\"|'')\s*\)|\[\s*\.\.\.\s*[\w.]+(?:textContent|innerText)\s*\]"
                       r"|Array\.from\(\s*[\w.]+(?:textContent|innerText)\s*\))(?=[^;]{0,200}?span)", code)
    if splits:  # a split string only counts when its letters are wrapped in spans
        if re.search(r"kern|getBoundingClientRect", code, re.I):
            r.info("text is split into letters; kerning seems to be measured and restored. Check that the last frame equals "
                   "the plain text at 200%  [M58]")
        else:
            r.warn(f"text is split into one element per letter ({splits.group(0)[:40]}), which drops the font's kerning and "
                   "ligatures; animate words or lines, or measure and restore kerning and put the markup back  [M58]")
    body = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", page, flags=re.S | re.I)
    breaks = body if medium == "video" else " ".join(re.findall(r"<h[1-6][^>]*>.*?</h[1-6]>", body, re.S | re.I))
    if re.search(r"<br\s*/?>", breaks, re.I):
        r.warn(f"<br> in {'text' if medium == 'video' else 'a heading'}; let it wrap with text-wrap: balance  [M7]")
    for prop in ("left", "top", "width", "height", "fontSize", "letterSpacing"):
        if re.search(r"\.(to|fromTo|from)\([^;]*\{[^}]*\b" + prop + r"\s*:", page):
            r.warn(f"a tween animates {prop}; layout properties snap to whole pixels, use x, y or scale  [M18]")
    return r


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def need_ffmpeg():
    if not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
        sys.exit("ffmpeg and ffprobe are needed for this check")


# WCAG 2.2 SC 2.3.1 (three flashes or below threshold): a 10-degree field at the closest likely viewing. Screens in cm
# from Apple's specs (iPad Pro 13-inch: 2064 x 2752 px at 264 ppi; iPhone 15: 1179 x 2556 px at 460 ppi), held
# closer than usual.
VIEWS = {"tablet": ("a 13-inch tablet at 25 cm", 19.86, 26.48, 25.0), "phone": ("a phone at 15 cm", 6.51, 14.11, 15.0)}


def flash_field(w, h, view: str) -> float:
    """Video px across a 10-degree field, with the video fitted to the screen and turned the way that shows it biggest."""
    _, sw, sh, dist = VIEWS[view]
    cm_per_px = max(min(sw / w, sh / h), min(sh / w, sw / h))
    return 2 * dist * math.tan(math.radians(5)) / cm_per_px


ON = 65280  # full scale at 16 bits, for luminance and for "flashing": ffmpeg's lut stops at 65280 for gray16


def flash_graph(src: str, aw: int, ah: int, n: int) -> str:
    """ffmpeg filters from [src] to [bad]: ON where a pixel makes a general-flash transition at this frame and has made
    7 or more in the last n frames (one second), else 0. Both directions count, which errs on the safe side."""
    unit, f = ON // n, "format=gray16le"  # every step is pinned to 16 bits: ffmpeg would otherwise pick 8 bits for some
    # sRGB to linear light, one plane at a time: 8-bit grey becomes 16-bit exactly (x 257), packed RGB does not
    x = "(val/65535)"
    lin = f"{ON}*if(lte({x},0.04045),{x}/12.92,pow(({x}+0.055)/1.055,2.4))"
    return (f"[{src}]scale={aw}:{ah},format=rgb24,extractplanes=r+g+b[fr][fg][fb];"
            + "".join(f"[f{c}]{f},lut=c0='{lin}',{f}[fl{c}];" for c in "rgb") +
            f"[flr][flg][flb]mix=inputs=3:weights='0.2126 0.7152 0.0722':scale=1,{f},split=2[fa][fz];"  # relative luminance
            f"[fa]tblend=all_mode=difference,lut=c0='if(gte(val,{0.1 * ON}),{ON},0)',{f}[fd];"  # changed by 0.1 or more
            f"[fz]tblend=all_mode=darken,lut=c0='if(lt(val,{0.8 * ON}),{ON},0)',{f}[fm];"  # the darker state is below 0.8
            f"[fd][fm]blend=all_mode=and,{f},split=2[ft][fu];"
            # count over the last n frames; tmix fills its window with copies of the first frame, so a blank one goes first
            f"[fu]lut=c0='if(val,{unit},0)',{f},tpad=start=1,tmix=frames={n}:weights=1:scale=1,{f},trim=start_frame=1,"
            f"setpts=PTS-STARTPTS,lut=c0='if(gte(val,{6.5 * unit}),{ON},0)',{f}[fc];"
            f"[ft]setpts=PTS-STARTPTS[fn];[fn][fc]blend=all_mode=and,{f}[bad]")


def check_flash(r: Report, path: Path, w: int, h: int, fps: float, field="tablet", where=None):
    """WCAG general flash threshold, measured in ffmpeg: the largest area flashing at once inside any 10-degree field
    (a disk, summed by FFT convolution) must stay at or under 25% of that field."""
    px = flash_field(w, h, field) if field in VIEWS else float(field)
    n = max(1, round(fps))  # frames in one second
    s = min(1.0, 960 / max(w, h))  # measured at up to 960 px on the long side: half size for 1080 x 1920
    aw, ah = max(2, round(w * s)), max(2, round(h * s))
    rad = px / 2 * s
    p = math.ceil(rad) + 1  # a blank margin: convolve copies edge pixels outward, and its FFT wraps around
    pw, ph = aw + 2 * p + (aw % 2), ah + 2 * p + (ah % 2)  # even, so the disk's centre is the kernel's origin
    k = math.floor(rad)
    disk = sum(1 for dy in range(-k, k + 1) for dx in range(-k, k + 1) if dx * dx + dy * dy <= rad * rad)
    g = (flash_graph("0:v", aw, ah, n) + f";[bad]pad={pw}:{ph}:{p}:{p}:black[fp];"
         f"color=c=black:s={pw}x{ph}:d=1:r=1,format=gray16le,"
         f"geq=lum='if(lte((X-{pw // 2})*(X-{pw // 2})+(Y-{ph // 2})*(Y-{ph // 2}),{rad * rad}),65535,0)'[fk];"
         f"[fp][fk]convolve=impulse=first,crop={aw}:{ah}:{p}:{p}")  # each pixel: share of the disk around it that flashes
    pix = "gray16le" if sys.byteorder == "little" else "gray16be"
    size, worst, at, i = aw * ah * 2, 0, 0, 0
    zero = bytes(size)
    with tempfile.TemporaryFile() as log:
        proc = subprocess.Popen(["ffmpeg", "-v", "error", "-noautorotate", "-i", str(path), "-filter_complex", g,
                                 "-f", "rawvideo", "-pix_fmt", pix, "-"], stdout=subprocess.PIPE, stderr=log)
        while len(buf := proc.stdout.read(size)) == size:
            if buf != zero:
                m = max(memoryview(buf).cast("H"))
                if m > worst:
                    worst, at = m, i
            i += 1
        proc.wait()
        log.seek(0)
        errs = log.read().decode(errors="replace").strip().splitlines()
    if proc.returncode:
        r.warn(f"flashing was not measured: {errs[-1] if errs else 'ffmpeg failed'}  [M50]")
        return
    if not i:
        r.info("flashing: a single frame cannot flash")
        return
    limit = 0.25 * math.pi * (px / 2) ** 2
    seen = VIEWS[field][0] if field in VIEWS else "as given"
    r.info(f"flashing (WCAG 2.2 SC 2.3.1, general flash): a 10-degree field is {px:.0f} px across ({seen}); "
           f"the limit is 25% of it, {limit:,.0f} px²")
    if not worst:
        r.info("no pixel changes brightness 7 or more times within a second, so nothing flashes more than 3 times a second")
        return
    share, t = worst / ON / 0.25, (at + 1) / fps
    area = worst / ON * disk * (w / aw) * (h / ah)
    r.info(f"worst flashing area {area:,.0f} px² at {t:.1f} s: {share:.0%} of the limit")
    if share > 1:
        r.err(f"flashing over the general flash threshold at {t:.1f} s ({share:.0%} of the limit). It can trigger "
              "seizures: slow the motion, shrink what changes or lower its brightness change, then measure again  [M50]")
    elif share > 0.9:
        r.warn(f"flashing at {share:.0%} of the limit at {t:.1f} s; aim for 90% or less, to leave a margin for "
               "re-encoding, which changes the pixels  [M50]")
    if where:
        start = max(0, at + 1 - n)  # the second before the worst frame, so its count is complete
        g2 = (f"[0:v]trim=start_frame={start}:end_frame={at + 2},setpts=PTS-STARTPTS,split=2[src][base];"
              + flash_graph("src", aw, ah, n) +
              f";[base]scale={aw}:{ah},trim=start_frame=1,setpts=PTS-STARTPTS,format=gbrp,split=2[b1][b2];"
              "[b2]geq=r=255:g=0:b=255[mag];[bad]format=gray,format=gbrp[mask];[b1][mag][mask]maskedmerge")
        out = run(["ffmpeg", "-v", "error", "-y", "-noautorotate", "-i", str(path), "-filter_complex", g2,
                   "-update", "1", str(where)])
        if out.returncode:
            r.warn(f"the worst moment was not saved: {(out.stderr.strip().splitlines() or ['ffmpeg failed'])[-1]}")
        else:
            r.info(f"worst moment saved to {where}, with the flashing pixels in magenta")


def check_video(path: Path, ignore=(), field="tablet", where=None) -> Report:
    need_ffmpeg()
    r = Report()
    info = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)]).stdout)
    dur = float(info["format"]["duration"])
    v = [s for s in info["streams"] if s["codec_type"] == "video"]
    a = [s for s in info["streams"] if s["codec_type"] == "audio"]
    if v:
        r.info(f"{v[0]['width']}x{v[0]['height']} at {v[0]['r_frame_rate']} fps, {dur:.1f} s")
    if not a:
        r.warn("no audio track; an explainer needs a voice or captions  [M25]")
    else:
        lo = run(["ffmpeg", "-hide_banner", "-i", str(path), "-map", "0:a:0", "-af", "ebur128", "-f", "null", "-"]).stderr
        m = re.findall(r"I:\s*(-?[\d.]+) LUFS", lo)
        if m:
            lufs = float(m[-1])
            r.info(f"loudness {lufs} LUFS (online video sits near -14 to -16)")
            if lufs < -24:
                r.warn("audio is very quiet")
    fr = run(["ffmpeg", "-hide_banner", "-i", str(path), "-map", "0:v:0", "-vf", "freezedetect=n=0.003:d=1.5", "-f", "null", "-"]).stderr
    starts = [float(x) for x in re.findall(r"freeze_start:\s*([\d.]+)", fr)]
    lens = [float(x) for x in re.findall(r"freeze_duration:\s*([\d.]+)", fr)]
    if len(lens) < len(starts):  # a freeze that runs to the end has no duration line
        lens.append(dur - starts[-1])
    def outside(a, b):  # seconds of [a, b] not inside an ignored range
        cut = sum(max(0.0, min(b, y) - max(a, x)) for x, y in ignore)
        return max(0.0, (b - a) - cut)
    holds = [(a, outside(a, a + d)) for a, d in zip(starts, lens)]
    holds = [(a, d) for a, d in holds if d > 0]
    frozen = sum(d for _, d in holds)
    span = dur - sum(max(0.0, min(dur, y) - max(0.0, x)) for x, y in ignore)
    share = frozen / span if span else 0
    note = f" outside the ignored {', '.join(f'{x:g}-{y:g}' for x, y in ignore)} s" if ignore else ""
    r.info(f"frozen for {frozen:.1f} s in holds of 1.5 s or more ({share:.0%}){note}")
    if holds:
        longest = sorted(holds, key=lambda h: -h[1])[:6]
        r.info("longest holds: " + ", ".join(f"{a:.1f} s ({d:.1f} s)" for a, d in longest))
    if share > 0.15:
        r.warn("more than 15% of the runtime is frozen  [M14]")
    bl = run(["ffmpeg", "-hide_banner", "-i", str(path), "-map", "0:v:0", "-vf", "blackdetect=d=0.05:pix_th=0.05", "-f", "null", "-"]).stderr
    blacks = re.findall(r"black_start:([\d.]+)", bl)
    if blacks:
        r.warn(f"black frames at {blacks[:8]} s  [M15]")
    if v:
        def rate(s):
            num, den = (int(x) for x in s.split("/"))
            return num / den if num and den else 0
        # the average rate: r_frame_rate jumps on uneven timestamps, such as the join of a looped copy (240 for 30)
        fps = rate(v[0].get("avg_frame_rate", "0/0")) or rate(v[0]["r_frame_rate"]) or 30.0
        check_flash(r, path, v[0]["width"], v[0]["height"], fps, field, where)
        if ignore:
            r.info("flashing was measured over the whole video, ignored ranges too: a flash is a risk whatever it is for")
    return r


def rms_db(path: Path, start=None, length=None, from_end=None) -> float:
    cmd = ["ffmpeg", "-hide_banner"]
    if from_end is not None:
        cmd += ["-sseof", f"-{from_end}"]
    elif start is not None:
        cmd += ["-ss", str(start)]
    cmd += ["-i", str(path)]
    if length is not None:
        cmd += ["-t", str(length)]
    out = run(cmd + ["-af", "astats", "-f", "null", "-"]).stderr
    m = re.findall(r"RMS level dB:\s*(-?[\d.]+|-inf)", out)
    return float(m[0]) if m and m[0] != "-inf" else -120.0


def check_audio(paths) -> Report:
    need_ffmpeg()
    r = Report()
    for p in paths:
        head, tail = rms_db(p, start=0, length=0.04), rms_db(p, from_end=0.12)
        gap = rms_db(p, from_end=0.45, length=0.3)
        body = rms_db(p)
        if tail > -35 and gap < -45:
            r.err(f"{p.name}: a {tail:.0f} dB burst in the last 0.12 s after silence; often a container (WAV header or metadata) decoded as raw samples  [M34]")
        elif tail > body + 3:
            r.err(f"{p.name}: the last 0.12 s is louder than the speech ({tail:.0f} vs {body:.0f} dB): a noise burst or a cut-off sound  [M34]")
        if head > -30:
            r.warn(f"{p.name}: the first 40 ms is at {head:.0f} dB; check for a click  [M34]")
    r.info(f"{len(paths)} clip(s) checked")
    return r


def extract_frames(path: Path, every: float, out: Path) -> Report:
    need_ffmpeg()
    r = Report()
    (out / "full").mkdir(parents=True, exist_ok=True)
    (out / "phone").mkdir(parents=True, exist_ok=True)
    sel = f"select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,{every})'"
    run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-vf", sel, "-fps_mode", "vfr", str(out / "full" / "%04d.png")])
    run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-vf", sel + ",scale=390:-2", "-fps_mode", "vfr", str(out / "phone" / "%04d.png")])
    n = len(list((out / "full").glob("*.png")))
    r.info(f"{n} frames in {out}/full, with 390 px copies in {out}/phone. Frame k is at (k-1) x {every} s.")
    return r


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    h = sub.add_parser("html"); h.add_argument("file")
    h.add_argument("--medium", choices=list(MIN), default="web", help="where it is seen: web page, app or watch screen (laid out in points), or video frame")
    v = sub.add_parser("video"); v.add_argument("file")
    v.add_argument("--ignore", action="append", default=[], metavar="START-END", help="seconds to leave out of the freeze measure, such as a deliberate 'before' act; repeatable")
    v.add_argument("--flash-field", default="tablet", metavar="tablet|phone|PX",
                   help="the 10-degree field for the flash measure: a viewing case, or its size in video px (default: tablet, the closest case)")
    v.add_argument("--flash-where", metavar="PNG", help="save the worst flashing moment, with the flashing pixels in magenta")
    au = sub.add_parser("audio"); au.add_argument("files", nargs="+")
    f = sub.add_parser("frames"); f.add_argument("file"); f.add_argument("--every", type=float, default=0.5); f.add_argument("--out", default="preflight-frames")
    a = ap.parse_args()
    if a.cmd == "audio":
        r = check_audio([Path(x) for x in a.files])
        print(f"{r.errors} error(s), {r.warns} warning(s). The checklist covers what this script cannot see: references/checklist.md")
        sys.exit(1 if r.errors else 0)
    p = Path(a.file)
    if not p.exists():
        sys.exit(f"not found: {p}")
    if a.cmd == "html":
        r = check_html(p, a.medium)
    elif a.cmd == "video":
        if a.flash_field not in VIEWS and not re.fullmatch(r"\d+(\.\d+)?", a.flash_field):
            ap.error("--flash-field takes tablet, phone or a size in px")
        r = check_video(p, [tuple(float(x) for x in g.split("-", 1)) for g in a.ignore], a.flash_field, a.flash_where)
    else:
        r = extract_frames(p, a.every, Path(a.out))
    print(f"{r.errors} error(s), {r.warns} warning(s). The checklist covers what this script cannot see: references/checklist.md")
    sys.exit(1 if r.errors else 0)


if __name__ == "__main__":
    main()
