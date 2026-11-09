#!/usr/bin/env python3
"""The optional OpenDesigner component library: list, suggest, add and check components.

  python3 library.py list [--type data] [--style dense] [--industry finance] [--json]
  python3 library.py suggest --industry finance [--style dense] [--type data]   one recommended pick, with its reason
  python3 library.py add <slug> [--into components/odl] [--tokens opendesigner/build/css/tokens.css]
  python3 library.py check                                                       the rules in assets/library/README.md

Components live in ../assets/library/components/<slug>/ (component.html and meta.json). They use only the --ds-* variables
the engine writes, so in a project with an OpenDesigner system they work with no edits. Standard library only, no network.
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
LIB = HERE.parent / "assets" / "library" / "components"
ENGINE = HERE / "engine.py"
TYPES = ["data", "chart", "form", "feedback", "navigation", "overlay", "ai", "commerce", "content"]
STYLES = ["quiet", "dense", "technical", "friendly", "editorial"]
INDUSTRIES = ["finance", "saas", "devtools", "security", "crm", "logistics", "health", "education", "retail", "productivity",
              "social", "media", "travel", "food", "fitness", "events", "home", "money", "games", "any"]  # money: personal finance (finance is B2B)
WIDTHS = ["narrow", "medium", "wide"]
FIELDS = ["name", "summary", "use", "type", "style", "industries", "tags", "states", "source", "a11y", "width"]
# Every CSS named colour (transparent, currentColor and inherit are fine).
NAMED = r"(?<![-\w])(" + "|".join(sorted("""aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen""".split(), key=len, reverse=True)) + r")(?![-\w])"
SPACING = r"^(padding|margin|gap|row-gap|column-gap|inset)(-[a-z-]+)?$"  # spacing in raw px is not a token
# attributes the OpenDesigner website's own scripts look for across the whole page: a part that used one would be rewritten
# by the site (a review's data-stars once became the GitHub star count). Keep parts off them.
RESERVED_ATTRS = ["stars", "forks", "issues", "pushed", "copy", "copy-text", "tabs", "slides", "au", "gallery", "kit-add", "look", "q", "rm", "thumb", "aisle", "goto-aisle"]
SCRIPT_BANNED = r"scrollIntoView|\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|document\.cookie|document\.(body|documentElement)|\beval\(|new Function|\bimport\(|window\.open|innerHTML|outerHTML|insertAdjacentHTML"
TOKEN_ONLY = ["font-size", "font-family", "font-weight", "border-radius", "box-shadow", "transition-duration", "animation-duration", "font"]


def components():
    out = []
    for d in sorted(p for p in LIB.iterdir() if p.is_dir()) if LIB.exists() else []:
        if not ((d / "meta.json").exists() and (d / "component.html").exists()):
            print(f"{d.name}: skipped, needs both component.html and meta.json", file=sys.stderr)
            continue
        meta = json.loads((d / "meta.json").read_text())
        out.append({"slug": d.name, **meta})
    return out


def matches(c, a):
    return ((not a.type or c["type"] == a.type) and (not a.style or c["style"] == a.style)
            and (not a.industry or a.industry in c["industries"] or "any" in c["industries"]))


def cmd_list(a):
    rows = [c for c in components() if matches(c, a)]
    if a.json:
        print(json.dumps(rows, indent=2))
        return 0
    for c in rows:
        print(f'{c["slug"]:<22} {c["type"]:<10} {c["style"]:<10} {",".join(c["industries"]):<22} {c["summary"]}')
    print(f"{len(rows)} of {len(components())} components")
    return 0


def cmd_suggest(a):
    """One pick for a person who should not have to browse: the best fit by industry, then style, then type."""
    def score(c):
        return ((3 if a.industry and a.industry in c["industries"] else 1 if "any" in c["industries"] else 0)
                + (2 if a.style and c["style"] == a.style else 0) + (2 if a.type and c["type"] == a.type else 0))
    pool = [c for c in components() if not a.type or c["type"] == a.type]  # what they asked for comes first
    ranked = sorted(pool, key=lambda c: -score(c))
    if not ranked or score(ranked[0]) == 0:
        print("No component fits this project well. Don't offer the library now.")
        return 0
    c = ranked[0]
    why = [w for w, ok in ((f"made for {a.industry}", a.industry in c["industries"]), (f"{c['style']} like the rest of the product", a.style == c["style"]),
                           (f"a {c['type']} part", a.type == c["type"])) if ok] or ["fits any product"]
    print(f'{c["slug"]}: {c["name"]}. {c["summary"]} Why: {", ".join(why)}.')
    return 0


def engine_vars():
    """The --ds-* names every system writes: the intersection over three different sketches (dense, regular and large
    audiences), because some roles exist only in some systems (a compact scale has no headline-md)."""
    sketches = [["--audience", "dense", "--platforms", "web", "--feel", "precise,calm", "--brand", "#15803D"],
                ["--audience", "regular", "--platforms", "ios,web", "--feel", "friendly,playful", "--brand", "#E0457B"],
                ["--audience", "large", "--platforms", "web", "--feel", "calm,trustworthy", "--brand", "#1E3A8A"]]
    sets = []
    for sk in sketches:
        with tempfile.TemporaryDirectory() as t:
            d = pathlib.Path(t) / "opendesigner"
            for args in (["sketch", "--name", "Check", *sk], ["build", "--force"]):
                subprocess.run([sys.executable, str(ENGINE), "--dir", str(d), *args], check=True, capture_output=True)
            sets.append(set(re.findall(r"(--ds-[a-z0-9-]+)\s*:", (d / "build/css/tokens.css").read_text())))
    return set.intersection(*sets)


def used_vars(text):
    return set(re.findall(r"var\((--ds-[a-z0-9-]+)", text))


def cmd_add(a):
    src = LIB / a.slug / "component.html"
    if not src.exists():
        print(f"No component '{a.slug}'. Run: library.py list")
        return 1
    into = pathlib.Path(a.into)
    into.mkdir(parents=True, exist_ok=True)
    dest = into / f"{a.slug}.html"
    if dest.exists() and not a.force:
        print(f"{dest} already exists. Add --force to replace it.")
        return 1
    text = src.read_text()
    dest.write_text(text)
    print(f"Copied {a.slug} to {dest}")
    tok = pathlib.Path(a.tokens)
    if tok.exists():
        have = set(re.findall(r"(--ds-[a-z0-9-]+)\s*:", tok.read_text()))
        missing = sorted(used_vars(text) - have)
        print("Every variable it uses is in your tokens." if not missing else
              f"Your tokens lack {len(missing)} variable(s); map each to one of yours or run engine.py build: " + ", ".join(missing))
    else:
        print(f"No {tok}: map its --ds-* variables to your own tokens ({len(used_vars(text))} used).")
    return 0


def reserved_attrs(src):
    return sorted({m.group(1) for m in re.finditer(r"\sdata-([a-z-]+)(?=[\s=>])", src) if m.group(1) in RESERVED_ATTRS})


def check_one(c, known):
    errs, slug = [], c["slug"]
    for f in FIELDS:
        if f not in c:
            errs.append(f"meta.json lacks {f}")
    if c.get("type") not in TYPES:
        errs.append(f"type {c.get('type')!r} is not one of {TYPES}")
    if c.get("style") not in STYLES:
        errs.append(f"style {c.get('style')!r} is not one of {STYLES}")
    if c.get("width") not in WIDTHS:
        errs.append(f"width {c.get('width')!r} is not one of {WIDTHS}")
    for i in c.get("industries", []):
        if i not in INDUSTRIES:
            errs.append(f"industry {i!r} is not one of {INDUSTRIES}")
    if not 3 <= len(c.get("tags", [])) <= 6:
        errs.append("give 3 to 6 tags")
    if c.get("source") and not (LIB.parents[4] / c["source"]).exists() and (LIB.parents[4] / "brand").exists():
        errs.append(f"source {c['source']} does not exist")
    html_ = (LIB / slug / "component.html").read_text()
    styles = re.findall(r"<style>(.*?)</style>", html_, re.S)
    if len(styles) != 1:
        errs.append("needs exactly one <style> block")
    css = "".join(styles)
    rest = re.sub(r"<style>.*?</style>|<script>.*?</script>", "", html_, flags=re.S)
    scripts = re.findall(r"<script>(.*?)</script>", html_, re.S)
    if len(scripts) > 1:
        errs.append("at most one <script>")
    if re.search(r"<(link|iframe)\b|<script\s+src|@import|url\(", html_):
        errs.append("loads something external (link, iframe, script src, @import or url())")
    # photos: only free Unsplash photos, hotlinked from images.unsplash.com in an <img> with alt, size and lazy loading, each
    # credited in meta.json "photos" (CRAFT.md section 5; owner, 2026-10-23: "wherever there is an image placeholder, use
    # sample images from Unsplash")
    credited = {ph.get("img") for ph in c.get("photos", []) if isinstance(ph, dict)}
    for tag in re.findall(r"<img\b[^>]*>", html_):
        src = (re.search(r'\ssrc="([^"]*)"', tag) or [None, ""])[1]
        m = re.match(r"https://images\.unsplash\.com/(photo-[A-Za-z0-9-]+)\?", src)
        if not m:
            errs.append(f"<img> may only load a free Unsplash photo from images.unsplash.com (got {src[:60]!r})")
            continue
        for a in ("alt", "width", "height"):
            if not re.search(rf'\s{a}="', tag):
                errs.append(f"<img> {m.group(1)} needs {a}")
        if 'loading="lazy"' not in tag:
            errs.append(f'<img> {m.group(1)} needs loading="lazy"')
        if m.group(1) not in credited:
            errs.append(f'photo {m.group(1)} is not listed in meta.json "photos" with its author')
    for a in reserved_attrs(html_):
        errs.append(f"uses data-{a}, which the website's own scripts read across the page: rename it (data-{a}-value, or a word of your own)")
    body = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    decls, stack, start = [], [], 0
    for m in re.finditer(r"[{}]", body):
        if m.group(0) == "{":
            prelude = body[start:m.start()].strip().split(";")[-1].strip()
            if prelude.startswith("@"):
                stack.append("keyframes" if prelude.startswith("@keyframes") else "group")
            else:
                stack.append("rule")
                if "keyframes" not in stack[:-1]:
                    for part in prelude.split(","):
                        p = part.strip()
                        if p and not p.startswith(f".odl-{slug}"):
                            errs.append(f"selector not scoped to .odl-{slug}: {p}")
        else:
            if stack and stack[-1] == "rule":
                decls += re.findall(r"([a-z-]+)\s*:\s*([^;]+)", body[start:m.start()])
            if stack:
                stack.pop()
        start = m.end()
    for where, text in (("CSS", body), ("markup", " ".join(re.findall(r'(?:style|fill|stroke|color)="([^"]*)"', rest)))):
        for m in re.finditer(r"#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(", text):
            errs.append(f"colour literal in {where}: {m.group(0)}")
        for m in re.finditer(NAMED, re.sub(r"--[a-z0-9-]+|@keyframes\s+[\w-]+|animation(-name)?\s*:[^;]+", "", text)):
            errs.append(f"named colour in {where}: {m.group(0)}")
    moves = False
    for prop, val in decls:
        v = val.strip()
        if prop in ("transition", "animation") and v != "none" or prop.startswith(("transition-", "animation-")):
            moves = True
        if prop in TOKEN_ONLY and v not in ("inherit", "0", "none", "normal") and "var(--ds-" not in v:
            errs.append(f"{prop} is not a token: {v}")
        if prop in ("transition", "animation") and re.search(r"(?<![\w-])\d*\.?\d+m?s\b", re.sub(r"var\([^)]*\)", "", v)):
            errs.append(f"{prop} has a raw duration: {v}")
        if re.match(SPACING, prop) and re.search(r"(?<![\w-])\d*\.?\d+(px|rem|em)\b", re.sub(r"var\([^)]*\)", "", v)):
            errs.append(f"{prop} has a raw length (use a space token): {v}")
    # a text highlight is a plain fill: no underline stroke along its bottom edge (owner, 2026-10-21: it curves at the line
    # ends). Any bottom inset shadow or bottom border on an inline or highlighted element is caught; a field's straight focus
    # line (a search box) is fine.
    for sel, decl in re.findall(r"(?:^|(?<=[{};]))\s*([^{}@;]+?)\s*\{([^{}]*)\}", body):
        if re.search(r"search|input|field|:has\(", sel):
            continue
        if re.search(r"box-shadow:\s*inset 0 (calc\(-|-)", decl) or (re.search(r"border-(bottom|block-end)(-[a-z]+)?\s*:", decl) and re.search(r"(mark|target|highlight|\bhl\b|ins|del)\b", sel)):
            errs.append(f"underline stroke on {sel.strip()[:60]}: a highlight or text gets a plain fill, never a bottom stroke")
    # nor a hard ledge under a box (a shadow pushed down with no blur, the "3D button" lip): the owner reads it as the same
    # curved bottom stroke (2026-10-22, quiz answers and a lesson path)
    for sel, decl in re.findall(r"(?:^|(?<=[{};]))\s*([^{}@;]+?)\s*\{([^{}]*)\}", body):
        if re.search(r"box-shadow:[^;]*?(?<![\w-])0 (var\(--ds-space-[^)]+\)|calc\([^)]*\)|[1-9][\d.]*px) 0 (var\(--ds-color|var\(--[a-z]|#|rgb)", decl):
            errs.append(f"hard bottom ledge on {sel.strip()[:60]}: a shadow pushed down with no blur reads as a bottom stroke; use a fill or a soft elevation token")
    # a list row is sized by the row or control tokens; the touch-target floor is a minimum, not a size (a sidebar with 24 px
    # rows read as cramped: Michael Filipiuk's sidebar clean-up, 2026-10-23)
    for sel, decl in re.findall(r"(?:^|(?<=[{};]))\s*([^{}@;]+?)\s*\{([^{}]*)\}", body):
        if re.search(r"\.odl-(item|row|opt|option|entry)\b|\[role=\"?(menuitem|option)|\bli\b", sel) and re.search(r"(?<![\w-])min-block-size:\s*var\(--ds-size-target-min\)", decl):
            errs.append(f"row {sel.strip()[:60]} is sized by the target floor: use max(var(--ds-size-control-md), var(--ds-size-target-min)) or a --ds-size-row-* token")
    if moves and "prefers-reduced-motion" not in body:
        errs.append("it animates: add a @media (prefers-reduced-motion: reduce) block that turns its motion off")
    if not re.search(r":focus-visible", body) and re.search(r"<(button|input|a|select|textarea|summary)\b", rest):
        errs.append("interactive parts need a :focus-visible style")
    for js in scripts:
        for m in re.finditer(SCRIPT_BANNED, js):
            errs.append(f"script uses {m.group(0)}: a component script only wires its own root")
        # the website shows each part several times (cards, previews) with ids and aria references stripped; a script that
        # finds elements by id breaks there (trip-search and itinerary threw on load, 2026-10-23)
        if re.search(r"getElementById|querySelector(All)?\(\s*[\"'`]#|[\"'`]#[\"'`]\s*\+|\[aria-(labelledby|controls|describedby)=", js):
            errs.append("script finds elements by id or aria reference: copies of the part have no ids; find them by class, data attribute or order")
        if f'querySelectorAll(".odl-{slug}")' not in js:
            errs.append(f'script must start from document.querySelectorAll(".odl-{slug}")')
    for v in sorted(used_vars(html_) - known):
        errs.append(f"{v} is not a variable every engine system writes")
    if f'class="odl-{slug}' not in rest:
        errs.append(f"the root element needs class odl-{slug}")
    return errs


def cmd_check(_a):
    known = engine_vars()
    cs, bad = components(), 0
    for c in cs:
        errs = check_one(c, known)
        bad += bool(errs)
        print(f"{c['slug']}: " + ("ok" if not errs else "\n  " + "\n  ".join(errs)))
    print(f"{len(cs)} components, {bad} with problems")
    return 1 if bad or not cs else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("list", "suggest"):
        p = sub.add_parser(name)
        p.add_argument("--type", choices=TYPES)
        p.add_argument("--style", choices=STYLES)
        p.add_argument("--industry", choices=INDUSTRIES)
        if name == "list":
            p.add_argument("--json", action="store_true")
    p = sub.add_parser("add")
    p.add_argument("slug")
    p.add_argument("--into", default="components/odl")
    p.add_argument("--tokens", default="opendesigner/build/css/tokens.css")
    p.add_argument("--force", action="store_true", help="replace a file that is already there")
    sub.add_parser("check")
    a = ap.parse_args()
    return {"list": cmd_list, "suggest": cmd_suggest, "add": cmd_add, "check": cmd_check}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
