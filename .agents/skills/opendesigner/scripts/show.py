#!/usr/bin/env python3
"""Render an OpenDesigner visual template with a JSON payload and optionally open it.

    python3 show.py palette payload.json [--out opendesigner/preview] [--open]
    python3 show.py palette -            (payload from stdin)
    python3 show.py --list               list templates

Writes <out>/<template>.html with the payload inlined in <script id="od-data">.
Standard library only; no network. The page never sends data anywhere: the person copies
their choice (OD: lines) back into the chat.
"""
import argparse, json, re, sys, webbrowser
from pathlib import Path

TEMPLATES = Path(__file__).resolve().parent.parent / "assets" / "templates"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("template", nargs="?", help="template name, e.g. palette or palette.html")
    ap.add_argument("payload", nargs="?", help="JSON file, or - for stdin")
    ap.add_argument("--out", default="opendesigner/preview")
    ap.add_argument("--open", action="store_true", help="open the page in the default browser")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    names = sorted(p.stem for p in TEMPLATES.glob("*.html"))
    if a.list or not a.template:
        print("\n".join(names))
        return
    name = a.template.removesuffix(".html")
    if name not in names:
        sys.exit(f"unknown template {name!r}; choose one of: {', '.join(names)}")
    html = (TEMPLATES / f"{name}.html").read_text(encoding="utf-8")
    if a.payload:
        raw = sys.stdin.read() if a.payload == "-" else Path(a.payload).read_text(encoding="utf-8")
        data = json.loads(raw)  # fail loudly on bad JSON
        blob = json.dumps(data, indent=1, ensure_ascii=False).replace("</", "<\\/")
        html, n = re.subn(r'(<script type="application/json" id="od-data">).*?(</script>)',
                          lambda m: m.group(1) + "\n" + blob + "\n" + m.group(2), html, count=1, flags=re.S)
        if n != 1:
            sys.exit("template has no od-data block")
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    dest = out / f"{name}.html"
    dest.write_text(html, encoding="utf-8")
    print(dest)
    if a.open:
        webbrowser.open(dest.resolve().as_uri())


if __name__ == "__main__":
    main()
