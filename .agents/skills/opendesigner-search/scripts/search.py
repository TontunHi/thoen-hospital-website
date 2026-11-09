#!/usr/bin/env python3
"""OpenDesigner search: the technical checks for search engines and answer engines, read-only.

  search.py audit <build-folder> [--base https://example.com] [--json]   a production build (dist/, out/, public/, _site/)
  search.py robots <robots.txt>                                          which search, user and training bots may fetch the site
  search.py audit --live https://example.com                             off until the owner approves live fetching (see below)

It reads the files a production build serves, the way a crawler would, and reports each finding with its evidence. It
never edits anything (checks report; fixes wait for the person's yes). Standard library only, no network: the
answer-engine probe and anything judged (copy, page fixes, listings) are the agent's job, in references/.

Exit code 1 when an error is found.
"""
import argparse
import html
import json
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

# Bots that put pages in a search or answer engine; blocking one keeps the site out of that engine (each platform's docs).
SEARCH_BOTS = {"Googlebot": "Google Search, AI Overviews and AI Mode", "Bingbot": "Bing and Copilot",
               "OAI-SearchBot": "ChatGPT search", "PerplexityBot": "Perplexity", "Claude-SearchBot": "Claude's search",
               "Applebot": "Apple's Siri and Spotlight suggestions"}
# Fetchers that act for one person's request; OpenAI and Perplexity say robots.txt may not apply to them.
USER_BOTS = ("ChatGPT-User", "Perplexity-User", "Claude-User")
# Crawlers for model training; allowing or blocking them is the owner's choice, never a search error.
TRAINING_BOTS = ("GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "CCBot")
TITLE = (15, 60)        # characters; practice, not a platform rule: longer titles are cut in results
DESCRIPTION = (50, 160)
THIN_TEXT = 150         # visible characters in the served HTML below which the words may only arrive with JavaScript
SEV = {"error": 0, "warn": 1, "info": 2}
LIVE_APPROVED = False   # live fetching waits for the owner's yes (design note 2026-11-07); until then it refuses


class Page(HTMLParser):
    """What a crawler reads from one served HTML file: head tags, headings, links, images, JSON-LD and visible text."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title, self.lang, self.description, self.robots = None, None, None, ""
        self.canonicals, self.h1, self.links, self.images, self.jsonld = [], [], [], [], []
        self.text, self._in, self._buf = [], [], []

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        if tag == "html":
            self.lang = a.get("lang")
        elif tag == "meta" and a.get("name", "").lower() == "description":
            self.description = a.get("content", "")
        elif tag == "meta" and a.get("name", "").lower() in ("robots", "googlebot"):
            self.robots += " " + a.get("content", "").lower()
        elif tag == "link" and "canonical" in a.get("rel", "").lower().split():
            self.canonicals.append(a.get("href", ""))
        elif tag == "a" and a.get("href"):
            self.links.append(a["href"])
        elif tag == "img":
            self.images.append(a)
        if tag in ("title", "h1", "script", "style", "noscript", "template") or (tag == "script" and "ld+json" in a.get("type", "")):
            self._in.append((tag, a.get("type", "")))
            self._buf.append([])

    def handle_endtag(self, tag):
        if self._in and self._in[-1][0] == tag:
            (t, typ), buf = self._in.pop(), "".join(self._buf.pop())
            if t == "title" and self.title is None:
                self.title = re.sub(r"\s+", " ", buf).strip()
            elif t == "h1":
                self.h1.append(re.sub(r"\s+", " ", buf).strip())
            elif t == "script" and "ld+json" in typ:
                self.jsonld.append(buf)
            if t in ("title", "h1") and self._in:
                self._buf[-1].append(buf)

    def handle_data(self, data):
        if self._in:
            self._buf[-1].append(data)
            if self._in[-1][0] in ("script", "style", "noscript", "template", "title"):
                return
        self.text.append(data)

    def visible(self):
        return re.sub(r"\s+", " ", " ".join(self.text)).strip()


def parse_robots(text):
    """{user-agent (lower case): [(allow|disallow, path)]} and the Sitemap lines."""
    groups, agents, sitemaps, last = {}, [], [], None
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        key, val = (x.strip() for x in line.split(":", 1))
        key = key.lower()
        if key == "user-agent":
            if last != "user-agent":
                agents = []
            agents.append(val.lower())
            groups.setdefault(val.lower(), [])
        elif key in ("allow", "disallow"):
            for ag in agents:
                groups[ag].append((key, val))
        elif key == "sitemap":
            sitemaps.append(val)
        last = key
    return groups, sitemaps


def blocked_everywhere(groups, bot):
    """True when the group that applies to this bot (its own, else '*') disallows the whole site and allows nothing back."""
    rules = groups.get(bot.lower(), groups.get("*", []))
    return any(k == "disallow" and v == "/" for k, v in rules) and not any(k == "allow" and v in ("/", "/*") for k, v in rules)


def disallowed(groups, bot, path):
    """True when robots.txt keeps this bot (its own group, else '*') from fetching the path: the longest matching rule
    wins, and Allow wins a tie (Google's documented matching; * and $ supported)."""
    rules = groups.get(bot.lower(), groups.get("*", []))
    best = None
    for kind, val in rules:
        if not val:
            continue
        rx = "^" + re.escape(val).replace(r"\*", ".*").replace(r"\$", "$")
        if re.match(rx, path):
            key = (len(val), kind == "allow")
            if best is None or key > best[0]:
                best = (key, kind)
    return bool(best and best[1] == "disallow")


def robots_findings(text, add):
    groups, sitemaps = parse_robots(text)
    for bot, where in SEARCH_BOTS.items():
        if blocked_everywhere(groups, bot):
            add("SE-01", "error", f"robots.txt blocks {bot}", f"the whole site is disallowed for {bot}, so pages stay out of {where}",
                "robots.txt", "allow it, unless the owner chose to stay out of that engine")
    for bot in USER_BOTS:
        if blocked_everywhere(groups, bot):
            add("SE-01", "info", f"robots.txt blocks {bot}", f"{bot} fetches a page when a person asks; its platform says robots.txt may not apply",
                "robots.txt", "")
    blocked = [b for b in TRAINING_BOTS if blocked_everywhere(groups, b)]
    if blocked:
        add("SE-01", "info", "Training crawlers blocked", ", ".join(blocked) + ": the owner's choice; it does not remove the site from search",
            "robots.txt", "")
    if not sitemaps:
        add("SE-02", "warn", "robots.txt names no sitemap", "no Sitemap: line", "robots.txt", "add Sitemap: <full URL of sitemap.xml>")
    return groups


def url_path(rel):
    rel = rel.replace(os.sep, "/")
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel


def norm(href, here, base):
    """A same-site link or canonical as a path ('/docs/'), else None."""
    href = html.unescape(href).split("#", 1)[0].split("?", 1)[0]
    if not href or href.startswith(("mailto:", "tel:", "javascript:", "data:")):
        return None
    if re.match(r"^https?://", href):
        if not base or not href.startswith(base.rstrip("/")):
            return None
        href = href[len(base.rstrip("/")):] or "/"
    if not href.startswith("/"):
        href = os.path.normpath(os.path.join(os.path.dirname(here), href)).replace(os.sep, "/")
        if not href.startswith("/"):
            href = "/" + href
    return href


def aliases(path):
    """The forms one page is linked by: /a/, /a, /a/index.html; /b.html and /b."""
    out = {path}
    if path.endswith("/"):
        out |= {path.rstrip("/") or "/", path + "index.html"}
    elif path.endswith(".html"):
        out.add(path[:-5])
    return out


def squash(text):
    """Letters and digits only: inline tags split words with spaces (<abbr>AI</abbr>-made), so compare without them."""
    return re.sub(r"[\W_]+", "", text.lower())


def jsonld_findings(page, rel, add):
    shown = squash(page.visible())
    for raw in page.jsonld:
        try:
            data = json.loads(raw)
        except ValueError as ex:
            add("SE-09", "error", "Structured data does not parse", str(ex)[:80], rel, "fix the JSON, or remove the script")
            continue
        items = data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []
        for it in items:
            kind = it.get("@type") if isinstance(it, dict) else None
            kinds = kind if isinstance(kind, list) else [kind]
            if "FAQPage" in kinds:
                qs = [q.get("name", "") for q in it.get("mainEntity", []) if isinstance(q, dict)]
                hidden = [q for q in qs if q and squash(q) not in shown]
                if hidden:
                    add("SE-09", "warn", "FAQ markup the page does not show", f"{len(hidden)} of {len(qs)} questions: {hidden[0][:60]}",
                        rel, "markup must match the visible page (Google's structured data policies)")
                else:
                    add("SE-09", "info", "FAQPage: no Google rich result", "Google stopped showing FAQ results in 2026; answer engines "
                        "may still read the markup. Keep it.", rel, "")
            if "HowTo" in kinds:
                add("SE-09", "info", "HowTo: no Google rich result", "Google stopped showing How-to results in 2023; keep the markup "
                    "while it matches the page.", rel, "")


def audit(folder, base=None):
    root = Path(folder)
    found = []

    def add(code, sev, title, evidence, where, fix):
        found.append({"code": code, "severity": sev, "title": title, "evidence": evidence, "where": where, "fix": fix})
    robots = root / "robots.txt"
    groups = {}
    if robots.exists():
        groups = robots_findings(robots.read_text(encoding="utf-8", errors="replace"), add)
    else:
        add("SE-01", "warn", "No robots.txt", "robots.txt is missing from the build", "robots.txt",
            "add one that allows the search bots and names the sitemap")
    sitemap = set()
    sm = root / "sitemap.xml"
    if sm.exists():
        for loc in re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", sm.read_text(encoding="utf-8", errors="replace")):
            p = norm(loc, "/", base or (re.match(r"^https?://[^/]+", loc).group(0) if re.match(r"^https?://", loc) else None))
            if p:
                sitemap |= aliases(p)
    else:
        add("SE-02", "warn", "No sitemap.xml", "sitemap.xml is missing from the build", "sitemap.xml", "list every public page in it")
    llms = root / "llms.txt"
    if llms.exists():
        if not llms.read_text(encoding="utf-8", errors="replace").lstrip().startswith("# "):
            add("SE-10", "warn", "llms.txt has no H1", "the proposal's one required part is an H1 with the site's name", "llms.txt",
                "start it with '# <name>'")
    else:
        add("SE-10", "info", "No llms.txt", "a proposal, not a standard; Google says it is not needed for Search", "llms.txt", "")

    pages, fragments = {}, 0
    for f in sorted(root.rglob("*.html")):
        rel = f.relative_to(root).as_posix()
        if rel.split("/")[0] in ("node_modules",) or rel in ("404.html", "500.html"):
            continue
        text = f.read_text(encoding="utf-8", errors="replace")
        if not re.search(r"<html[\s>]", text[:5000], re.I):  # a fragment another page loads, not a page a crawler lands on
            fragments += 1
            continue
        pg = Page()
        pg.feed(text)
        pages[url_path(rel)] = (rel, pg)
    if fragments:
        add("SE-00", "info", f"{fragments} HTML fragments skipped", "files with no <html> element are parts other pages load, not pages",
            "", "")
    titles, descs, canon_owner, inbound = {}, {}, {}, {p: 0 for p in pages}
    for path, (rel, pg) in pages.items():
        noindex = "noindex" in pg.robots
        if noindex and disallowed(groups, "Googlebot", path):
            add("SE-04", "warn", "noindex behind a robots.txt Disallow", "robots.txt stops crawlers fetching this page, so they never "
                "see its noindex; if it was ever indexed, it can stay in results", rel,
                "allow the crawl so the noindex is read; use Disallow only for pages that were never indexed")
        if not pg.lang:
            add("SE-13", "warn", "No page language", "<html> has no lang", rel, "add lang, for example lang=\"en\"")
        if len(pg.canonicals) > 1:
            add("SE-03", "error", "More than one canonical", ", ".join(pg.canonicals[:3]), rel, "keep one, pointing at this page")
        elif not pg.canonicals and not noindex:
            add("SE-03", "warn", "No canonical", "no <link rel=canonical>", rel, "add one that points at this page's own URL")
        elif pg.canonicals:
            target = norm(pg.canonicals[0], path, base)
            if noindex and target and target not in aliases(path):
                add("SE-03", "error", "noindex with a canonical to another page", pg.canonicals[0], rel, "pick one signal")
            if target:
                canon_owner.setdefault(target, []).append(rel)
        if noindex and path in sitemap:
            add("SE-04", "error", "noindex page listed in the sitemap", "meta robots says noindex", rel, "drop it from the sitemap, or index it")
        if sitemap and not noindex and not (aliases(path) & sitemap):
            add("SE-02", "warn", "Page missing from the sitemap", path, rel, "add it to sitemap.xml")
        t = pg.title or ""
        if not t:
            add("SE-05", "error", "No title", "no <title>", rel, "a title of about 50 to 60 characters, in the words people search")
        elif not TITLE[0] <= len(t) <= TITLE[1]:
            add("SE-05", "warn", f"Title is {len(t)} characters", t[:80], rel, f"about {TITLE[0]} to {TITLE[1]} (practice: longer is cut)")
        if t and not noindex:
            titles.setdefault(t, []).append(rel)
        d = (pg.description or "").strip()
        if not d and not noindex:
            add("SE-06", "warn", "No meta description", "no <meta name=description>", rel, "one or two sentences that answer the page's question")
        elif d and not DESCRIPTION[0] <= len(d) <= DESCRIPTION[1]:
            add("SE-06", "info", f"Description is {len(d)} characters", d[:80], rel, f"about {DESCRIPTION[0]} to {DESCRIPTION[1]}")
        if d and not noindex:
            descs.setdefault(d, []).append(rel)
        if not pg.h1:
            add("SE-07", "error", "No h1", "the page has no <h1>", rel, "one h1 that says what the page is, in the searcher's words")
        elif len(pg.h1) > 1:
            add("SE-07", "warn", f"{len(pg.h1)} h1 headings", " | ".join(h[:40] for h in pg.h1[:3]), rel, "one h1; the rest h2")
        if len(pg.visible()) < THIN_TEXT:
            add("SE-08", "warn", "Little text in the served HTML", f"{len(pg.visible())} visible characters before JavaScript runs", rel,
                "serve the words in the HTML (server or static rendering); check the live page with JavaScript off")
        for im in pg.images:
            if "alt" not in im:
                add("SE-12", "warn", "Image with no alt", im.get("src", "")[:60], rel, "describe it, or alt=\"\" if it is decoration")
            if not (im.get("width") and im.get("height")):
                add("SE-12", "info", "Image with no size", im.get("src", "")[:60], rel, "width and height stop the page jumping (CLS)")
        for href in pg.links:
            t_ = norm(href, path, base)
            if t_:
                for p2 in pages:
                    if p2 != path and t_ in aliases(p2):
                        inbound[p2] += 1
        jsonld_findings(pg, rel, add)
    for text, rels in titles.items():
        if len(rels) > 1:
            add("SE-05", "warn", f"{len(rels)} pages share one title", text[:60], ", ".join(rels[:3]), "give each page its own title")
    for text, rels in descs.items():
        if len(rels) > 1:
            add("SE-06", "warn", f"{len(rels)} pages share one description", text[:60], ", ".join(rels[:3]), "write one per page")
    for target, rels in canon_owner.items():
        if len(rels) > 1 and not any(target in aliases(url_path(r)) for r in rels[:1]):
            add("SE-03", "info", f"{len(rels)} pages point their canonical at {target}", ", ".join(rels[:3]), "",
                "fine for true duplicates; otherwise each page names itself")
    for path, n in inbound.items():
        if n == 0 and path != "/" and "noindex" not in pages[path][1].robots:
            add("SE-11", "warn", "No page links here", path, pages[path][0], "link it from a related page or the footer")
    found.sort(key=lambda f: (SEV[f["severity"]], f["code"], f["where"]))
    return {"folder": str(root), "pages": len(pages), "findings": found}


def report(result, as_json=False):
    if as_json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return
    n = {s: sum(1 for f in result["findings"] if f["severity"] == s) for s in SEV}
    print(f"Read {result['pages']} pages in {result['folder']}: {n['error']} errors, {n['warn']} warnings, {n['info']} notes.")
    for f in result["findings"]:
        print(f"{f['severity'].upper():5}  {f['code']}  {f['title']}  [{f['where']}]")
        print(f"       {f['evidence']}" + (f"\n       fix: {f['fix']}" if f["fix"] else ""))
    print("These are rule checks. The answer-engine probe and every fix are judgment: references/probe.md and references/fixes.md.")


def fetch_https(url, limit=2_000_000):
    """The one network call, for --live: an HTTPS GET to the person's own site. Not used until LIVE_APPROVED."""
    import urllib.request
    if not url.startswith("https://"):
        raise ValueError("only https:// URLs")
    req = urllib.request.Request(url, headers={"User-Agent": "OpenDesigner-search (+https://opendesigner.dev)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read(limit).decode("utf-8", errors="replace")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("audit", help="check a production build folder")
    p.add_argument("folder", nargs="?")
    p.add_argument("--base", help="the site's address, so absolute links and canonicals count as the same site")
    p.add_argument("--live", help="the deployed site (off until the owner approves live fetching)")
    p.add_argument("--json", action="store_true")
    r = sub.add_parser("robots", help="which bots a robots.txt lets in")
    r.add_argument("file")
    a = ap.parse_args(argv)
    if a.cmd == "robots":
        found = []
        groups = robots_findings(Path(a.file).read_text(encoding="utf-8", errors="replace"),
                                 lambda *x: found.append(dict(zip(("code", "severity", "title", "evidence", "where", "fix"), x))))
        for bot in list(SEARCH_BOTS) + list(USER_BOTS) + list(TRAINING_BOTS):
            print(f"{bot:18} {'blocked' if blocked_everywhere(groups, bot) else 'allowed'}")
        for f in found:
            print(f"{f['severity'].upper():5}  {f['title']}: {f['evidence']}")
        return 1 if any(f["severity"] == "error" for f in found) else 0
    if a.live:
        if not LIVE_APPROVED:
            print("Live fetching is off: it waits for the owner's approval (design note 2026-11-07). Run the audit on a local "
                  "production build instead (search.py audit dist/), and check the deployed site in a browser, logged out.")
            return 2
        raise SystemExit("--live is approved but not wired yet")
    if not a.folder or not os.path.isdir(a.folder):
        raise SystemExit("give a build folder: search.py audit dist/  (the files the server sends, not the source)")
    res = audit(a.folder, a.base)
    report(res, a.json)
    return 1 if any(f["severity"] == "error" for f in res["findings"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
