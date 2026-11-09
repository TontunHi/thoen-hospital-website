#!/usr/bin/env python3
"""User research: who the product's users are, what they already use and expect, and what that means for the system.

The agent does the searching (web search, a browser, /last30days, Mobbin, the product's own analytics). This module plans
it, checks what came back, and turns the findings into recommended answers to questions the engine already asks. It never
fetches anything and never changes a value without the person's yes. Standard library only, no network.

    engine.py research plan [--brief "..."] [--tools web-search,browser,...] [--json]
    engine.py research check <findings.json> [--json]
    engine.py research add <findings.json> [--accept [--only Q-aud-01,...]] [--json]
    engine.py research skip --why "..."
    engine.py research status [--json]

Then, run as its own script (research before any colour or direction; references/research.md sections 6 to 9):

    research.py market [--json]                       the competitor table, what the category does, the industry benchmark
    research.py positioning draft | show | confirm [--for ".."] [--problem ".."] [--claim ".."] --proof ".." [--proof ".."]
    research.py directions check | board [file] [--open] | pick <id> [--remix <axis>=<id>] [--why ".."]

Files (in the state folder): research/plan.json, research/users.json (the findings, canonical) and research/users.md (the
same findings for people, rendered); research/positioning.json, research/directions.json and research/directions.html (the
board); research/photos/ (licensed stock photos, with ledger.json, from opendesigner-illustrate's `photos` commands). state.json keeps a short summary under "research". Values it sets carry
set_by "research" and source_ref "research/users.json". The method: references/research.md.
"""
from __future__ import annotations

import copy
import datetime as _dt
import json
import math
import os
import re
from collections import Counter

FILE = "research/users.json"
PLAN = "research/plan.json"
DOC = "research/users.md"
STALE_DAYS = 180  # findings about people change; review asks for a refresh after about six months [inferred]

# The seven things the research answers (references/research.md section 3). Each topic gets at least one search.
TOPICS = {
    "who": "Who they are: age range, region, languages, reading level, devices and network",
    "context": "Where and how they use it: how often, how long, one hand or two, light, noise, interruptions",
    "apps": "The apps they already use every day, and the patterns those apps have taught them",
    "expectations": "What they expect and what frustrates them: reviews, forums, complaints, published studies",
    "preferences": "Preferences that touch design: text size, dark mode, density, colour meanings in their culture",
    "accessibility": "Access needs common in the group: vision, motor, hearing, cognitive, situational",
    "market": "The market: the analogous product, what people would use instead, what those products all do, and the gap",
}
QUERY_TEMPLATES = {  # starting points; the agent rewrites them in the users' own words and adds the industry's terms
    "who": ["{users} demographics survey", "{users} devices smartphone usage statistics"],
    "context": ["{users} day in the life workflow", "how {users} use {product} at work OR at home"],
    "apps": ["apps {users} use every day", "most popular apps among {users}"],
    "expectations": ["{product} app reviews complaints", "{users} frustrations with software forum"],
    "preferences": ["{users} preferences font size dark mode", "{users} design preferences study"],
    "accessibility": ["{users} accessibility needs", "{users} vision OR dexterity OR literacy statistics"],
    "market": ["{product} alternatives", "apps like {product} for {users}"],
}
MARKET_LISTS = ("competitors", "benchmark")         # market entries with a name, a why and sources, like apps
MARKET_ONE = ("analogous",)                          # one such entry
MARKET_TEXT = ("pattern", "gap")                     # a sentence, or {text, sources}
MARKET_WORDS = ("conventions",)                      # short lines: the words and habits the industry's users know
# The competitor table the person sees before any colour or direction (research.md section 6). Values are measured on the
# competitor's own page (read_page.js, its CSS, a screenshot or Mobbin), never guessed.
GROUNDS = ("light", "dark", "tinted")                # tinted: a coloured or mid-tone ground
CTA_SHAPES = ("square", "subtle", "rounded", "pill")
TYPE_CLASSES = ("grotesk", "geometric", "humanist", "serif", "slab", "mono", "display")
COLOR_ROLES = ("ground", "ink", "accent", "cta", "surface", "band")
MEASURED = ("browser", "css", "screenshot", "mobbin", "figma")
TABLE_MIN = 3                                        # competitors with a link, colours, type and a CTA shape before colour
CONFIDENCE = ("measured", "reported", "inferred")  # measured: a study or statistic; reported: people say so; inferred: reasoning
SOURCE_KINDS = ("study", "survey", "official-stats", "app-store-reviews", "forum", "community", "article", "analytics", "interview",
                "person", "mobbin")
PERSON_SOURCE = re.compile(r"^(person|interview|analytics)\s*,\s*\d{4}-\d\d-\d\d$", re.I)

# Tools the agent looks for before it starts. The engine cannot see the agent's tools: the agent says which it has (--tools),
# and the plan names every missing one with what it would add, once.
TOOLS = [
    {"id": "web-search", "name": "Web search", "look_for": "a search tool (WebSearch, web_search, a search MCP)",
     "adds": "statistics, studies and articles about the group; the base of the research"},
    {"id": "browser", "name": "A browser", "look_for": "WebFetch, an in-app browser, Chrome, Playwright",
     "adds": "opens the pages a search finds, and app-store reviews, so a finding cites the page itself, not a snippet"},
    {"id": "last30days", "name": "The /last30days skill", "look_for": "a skill named last30days",
     "adds": "what these users said in the last 30 days on Reddit, X, YouTube and Hacker News: live habits and complaints",
     "get": "https://github.com/mvanhorn/last30days-skill"},
    {"id": "mobbin", "name": "Mobbin", "look_for": "tools named like search_screens, search_flows",
     "adds": "the real screens of the apps these users already use, to see the patterns they know"},
    {"id": "deep-research", "name": "A deep research tool", "look_for": "a deep-research skill or agent",
     "adds": "a long report across many sources, for a group little is written about"},
    {"id": "analytics", "name": "The product's own analytics", "look_for": "PostHog, Google Analytics, Amplitude or Mixpanel tools or exports",
     "adds": "how existing users really behave (devices, screen sizes, dark mode share); beats desk research when the product is live"},
]
TOOL_IDS = [t["id"] for t in TOOLS]
NEEDS_ONE_OF = ("web-search", "browser", "last30days", "deep-research")  # without one of these there is nothing to read

# Signals: what a finding says about the users, in a closed list, so every recommendation traces to a question the engine
# already asks. effects: question -> option value (a list adds to a multi-select). notes go to PRODUCT.md and the later stages.
SIGNALS = {
    "older-users": {"plain": "many users are older (about 60 and up)",
                    "effects": {"Q-aud-01": "large", "Q-aud-04": ["text-size", "situational"]}},
    "low-vision": {"plain": "low vision is common in the group",
                   "effects": {"Q-aud-03": "wcag22-aa-plus", "Q-aud-04": ["text-size", "contrast"]}},
    "all-day-work": {"plain": "they use it all day for work, on a desktop",
                     "effects": {"Q-aud-01": "dense", "Q-aud-02": "work"}},
    "everyday-use": {"plain": "they use it often, in everyday life", "effects": {"Q-aud-01": "regular"}},
    "occasional-mobile": {"plain": "they use it now and then, mostly on a phone or in public",
                          "effects": {"Q-aud-01": "large"}},
    "high-stakes": {"plain": "money, health or legal standing is at stake", "effects": {"Q-aud-02": "high-trust"}},
    "everyday-consumer": {"plain": "an everyday consumer product", "effects": {"Q-aud-02": "consumer"}},
    "playful": {"plain": "they come for fun, games or learning", "effects": {"Q-aud-02": "play"}},
    "tough-conditions": {"plain": "they use it in tough conditions: one hand, bright light, on the move",
                         "effects": {"Q-aud-04": ["situational"]}},
    "motion-sensitive": {"plain": "motion sickness or distraction is a known issue", "effects": {"Q-aud-04": ["reduced-motion"]}},
    "mixed-expertise": {"plain": "experts and occasional users share the product", "effects": {"Q-aud-04": ["density"]}},
    "low-end-devices": {"plain": "many use low-cost phones", "effects": {},
                        "note": "Keep imagery light and motion short (stages 16 and 18); test on a low-cost phone."},
    "slow-network": {"plain": "networks are often slow or expensive", "effects": {},
                     "note": "Prefer system fonts or one small font file, and show content before images (stages 10 and 18)."},
    "non-latin-script": {"plain": "they read a script other than Latin", "effects": {},
                         "note": "Pick a typeface that covers their script, and leave room for longer text (stages 10 and 19)."},
    "second-language": {"plain": "many read the product in a second language, or read with difficulty", "effects": {},
                        "note": "Plain words, short sentences, and icons with text labels (stages 17 and 19)."},
    "dark-environments": {"plain": "they often use it in the dark", "effects": {},
                          "note": "Offer a dark theme from the start (stage 07)."},
    "familiar-patterns": {"plain": "the apps they use daily have taught them strong patterns", "effects": {},
                          "note": "Follow the patterns of the apps they live in before inventing new ones (practices.md sections 2 and 3)."},
}
SINGLE = {"Q-aud-01", "Q-aud-02", "Q-aud-03"}
PERSON_OWN = ("chosen", "confirmed_default", "reference", "asset", "research")  # a value someone said yes to; research never overwrites it
RX_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
RX_PHONE = re.compile(r"(?<!\d)(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){9,12}\d(?!\d)")
RX_HANDLE = re.compile(r"(?<![\w/])@[A-Za-z0-9_]{3,}")


def _today():
    return _dt.date.today().isoformat()


def _read(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def _write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def summary(state):
    return (state or {}).get("research") or {}


# ------------------------------------------------------------------------------------------------ plan

def draft_brief(eng, state):
    """Who the users are, in the person's own words (context.audience). Never invented from an option label: empty when the
    person has not said, so the plan asks them first."""
    who = ((state.get("context") or {}).get("audience") or "").strip()
    generic = {str(v).strip().lower() for v in (getattr(eng, "AUDIENCE_WORDS", {}) or {}).values()}
    return "" if who.lower() in generic else who  # the sketch's plain words for an option are not a users line


def queries(brief, product):
    users = brief.split(",")[0].strip() if brief else "<the users>"
    users = re.sub(r"\s+(who|that|using|on)\s.*$", "", users).strip() or users
    product = product or "<the product>"
    return [{"topic": topic, "query": t.format(users=users, product=product)} for topic, ts in QUERY_TEMPLATES.items() for t in ts]


def parse_tools(text):
    have = [t.strip().lower() for t in re.split(r"[,\s]+", text or "") if t.strip()]
    unknown = [t for t in have if t not in TOOL_IDS]
    if unknown:
        raise SystemExit(f"Unknown tool name(s): {', '.join(unknown)}. Use any of: {', '.join(TOOL_IDS)}.")
    return have


def plan(eng, d, brief=None, tools=None, as_json=False):
    state = eng.merge_defaults(eng.load_state(d))
    have = parse_tools(tools) if tools is not None else None
    b = (brief or "").strip() or draft_brief(eng, state)
    product = (eng.product_words(state) or "").strip() or (state.get("name") or "").strip()
    rec = {
        "v": 1, "date": _today(), "brief": b, "brief_confirmed": bool(brief),
        "topics": TOPICS, "queries": queries(b, product),
        "tools": {"have": have if have is not None else [], "missing": [t["id"] for t in TOOLS if have is not None and t["id"] not in have],
                  "reported": have is not None},
        "file": FILE,
    }
    _write(os.path.join(d, PLAN), rec)
    st = eng.merge_defaults(eng.load_state(d))
    r = summary(st)
    if r.get("status") != "done":  # a plan never hides findings already saved
        r.update({"status": "planned", "planned": _today(), "brief": b})
        st["research"] = r
        eng.dump_json(os.path.join(d, eng.STATE_FILE), st)
    if as_json:
        print(json.dumps(rec, indent=2, ensure_ascii=False))
        return rec
    print(f"User research plan, saved to {os.path.join(d, PLAN)}")
    print(f"Users: {b or 'not known yet. Ask the person who the users are in one line before you research.'}"
          + ("" if brief else "  (a draft: confirm it with the person in the same message as the plan)"))
    print("What to find out:")
    for k, v in TOPICS.items():
        print(f"  {k:13s} {v}")
    print("Searches to start from (rewrite them in the users' own words, and add the industry's terms):")
    for q in rec["queries"]:
        print(f"  [{q['topic']}] {q['query']}")
    if have is None:
        print("Tools: say which you have with --tools (" + ", ".join(TOOL_IDS) + "), so the plan can name what is missing.")
    else:
        print("Tools you have: " + (", ".join(have) or "none"))
        for t in TOOLS:
            if t["id"] not in have:
                print(f"  Missing: {t['name']} ({t['look_for']}). It would add {t['adds']}." + (f" Get it: {t['get']}" if t.get("get") else ""))
        if not any(t in have for t in NEEDS_ONE_OF):
            print("Nothing here can read the web. Say so once, and offer the person the findings template to fill in "
                  "(assets/output/research-users.example.json), or skip: engine.py research skip --why \"...\".")
    print("Next: one message to the person: the users line, the searches and the kinds of sites (studies, statistics, reviews, "
          "forums). One yes covers the whole run. Then research without stopping, save the findings as research/users.json, "
          "and run: engine.py research add <file>.")
    return rec


# ------------------------------------------------------------------------------------------------ check

def problems(rec):
    """Every reason a findings file is not usable, as (level, text). Errors block add; warnings are said and kept."""
    out = []
    err = lambda t: out.append(("error", t))
    warn = lambda t: out.append(("warning", t))
    if not isinstance(rec, dict):
        return [("error", "the findings file must be a JSON object")]
    if not str(rec.get("brief") or "").strip():
        err("brief is missing: one line on who the users are, confirmed by the person")
    date = str(rec.get("date") or "")
    try:
        _dt.date.fromisoformat(date)
    except ValueError:
        err(f"date must be the day of the research as YYYY-MM-DD (got {date!r})")
    sources = rec.get("sources") or []
    if not isinstance(sources, list):
        err("sources must be a list")
        sources = []
    sid = {}
    for i, s in enumerate(sources, 1):
        if not isinstance(s, dict) or not s.get("id"):
            err(f"source {i} needs an id (S1, S2, ...)")
            continue
        if s["id"] in sid:
            err(f"source id {s['id']} is used twice")
        sid[s["id"]] = s
        url = str(s.get("url") or "").strip()
        if not (re.match(r"^https?://[^\s]+$", url) or PERSON_SOURCE.match(url)):
            err(f"source {s['id']} needs a url (https://...) that was opened, or \"person, YYYY-MM-DD\" / \"interview, YYYY-MM-DD\" / "
                f"\"analytics, YYYY-MM-DD\" (got {url!r})")
        if s.get("kind") and s["kind"] not in SOURCE_KINDS:
            err(f"source {s['id']} kind must be one of {', '.join(SOURCE_KINDS)}")
        if not str(s.get("title") or "").strip():
            warn(f"source {s['id']} has no title")
    findings = rec.get("findings") or []
    if not isinstance(findings, list) or not findings:
        err("findings is empty: at least one finding is needed")
        findings = findings if isinstance(findings, list) else []
    fid = set()
    topics_seen = set()
    for i, f in enumerate(findings, 1):
        if not isinstance(f, dict) or not f.get("id"):
            err(f"finding {i} needs an id (F1, F2, ...)")
            continue
        name = f["id"]
        if name in fid:
            err(f"finding id {name} is used twice")
        fid.add(name)
        if f.get("topic") not in TOPICS:
            err(f"finding {name} topic must be one of {', '.join(TOPICS)}")
        else:
            topics_seen.add(f["topic"])
        text = str(f.get("text") or "").strip()
        if not text:
            err(f"finding {name} has no text")
        conf = f.get("confidence")
        if conf not in CONFIDENCE:
            err(f"finding {name} confidence must be one of {', '.join(CONFIDENCE)}")
        refs = f.get("sources") or []
        if conf != "inferred" and not refs:
            err(f"finding {name} cites no source; cite one, or mark it inferred")
        for r in refs:
            if r not in sid:
                err(f"finding {name} cites {r}, which is not in sources")
        if conf == "measured" and refs and all((sid.get(r) or {}).get("kind") in ("forum", "community") for r in refs):
            warn(f"finding {name} is marked measured but cites only forums; call it reported")
        for sg in f.get("signals") or []:
            if sg not in SIGNALS:
                err(f"finding {name} signal {sg!r} is not a known signal ({', '.join(SIGNALS)})")
        if conf == "inferred" and f.get("signals"):
            warn(f"finding {name} is inferred; its signals are shown, but say it is a guess when you ask")
    for i, a in enumerate(rec.get("apps") or [], 1):
        if not isinstance(a, dict) or not str(a.get("name") or "").strip():
            err(f"app {i} needs a name")
            continue
        for r in a.get("sources") or []:
            if r not in sid:
                err(f"app {a['name']} cites {r}, which is not in sources")
    mk = rec.get("market")
    if mk is not None and not isinstance(mk, dict):
        err("market must be an object: analogous, competitors, pattern, gap, conventions")
        mk = {}
    for k, v in (mk or {}).items():
        if k not in MARKET_LISTS + MARKET_ONE + MARKET_TEXT + MARKET_WORDS:
            err(f"market.{k} is not a market field ({', '.join(MARKET_ONE + MARKET_LISTS + MARKET_TEXT + MARKET_WORDS)})")
            continue
        items = v if k in MARKET_LISTS else [v] if k in MARKET_ONE + MARKET_TEXT else []
        if k in MARKET_LISTS and not isinstance(v, list):
            err(f"market.{k} must be a list of {{name, why, sources}}")
            items = []
        if k in MARKET_WORDS and not (isinstance(v, list) and all(isinstance(x, str) for x in v)):
            err(f"market.{k} must be a list of short lines")
        for j, x in enumerate(items, 1):
            if k in MARKET_TEXT and isinstance(x, str):
                continue  # a sentence without sources is shown as the agent's own reading
            key = "text" if k in MARKET_TEXT else "name"
            if not isinstance(x, dict) or not str(x.get(key) or "").strip():
                err(f"market.{k}{f' {j}' if k in MARKET_LISTS else ''} needs a {key}")
                continue
            for r in x.get("sources") or []:
                if r not in sid:
                    err(f"market.{k} {x[key]} cites {r}, which is not in sources")
            if k in MARKET_LISTS:
                out += [(lvl, f"market.{k} {x[key]}: {t}") for lvl, t in entry_problems(k, x)]
    comps = [x for x in (mk or {}).get("competitors") or [] if isinstance(x, dict)]
    if comps and len([x for x in comps if table_ready(x)]) < TABLE_MIN:
        warn(f"the competitor table needs a link, colours, type and a CTA shape for at least {TABLE_MIN} competitors "
             "before any colour or direction is proposed (research.md section 6)")
    blob = json.dumps({k: rec.get(k) for k in ("findings", "apps", "patterns", "open_questions", "brief", "market")}, ensure_ascii=False)
    if RX_EMAIL.search(blob) or RX_PHONE.search(blob) or RX_HANDLE.search(blob):
        err("the findings hold what looks like personal data (an email, phone number or @handle). Keep only facts about the group, "
            "never about a person")
    missing = [t for t in TOPICS if t not in topics_seen]
    if findings and missing:
        warn("no finding on " + ", ".join(missing) + ": say so in open_questions, or search again")
    for k in ("tools",):
        t = rec.get(k) or {}
        for x in (t.get("used") or []) + (t.get("missing") or []):
            if x not in TOOL_IDS:
                warn(f"tools lists {x!r}, which is not a known tool id ({', '.join(TOOL_IDS)})")
    return out


def load(path):
    if not os.path.isfile(path):
        raise SystemExit(f"File not found: {path}. Write the findings as JSON first (assets/output/research-users.example.json shows the shape).")
    try:
        return _read(path)
    except ValueError as ex:
        raise SystemExit(f"{path} is not valid JSON ({ex}).")


def check(path, as_json=False):
    rec = load(path)
    ps = problems(rec)
    if as_json:
        print(json.dumps([{"level": l, "text": t} for l, t in ps], indent=2))
    else:
        errs = [t for l, t in ps if l == "error"]
        warns = [t for l, t in ps if l == "warning"]
        print(f"{path}: {len(rec.get('findings') or [])} finding(s), {len(rec.get('sources') or [])} source(s), "
              f"{len(errs)} error(s), {len(warns)} warning(s)")
        for t in errs:
            print(f"  error: {t}")
        for t in warns:
            print(f"  warning: {t}")
    return 1 if any(l == "error" for l, _ in ps) else 0


# ------------------------------------------------------------------------------------------------ proposals

def proposals(eng, state, rec, latest=None):
    """Recommended answers from the findings' signals. Returns (proposals, conflicts, notes).
    A proposal: {question, value, signals, findings, sources, status} where status is "new" (no one said yes to this question
    yet), "same" (already the answer) or "differs" (the person's own answer differs: ask, never overwrite)."""
    by_q = {}
    notes = []
    srcs = {f["id"]: f.get("sources") or [] for f in rec.get("findings") or [] if isinstance(f, dict) and f.get("id")}
    for f in rec.get("findings") or []:
        if not isinstance(f, dict):
            continue
        for sg in f.get("signals") or []:
            spec = SIGNALS.get(sg)
            if not spec:
                continue
            if spec.get("note") and spec["note"] not in [n["text"] for n in notes]:
                notes.append({"signal": sg, "text": spec["note"], "findings": [f["id"]]})
            elif spec.get("note"):
                next(n for n in notes if n["text"] == spec["note"])["findings"].append(f["id"])
            for qid, val in spec["effects"].items():
                slot = by_q.setdefault(qid, {"values": {}, "signals": set(), "findings": set()})
                for v in (val if isinstance(val, list) else [val]):
                    slot["values"].setdefault(v, set()).add(f["id"])
                slot["signals"].add(sg)
                slot["findings"].add(f["id"])
    answers = state.get("answers") or {}
    latest = latest or {}
    out, conflicts = [], []
    for qid in sorted(by_q):
        slot = by_q[qid]
        vals = sorted(slot["values"])
        if qid in SINGLE and len(vals) > 1:
            conflicts.append({"question": qid, "values": {v: sorted(slot["values"][v]) for v in vals},
                              "text": f"The findings point two ways on {qid}: "
                                      + "; ".join(f"{v} ({', '.join(sorted(slot['values'][v]))})" for v in vals)
                                      + ". Ask the person which group the product is for."})
            continue
        rec_a = answers.get(qid)
        cur = eng.answer_value(rec_a) if rec_a is not None else None
        sb = (latest.get(f"answers.{qid}") or {}).get("set_by") if latest else None
        sb = sb or (rec_a.get("set_by") if isinstance(rec_a, dict) else ("chosen" if rec_a is not None else None))
        if qid in SINGLE:
            value = vals[0]
            same = cur == value
        else:
            start = cur if cur not in (None, "", []) else eng.question_default(state, qid)  # keep the defaults it already has
            if isinstance(start, str):
                start = [x for x in re.split(r"\s*[+,]\s*", start) if x]
            base = [x for x in (start if isinstance(start, list) else []) if isinstance(x, str)]
            value = base + [v for v in vals if v not in base]
            same = set(value) == set(base)
        status = "same" if same else ("differs" if sb in PERSON_OWN and cur not in (None, "", []) else "new")
        fids = sorted(slot["findings"])
        out.append({"question": qid, "value": value, "current": cur, "current_set_by": sb, "signals": sorted(slot["signals"]),
                    "findings": fids, "sources": sorted({s for x in fids for s in srcs.get(x, [])}), "status": status})
    return out, conflicts, notes


def _qwords(eng, qid, value):
    try:
        return eng.answer_words(qid, value)
    except Exception:  # plain fallback; the words are only for people
        return json.dumps(value)


# ------------------------------------------------------------------------------------------------ users.md

def render_md(eng, state, rec, props, conflicts, notes):
    name = state.get("name") or "This product"
    src = {s["id"]: s for s in rec.get("sources") or [] if isinstance(s, dict) and s.get("id")}

    def cite(ids):
        return ", ".join(f"[{i}]" for i in ids) if ids else "no source"
    out = [f"# {name}: who the users are", "",
           "> Desk research by an AI agent with OpenDesigner, from public sources it opened. It describes a group, not this product's own "
           "users: confirm what matters with real people (five short interviews are enough to start). Rendered from `users.json`; "
           "edit that file and run `engine.py research add` again.", "",
           f"**Users:** {rec.get('brief', '').strip()}", "", f"**Researched:** {rec.get('date')}"]
    used = (rec.get("tools") or {}).get("used") or []
    if used:
        out += ["", f"**Tools used:** {', '.join(used)}"]
    miss = (rec.get("tools") or {}).get("missing") or []
    if miss:
        out += ["", f"**Not available:** {', '.join(miss)}"]
    out += ["", "## Findings", ""]
    for t, title in TOPICS.items():
        fs = [f for f in rec.get("findings") or [] if isinstance(f, dict) and f.get("topic") == t]
        if not fs:
            continue
        out += [f"### {title.split(':')[0]}", ""]
        for f in fs:
            out.append(f"- **{f['id']}** {f.get('text', '').strip()} ({f.get('confidence')}; {cite(f.get('sources') or [])})")
        out.append("")
    apps = rec.get("apps") or []
    if apps:
        out += ["## Apps they already use", ""]
        for a in apps:
            out.append(f"- **{a.get('name')}**" + (f": {a['why']}" if a.get("why") else "") + (f" ({cite(a.get('sources') or [])})" if a.get("sources") else ""))
        out.append("")
    pats = rec.get("patterns") or []
    if pats:
        out += ["## Patterns they already know", ""] + [f"- {p}" for p in pats] + [""]
    mk = market_summary(rec)
    if mk:
        out += ["## Market", ""]
        labels = {"analogous": "Analogous product", "competitors": "Competitors", "pattern": "What they all do", "gap": "The gap",
                  "conventions": "Conventions"}
        for k, label in labels.items():
            if mk.get(k):
                out.append(f"- **{label}:** {'; '.join(mk[k]) if isinstance(mk[k], list) else mk[k]}")
        out.append("")
    table = market_table_md(rec)
    if table:
        out += [table, ""]
    out += ["## What it means for the design system", ""]
    if props or conflicts or notes:
        for p in props:
            word = {"new": "Recommended", "same": "Already the answer", "differs": "Differs from your answer, so ask", "applied": "Applied",
                    "skipped": "Not applied (a standard or a lock holds it)"}[p["status"]]
            out.append(f"- {word}: {p['question']} = **{_qwords(eng, p['question'], p['value'])}** "
                       f"(from {', '.join(p['findings'])}; signals {', '.join(p['signals'])})")
        for c in conflicts:
            out.append(f"- Open: {c['text']}")
        for n in notes:
            out.append(f"- For later stages: {n['text']} (from {', '.join(n['findings'])})")
    else:
        out.append("- Nothing here changes a default yet. The findings still guide the reference searches and later questions.")
    out.append("")
    oq = rec.get("open_questions") or []
    if oq:
        out += ["## Open questions", ""] + [f"- {q}" for q in oq] + [""]
    if src:
        out += ["## Sources", ""]
        for i, s in src.items():
            url = s.get("url", "")
            link = f"[{s.get('title') or url}]({url})" if url.startswith("http") else f"{s.get('title') or 'Note'} ({url})"
            meta = ", ".join(x for x in (s.get("kind"), s.get("date") and f"published {s['date']}", s.get("accessed") and f"opened {s['accessed']}") if x)
            out.append(f"- [{i}] {link}" + (f" · {meta}" if meta else ""))
        out.append("")
    return "\n".join(out).rstrip() + "\n"


# ------------------------------------------------------------------------------------------------ add, apply, skip, status

def add(eng, d, path, accept=False, only=None, as_json=False):
    rec = load(path)
    ps = problems(rec)
    errs = [t for l, t in ps if l == "error"]
    if errs:
        print(f"Nothing was saved: {len(errs)} problem(s) in {path}.")
        for t in errs:
            print(f"  error: {t}")
        print("Fix them and run engine.py research add again (engine.py research check shows the same list).")
        return 1
    state = eng.merge_defaults(eng.load_state(d))
    dest = os.path.join(d, FILE)
    if os.path.abspath(path) != os.path.abspath(dest):
        _write(dest, rec)
    props, conflicts, notes = proposals(eng, state, rec, eng._decisions(d))
    only_q = [q.strip() for q in (only or "").split(",") if q.strip()]
    applied, skipped = [], []
    if accept:
        for p in props:
            # new ones; one that differs from the person's own answer only when they named it (--only) after saying yes
            if only_q and p["question"] not in only_q:
                continue
            if p["status"] != "new" and not (p["status"] == "differs" and p["question"] in only_q):
                continue
            why = (f"user research ({', '.join(p['findings'])}): " + "; ".join(SIGNALS[s]["plain"] for s in p["signals"]))
            try:
                eng.cmd_set(d, "answers." + p["question"], p["value"], why=why, set_by="research", source_ref=FILE, quiet=True)
            except SystemExit as ex:  # a standard or a lock outranks research: say so and go on
                p["status"] = "skipped"
                skipped.append(f"{p['question']}: {str(ex).splitlines()[0]}")
                continue
            p["status"] = "applied"
            applied.append(p["question"])
        state = eng.merge_defaults(eng.load_state(d))
    _write_text(os.path.join(d, DOC), render_md(eng, state, rec, props, conflicts, notes))
    r = summary(state)
    r.update({"status": "done", "date": rec.get("date"), "added": _today(), "brief": rec.get("brief"), "file": FILE, "doc": DOC,
              "findings": len(rec.get("findings") or []), "sources": len(rec.get("sources") or []),
              "tools": (rec.get("tools") or {}).get("used") or [],
              "highlights": [{"id": f["id"], "text": f.get("text", ""), "confidence": f.get("confidence")}
                             for f in (rec.get("findings") or [])[:5] if isinstance(f, dict)],
              "proposals": props, "conflicts": [c["text"] for c in conflicts], "notes": [n["text"] for n in notes],
              "market": market_summary(rec)})
    r.pop("skipped_why", None)
    state["research"] = r
    eng.dump_json(os.path.join(d, eng.STATE_FILE), state)
    eng.refresh_docs(d)
    if as_json:
        print(json.dumps({"proposals": props, "conflicts": conflicts, "notes": notes, "applied": applied, "skipped": skipped,
                          "warnings": [t for l, t in ps if l == "warning"]}, indent=2, ensure_ascii=False))
        return 0
    print(f"Saved {r['findings']} finding(s) from {r['sources']} source(s): {os.path.join(d, FILE)} and {os.path.join(d, DOC)}.")
    for l, t in ps:
        print(f"  {l}: {t}")
    if not props and not conflicts:
        print("No finding changes a default. They still guide the reference searches and the later stages.")
    for p in props:
        tag = {"new": "recommend", "same": "already so", "differs": "ASK (their answer differs)", "applied": "applied",
               "skipped": "skipped"}[p["status"]]
        cur = "" if p["current"] in (None, "", []) else f"; now {_qwords(eng, p['question'], p['current'])} ({p['current_set_by']})"
        print(f"  {tag:12s} {p['question']} = {_qwords(eng, p['question'], p['value'])}  from {', '.join(p['findings'])}{cur}")
    for c in conflicts:
        print(f"  open: {c['text']}")
    for n in notes:
        print(f"  later: {n['text']}")
    for s in skipped:
        print(f"  not changed: {s}")
    pending = [p for p in props if p["status"] == "new"]
    if pending and not accept:
        print("Show the person the recommendations with their sources, then apply the ones they say yes to: "
              "engine.py research add " + os.path.join(d, FILE) + " --accept [--only " + ",".join(p["question"] for p in pending) + "]")
    if applied:
        print(f"Applied with set_by research: {', '.join(applied)}. Run engine.py build to see them.")
    return 0


def skip(eng, d, why):
    if not (why or "").strip():
        raise SystemExit("Say why, in the person's words: engine.py research skip --why \"...\"")
    state = eng.merge_defaults(eng.load_state(d))
    r = summary(state)
    if r.get("status") == "done":
        raise SystemExit("This project already has user research (research/users.json); nothing was changed.")
    r.update({"status": "skipped", "skipped_why": why.strip(), "skipped": _today()})
    state["research"] = r
    eng.dump_json(os.path.join(d, eng.STATE_FILE), state)
    eng.refresh_docs(d)
    print(f"User research skipped: {why.strip()}. The reminders stop; engine.py research plan starts it any time.")
    return 0


def age_days(r, today=None):
    try:
        then = _dt.date.fromisoformat(str(r.get("date")))
    except (TypeError, ValueError):
        return None
    return ((today or _dt.date.today()) - then).days


def review(d, state):
    """What engine.py review says about the research: (errors, notes). Errors: the saved findings fail the checks or are
    missing. Notes: not done yet, or old."""
    r = summary(state)
    errs, notes = [], []
    if r.get("status") == "done":
        fp = os.path.join(d, FILE)
        if not os.path.isfile(fp):
            errs.append(f"state.json says the users were researched, but {FILE} is missing")
        else:
            try:
                rec = _read(fp)
            except ValueError as ex:
                errs.append(f"{FILE} is not valid JSON ({ex})")
                rec = None
            if rec is not None:
                errs += [f"{FILE}: {t}" for l, t in problems(rec) if l == "error"]
        age = age_days(r)
        if age is not None and age > STALE_DAYS:
            notes.append(f"The user research is {age} days old. People and their apps change: run it again (engine.py research plan).")
        if not os.path.isfile(os.path.join(d, DOC)) and os.path.isfile(fp):
            notes.append(f"{DOC} is missing: run engine.py research add {FILE} to render it.")
    elif r.get("status") == "skipped":
        pass
    else:
        notes.append("The users have not been researched yet (optional, about 10 minutes): engine.py research plan, "
                     "or engine.py research skip --why \"...\".")
    try:
        pos = load_positioning(d)
    except (ValueError, OSError) as ex:
        pos = None
        notes.append(f"{POSITIONING} is not readable ({ex}).")
    if pos and pos.get("status") != "confirmed":
        notes.append(f"The positioning is a draft ({POSITIONING}): show it to the person, then research.py positioning confirm.")
    if os.path.isfile(os.path.join(d, DIRECTIONS)):
        try:
            rec = _read(os.path.join(d, DIRECTIONS))
            bad = [t for l, t in directions_problems(rec, state, _users(d), _photo_ledger(d), pos) if l == "error"]
        except (ValueError, OSError) as ex:
            bad = [f"not readable ({ex})"]
        notes += [f"{DIRECTIONS}: {t}" for t in bad[:5]]
    return errs, notes


def market_summary(rec):
    """The market block of a findings file as PRODUCT.md shows it, each line with its sources: {analogous, competitors,
    pattern, gap, conventions}. Conventions fall back to the patterns the users already know. Empty when nothing was found."""
    mk = rec.get("market") if isinstance(rec.get("market"), dict) else {}
    cite = lambda x: f" [{', '.join(x.get('sources'))}]" if isinstance(x, dict) and x.get("sources") else ""

    def entry(x):
        if isinstance(x, str):
            return x.strip()
        if not isinstance(x, dict):
            return ""
        head = str(x.get("name") or x.get("text") or "").strip()
        return (head + (f": {str(x['why']).strip()}" if x.get("why") else "") + cite(x)) if head else ""
    out = {}
    if entry(mk.get("analogous")):
        out["analogous"] = entry(mk["analogous"])
    comp = [entry(x) for x in mk.get("competitors") or [] if entry(x)]
    if comp:
        out["competitors"] = comp
    for k in MARKET_TEXT:
        if entry(mk.get(k)):
            out[k] = entry(mk[k])
    conv = [str(x).strip() for x in (mk.get("conventions") or rec.get("patterns") or []) if str(x).strip()]
    if conv:
        out["conventions"] = conv
    return out


# ------------------------------------------------------------------------------------------------ colour, measured

def norm_hex(h):
    m = re.fullmatch(r"#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})", str(h or "").strip())
    if not m:
        return None
    x = m.group(1)
    return "#" + ("".join(c * 2 for c in x) if len(x) == 3 else x).upper()


def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _rgb(h):
    x = norm_hex(h)
    return [_lin(int(x[i:i + 2], 16) / 255) for i in (1, 3, 5)]


def oklab(h):
    """OKLab of a hex colour (Björn Ottosson, 2020)."""
    r, g, b = _rgb(h)
    l, m, s = ((0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3),
               (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3),
               (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3))
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


def oklch(h):
    L, a, b = oklab(h)
    return L, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360


def distance(a, b):
    """OKLab distance: about 0.02 is the smallest difference people notice [inferred from the OKLab design goals]."""
    return math.dist(oklab(a), oklab(b))


def contrast(a, b):
    lum = lambda h: sum(w * c for w, c in zip((0.2126, 0.7152, 0.0722), _rgb(h)))
    hi, lo = sorted((lum(a), lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


FAMILIES = ((40, "red"), (75, "orange"), (115, "yellow"), (165, "green"), (220, "teal"), (280, "blue"), (320, "violet"),
            (350, "pink"), (361, "red"))  # OKLCH hue bands [inferred]: pure red sits near 29°, blue near 264°
FAMILY_NAMES = ("red", "orange", "yellow", "green", "teal", "blue", "violet", "pink")
NEUTRAL_C = 0.035  # below this chroma a colour reads grey


def hue_family(h):
    _, c, hue = oklch(h)
    return "neutral" if c < NEUTRAL_C else next(n for top, n in FAMILIES if hue < top)


def ground_kind(h):
    L, c, _ = oklch(h)
    return "dark" if L < 0.4 else "light" if L > 0.9 and c < 0.04 else "tinted"

# ------------------------------------------------------------------------------------------------ the competitor table and the benchmark

def entry_problems(kind, x):
    """Problems with one competitor or benchmark row, as (level, text)."""
    out = []
    err = lambda t: out.append(("error", t))
    url = str(x.get("url") or "").strip()
    if url and not re.match(r"^https?://\S+$", url):
        err(f"url must be the page you opened (https://...), not {url!r}")
    if kind == "benchmark":
        if not url:
            err("needs the url of the page or section you looked at (the live page or its Mobbin link)")
        if not str(x.get("takes") or "").strip():
            err("needs takes: the principle you take from it (structure, never its look)")
        return out
    cols = x.get("colors")
    if cols is not None:
        if not isinstance(cols, list):
            err("colors must be a list of {hex, role}")
            cols = []
        for c in cols:
            if not isinstance(c, dict) or not norm_hex(c.get("hex")):
                err(f"colour {c!r} needs a hex, like #0A2F6B")
            elif c.get("role") not in COLOR_ROLES:
                err(f"colour {c['hex']} role must be one of {', '.join(COLOR_ROLES)}")
        if cols and not url:
            err("colours need the url of the page they were measured on")
    if x.get("ground") is not None and x["ground"] not in GROUNDS:
        err(f"ground must be one of {', '.join(GROUNDS)}")
    t = x.get("type")
    if t is not None:
        if not isinstance(t, dict) or not str(t.get("text") or t.get("display") or "").strip():
            err("type needs {display, text, class}: the font names measured on the page")
        elif t.get("class") and t["class"] not in TYPE_CLASSES:
            err(f"type class must be one of {', '.join(TYPE_CLASSES)}")
    c = x.get("cta")
    if c is not None and (not isinstance(c, dict) or c.get("shape") not in CTA_SHAPES):
        err(f"cta needs a shape: {', '.join(CTA_SHAPES)} (radius and label are optional)")
    if x.get("measured") is not None and x["measured"] not in MEASURED:
        err(f"measured must be one of {', '.join(MEASURED)}")
    return out


def _colors(x):
    return [(c.get("role"), norm_hex(c.get("hex"))) for c in x.get("colors") or [] if isinstance(c, dict) and norm_hex(c.get("hex"))]


def table_ready(x):
    return bool(str(x.get("url") or "").startswith("http") and _colors(x) and isinstance(x.get("type"), dict)
                and isinstance(x.get("cta"), dict) and x["cta"].get("shape") in CTA_SHAPES)


def accent_of(x):
    """A competitor's accent: its call-to-action colour, else its accent, else a colour band."""
    cols = _colors(x)
    return next((h for role in ("cta", "accent", "band") for r, h in cols if r == role), None)


def ground_of(x):
    g = next((h for r, h in _colors(x) if r == "ground"), None)
    return x.get("ground") if x.get("ground") in GROUNDS else ground_kind(g) if g else None


def competitors(rec):
    return [x for x in ((rec or {}).get("market") or {}).get("competitors") or [] if isinstance(x, dict) and x.get("name")]


def category(rec):
    """What the category does, counted from the competitor table: grounds, accent families, CTA shapes and type classes,
    and the accent families and grounds nobody uses. Empty without a table."""
    rows = [x for x in competitors(rec) if x.get("colors") or x.get("type") or x.get("cta")]
    if not rows:
        return {}
    count = lambda vals: dict(Counter(v for v in vals if v).most_common())
    acc = {x["name"]: accent_of(x) for x in rows if accent_of(x)}
    fam = count(hue_family(h) for h in acc.values())
    grounds = count(ground_of(x) for x in rows)
    return {"n": len(rows), "grounds": grounds, "accents": fam, "accent_hex": acc,
            "cta": count((x.get("cta") or {}).get("shape") for x in rows if isinstance(x.get("cta"), dict)),
            "type": count((x.get("type") or {}).get("class") for x in rows if isinstance(x.get("type"), dict)),
            "unused_accents": [f for f in FAMILY_NAMES if f not in fam], "unused_grounds": [g for g in GROUNDS if g not in grounds]}


def category_lines(cat):
    if not cat:
        return []
    fmt = lambda d: ", ".join(f"{k} {v}" for k, v in d.items()) or "not measured"
    out = [f"Grounds: {fmt(cat['grounds'])} (of {cat['n']})", f"Accents: {fmt(cat['accents'])}",
           f"Calls to action: {fmt(cat['cta'])}", f"Type: {fmt(cat['type'])}"]
    free = [f"{', '.join(cat['unused_accents'])} accents"] if cat["unused_accents"] else []
    free += [f"a {g} ground" for g in cat["unused_grounds"]]
    return out + ([f"Nobody uses: {'; '.join(free)}"] if free else [])


def _cell(v):
    return str(v or "").replace("|", "\\|").replace("\n", " ").strip()


def market_table_md(rec):
    """The competitor table, what the category does, and the industry benchmark, as Markdown with links. '' when empty."""
    out = []
    rows = [x for x in competitors(rec) if x.get("colors") or x.get("type") or x.get("cta") or x.get("url")]
    if rows:
        out += ["## Competitors, measured", "", "| Competitor | Ground | Colours | Type | Call to action |", "|---|---|---|---|---|"]
        for x in rows:
            name = f"[{_cell(x['name'])}]({x['url']})" if str(x.get("url") or "").startswith("http") else _cell(x["name"])
            name += f" · {x['measured']}" if x.get("measured") else ""
            cols = " · ".join(f"`{h}` {r}" for r, h in _colors(x)) or "not measured"
            t = x.get("type") if isinstance(x.get("type"), dict) else {}
            ty = " / ".join(dict.fromkeys(v for v in (t.get("display"), t.get("text")) if v)) + (f" ({t['class']})" if t.get("class") else "")
            c = x.get("cta") if isinstance(x.get("cta"), dict) else {}
            cta = ", ".join(str(v) for v in (c.get("shape"), c.get("radius") and f"{c['radius']}px", c.get("fill"),
                                              c.get("label") and f"\"{c['label']}\"") if v)
            out.append(f"| {name} | {ground_of(x) or ''} | {cols} | {_cell(ty) or 'not measured'} | {_cell(cta) or 'not measured'} |")
        out.append("")
    lines = category_lines(category(rec))
    if lines:
        out += ["## What the category does", ""] + [f"- {l}" for l in lines] + [""]
    bench = [x for x in ((rec or {}).get("market") or {}).get("benchmark") or [] if isinstance(x, dict) and x.get("name")]
    if bench:
        out += ["## Industry benchmark", "", "| Site | Section | What they do | What we take | Stays theirs |", "|---|---|---|---|---|"]
        for x in bench:
            name = f"[{_cell(x['name'])}]({x['url']})" if str(x.get("url") or "").startswith("http") else _cell(x["name"])
            out.append(f"| {name} | {_cell(x.get('section'))} | {_cell(x.get('does') or x.get('why'))} | {_cell(x.get('takes'))} | "
                       f"{_cell(x.get('signature'))} |")
        out.append("")
    return "\n".join(out).rstrip()


def _users(d):
    fp = os.path.join(d, FILE)
    return _read(fp) if os.path.isfile(fp) else None


def cmd_market(d, as_json=False):
    """The table to show the person before any colour or direction: competitors with links, colours, type and CTA shapes,
    what the category does, and the industry benchmark."""
    rec = _users(d)
    if rec is None:
        raise SystemExit(f"No {FILE} yet. Research first (references/research.md), then engine.py research add <file>.")
    if as_json:
        print(json.dumps({"competitors": competitors(rec), "category": category(rec),
                          "benchmark": (rec.get("market") or {}).get("benchmark") or []}, indent=2, ensure_ascii=False))
        return 0
    table = market_table_md(rec)
    print(table or "No competitors or benchmark in the findings yet: add market.competitors and market.benchmark (research.md section 6).")
    ready = len([x for x in competitors(rec) if table_ready(x)])
    if ready < TABLE_MIN:
        print(f"\nOnly {ready} competitor(s) have a link, colours, type and a CTA shape; {TABLE_MIN} are needed before any colour.")
    return 0

# ------------------------------------------------------------------------------------------------ positioning

POSITIONING = "research/positioning.json"
POS_PARTS = (("for", "Who it's for"), ("problem", "The problem"), ("claim", "The one claim"), ("proof", "The proof"))
PLACEHOLDER = re.compile(r"<[^>]+>|\?\?|\bTODO\b|\bTBD\b")


def _text(v):
    return str((v.get("text") if isinstance(v, dict) else v) or "").strip()


def load_positioning(d):
    fp = os.path.join(d, POSITIONING)
    return _read(fp) if os.path.isfile(fp) else None


def positioning_gaps(p):
    """The parts still empty or holding a placeholder."""
    gaps = []
    for k, label in POS_PARTS:
        vals = [_text(x) for x in (p.get(k) or [])] if k == "proof" else [_text(p.get(k))]
        if not any(vals) or any(PLACEHOLDER.search(v) for v in vals):
            gaps.append(label)
    return gaps


def positioning_lines(p):
    proof = [_text(x) for x in p.get("proof") or [] if _text(x)]
    return [f"Who it's for: {_text(p.get('for')) or '(needs you)'}", f"The problem: {_text(p.get('problem')) or '(needs you)'}",
            f"The one claim: {_text(p.get('claim')) or '(needs you)'}", f"The proof: {'; '.join(proof) or '(needs you: a number, a customer, a demo)'}"]


def positioning_draft(eng, d):
    """Draft the positioning from the research and the project: who (the research brief), the problem (the first
    expectations finding), the claim (context.purpose, else the market gap) and what it stands against (the category
    pattern). The proof is left to the person: it is never invented."""
    old = load_positioning(d)
    if old and old.get("status") == "confirmed":
        raise SystemExit("The positioning is already confirmed. To change it, use the person's words: research.py positioning confirm --claim \"...\"")
    state = eng.merge_defaults(eng.load_state(d))
    rec = _users(d) or {}
    ctx = state.get("context") or {}
    mk = rec.get("market") or {}
    exp = [f for f in rec.get("findings") or [] if isinstance(f, dict) and f.get("topic") == "expectations" and f.get("text")]
    who = rec.get("brief") or eng.audience_words(state) or ""
    claim = ctx.get("purpose") or _text(mk.get("gap"))
    p = {"v": 1, "status": "draft", "date": _today(),
         "for": {"text": who, "from": ["research brief" if rec.get("brief") else "context.audience"] if who else []},
         "problem": {"text": exp[0]["text"] if exp else "", "from": [exp[0]["id"]] if exp else []},
         "claim": {"text": claim, "from": ["context.purpose" if ctx.get("purpose") else "market.gap"] if claim else []},
         "proof": [],
         "against": {"text": _text(mk.get("pattern")), "from": ["market.pattern"] if _text(mk.get("pattern")) else []}}
    p["needs"] = positioning_gaps(p)
    _write(os.path.join(d, POSITIONING), p)
    print(f"Positioning draft, saved to {os.path.join(d, POSITIONING)}:")
    for line in positioning_lines(p):
        print("  " + line)
    if p["against"]["text"]:
        print(f"  Unlike the category: {p['against']['text']}")
    print("Rewrite it in the person's words, show these four lines, and ask for the proof (never invent it). On a yes: "
          "research.py positioning confirm [--for ...] [--problem ...] [--claim ...] --proof \"...\" [--proof \"...\"]")
    return p


def positioning_confirm(eng, d, who=None, problem=None, claim=None, proof=None):
    p = load_positioning(d) or {"v": 1, "date": _today(), "proof": []}
    for k, v in (("for", who), ("problem", problem), ("claim", claim)):
        if v and v.strip():
            p[k] = {"text": v.strip(), "from": ["person"]}
    if not [t for t in proof or [] if t.strip()]:
        raise SystemExit("Not confirmed: give the proof in the person's words with --proof \"...\" (repeat for more). "
                         "Only they have it; a proof already in the file is never confirmed for them.")
    p["proof"] = [{"text": t.strip(), "from": ["person"]} for t in proof if t.strip()]
    gaps = positioning_gaps(p)
    if gaps:
        raise SystemExit(f"Not confirmed: {', '.join(gaps)} still empty or a placeholder. Ask the person; never invent it.")
    p.update({"status": "confirmed", "confirmed": _today(), "set_by": "chosen", "needs": []})
    _write(os.path.join(d, POSITIONING), p)
    state = eng.merge_defaults(eng.load_state(d))
    r = summary(state)
    r["positioning"] = {"for": _text(p["for"]), "problem": _text(p["problem"]), "claim": _text(p["claim"]),
                        "proof": [_text(x) for x in p["proof"]], "confirmed": p["confirmed"]}
    state["research"] = r
    eng.dump_json(os.path.join(d, eng.STATE_FILE), state)
    eng.refresh_docs(d)
    print(f"Positioning confirmed and saved: {os.path.join(d, POSITIONING)}")
    for line in positioning_lines(p):
        print("  " + line)
    print("Next: three directions (references/research.md section 9).")
    return 0

# ------------------------------------------------------------------------------------------------ three directions

DIRECTIONS = "research/directions.json"
BOARD = "research/directions.html"
PHOTO_DIR = "research/photos"  # illustrate.py photos ... (its --dir for photos), with ledger.json and CREDITS.md
PHOTO_GRADES = ("natural", "warm", "cool", "high-key", "mono", "low-key")  # same list as illustrate.py
ACCENT_USES = ("actions-only", "highlight", "one-band", "field", "none")
RHYTHMS = ("grid", "editorial", "split", "stack", "full-bleed")
AXES = {"ground": ("Ground", GROUNDS), "type": ("Type pairing", None), "photo_grade": ("Photo grade", PHOTO_GRADES),
        "accent_use": ("Accent use", ACCENT_USES), "rhythm": ("Layout rhythm", RHYTHMS)}
N_DIRECTIONS = 3
MIN_VARYING = 3     # axes that must differ when the person has settled some (fixed)
REFS_MIN = 2        # one reference per direction is a copy (owner feedback 2026-11-03, rows 8 and 17)
NEAR_ERROR, NEAR_WARN = 0.03, 0.06  # OKLab distance to a competitor's colour: theirs, or close to theirs [inferred]
AI_CAPTION = re.compile(r"\b(AI|artificial intelligence)[- ]?(generated|made|created|image|art)\b|"
                        r"\b(generated|created|made|rendered) (by|with|using|in) (an? )?(AI|artificial intelligence|midjourney|dall[- ·]?e|"
                        r"stable diffusion|firefly|imagen|an image model)\b", re.I)  # the same pattern as illustrate.py
WORK = ("work", "high-trust")  # Q-aud-02 answers that make it a B2B or work product


def _axis(dr, k):
    if k == "type":
        t = dr.get("type") if isinstance(dr.get("type"), dict) else {}
        return (str(t.get("display") or "").strip().lower(), str(t.get("text") or "").strip().lower())
    if k == "ground":  # the ground colour decides, not its label
        g = norm_hex((dr.get("colors") or {}).get("ground")) if isinstance(dr.get("colors"), dict) else None
        return ground_kind(g) if g else dr.get(k)
    return dr.get(k)


def _norm(s):
    return re.sub(r"[^a-z0-9]+", " ", str(s or "").lower()).strip()


def _host(url):
    m = re.match(r"^https?://([^/:?#]+)", str(url or "").strip(), re.I)
    return m.group(1).lower().removeprefix("www.") if m else ""


SMALL_WORDS = {"a", "an", "the", "of", "on", "in", "at", "and", "with", "its", "their", "over", "under", "for", "to", "shaped", "style"}


def _words(s):
    return {w[:-1] if len(w) > 3 and w.endswith("s") else w for w in re.findall(r"[a-z0-9]+", str(s or "").lower())} - SMALL_WORDS


def _same_device(signature, device):
    """A device uses a signature when every word of the signature is in it: 'basket mascot' and 'a basket-shaped mascot'."""
    sw, dw = _words(signature), _words(device)
    return bool(sw) and sw <= dw


def _photo_ledger(d):
    fp = os.path.join(d, PHOTO_DIR, "ledger.json")
    return {e["name"]: e for e in (_read(fp).get("items") or []) if isinstance(e, dict) and e.get("name")} if os.path.isfile(fp) else {}


def is_b2b(rec, state):
    if isinstance(rec.get("b2b"), bool):
        return rec["b2b"]
    a = ((state or {}).get("answers") or {}).get("Q-aud-02")
    v = a.get("value") if isinstance(a, dict) else a
    vals = v if isinstance(v, list) else re.split(r"\s*[+,]\s*", str(v or ""))
    return any(x in WORK for x in vals)


def directions_problems(rec, state=None, users=None, ledger=None, positioning=None):
    """Every reason a directions file is not ready to show, as (level, text)."""
    out = []
    err = lambda t: out.append(("error", t))
    warn = lambda t: out.append(("warning", t))
    state, ledger = state or {}, ledger or {}
    rstat = (state.get("research") or {}).get("status")
    if rstat == "skipped":
        warn("the person skipped the research, so the directions are not checked against the category")
    else:
        ready = len([x for x in competitors(users) if table_ready(x)]) if users else 0
        if not users:
            err(f"no {FILE}: research first. The competitor table comes before any colour or direction")
        elif ready < TABLE_MIN:
            err(f"the competitor table has {ready} competitor(s) with a link, colours, type and a CTA shape; {TABLE_MIN} are needed first")
    if not positioning or positioning.get("status") != "confirmed":
        err("the positioning is not confirmed yet: research.py positioning draft, show it, then confirm")
    dirs = rec.get("directions") if isinstance(rec.get("directions"), list) else []
    if len(dirs) != N_DIRECTIONS:
        err(f"exactly {N_DIRECTIONS} directions, not {len(dirs)}")
    ids = [str(x.get("id") or "") for x in dirs if isinstance(x, dict)]
    if len(set(ids)) != len(dirs) or not all(ids):
        err("every direction needs its own id (A, B, C)")
    if rec.get("recommended") not in ids:
        err("recommended must be one of the directions' ids")
    elif not str(rec.get("why") or "").strip():
        warn("say why you recommend it (why)")
    fixed = [k for k in rec.get("fixed") or [] if k in AXES]
    for k in rec.get("fixed") or []:
        if k not in AXES:
            err(f"fixed {k!r} is not an axis ({', '.join(AXES)})")
    comp = {_norm(x["name"]): x for x in competitors(users)}
    comp_hosts = {_host(x.get("url")): x["name"] for x in competitors(users) if _host(x.get("url"))}
    comp_cols = [(x["name"], h) for x in competitors(users) for _, h in _colors(x) if oklch(h)[1] >= NEUTRAL_C]
    sigs = {}
    for dr in [x for x in dirs if isinstance(x, dict)]:
        for ref in dr.get("references") or []:
            if isinstance(ref, dict) and str(ref.get("signature") or "").strip():
                sigs[_norm(ref["signature"])] = ref.get("name") or "a reference"
    used_photos = {}
    for dr in [x for x in dirs if isinstance(x, dict)]:
        n = f"direction {dr.get('id') or '?'}"
        for f in ("name", "idea"):
            if not str(dr.get(f) or "").strip():
                err(f"{n} needs a {f}")
        for k, (label, allowed) in AXES.items():
            v = dr.get(k)
            if k == "type":
                if not all(_axis(dr, "type")):
                    err(f"{n} type needs a display and a text font")
                elif dr["type"].get("class") and dr["type"]["class"] not in TYPE_CLASSES:
                    err(f"{n} type class must be one of {', '.join(TYPE_CLASSES)}")
            elif v not in allowed:
                err(f"{n} {k} must be one of {', '.join(allowed)}")
        cols = dr.get("colors") if isinstance(dr.get("colors"), dict) else {}
        g, ink, acc = (norm_hex(cols.get(x)) for x in ("ground", "ink", "accent"))
        if not (g and ink and acc):
            err(f"{n} colors needs ground, ink and accent as hex")
        else:
            if contrast(ink, g) < 4.5:
                err(f"{n} ink {ink} on ground {g} is {contrast(ink, g):.2f}:1; text needs 4.5:1 (WCAG 1.4.3)")
            if dr.get("accent_use") != "none" and contrast(acc, g) < 3:
                err(f"{n} accent {acc} on ground {g} is {contrast(acc, g):.2f}:1; it needs 3:1 to read (WCAG 1.4.11)")
            if ground_kind(g) != dr.get("ground") and dr.get("ground") in GROUNDS:
                err(f"{n} says a {dr.get('ground')} ground, but {g} reads {ground_kind(g)}: the colour decides")
            for who, h in comp_cols:
                dist = distance(acc, h)
                if dist < NEAR_ERROR:
                    err(f"{n} accent {acc} is {who}'s colour {h}: a competitor's colour is their identity")
                elif dist < NEAR_WARN:
                    warn(f"{n} accent {acc} is close to {who}'s {h}; move it, or say why")
        refs = [x for x in dr.get("references") or [] if isinstance(x, dict)]
        if len(refs) < REFS_MIN:
            err(f"{n} needs at least {REFS_MIN} references: one reference makes a copy of it")
        for ref in refs:
            rn = ref.get("name") or "a reference"
            if not re.match(r"^https?://\S+$", str(ref.get("url") or "")):
                err(f"{n} reference {rn} needs the url you looked at")
            if not str(ref.get("takes") or "").strip():
                err(f"{n} reference {rn} needs takes: the principle taken (rhythm, scale, how a section works)")
            if not str(ref.get("signature") or "").strip():
                err(f"{n} reference {rn}: name its signature device (what stays theirs), so it is never used")
            who = next((c["name"] for k, c in comp.items() if k and (k == _norm(rn) or k in _norm(rn))), None) or comp_hosts.get(_host(ref.get("url")))
            if who:
                err(f"{n} reference {rn} is the competitor {who}: flag its conventions, never take from it")
        for dev in dr.get("devices") or []:
            hit = next((who for sg, who in sigs.items() if _same_device(sg, dev)), None)
            if hit:
                err(f"{n} uses {dev!r}, {hit}'s signature device: that is identity, not structure")
        if any(not isinstance(p, str) for p in dr.get("photos") or []):
            err(f"{n} photos must be names from {PHOTO_DIR}/ledger.json")
        photos = [p for p in dr.get("photos") or [] if isinstance(p, str)]
        if not photos:
            err(f"{n} needs licensed stock photos (2 to 4): illustrate.py photos search, then fetch or add")
        elif len(photos) < 2:
            warn(f"{n} shows one photo; two to four show the grade")
        for name in photos:
            e = ledger.get(name)
            if not e:
                err(f"{n} photo {name!r} is not in {PHOTO_DIR}/ledger.json")
                continue
            if e.get("verdict") == "blocked":
                err(f"{n} photo {name} is blocked by its licence ({e.get('licence')})")
            if e.get("status") == "rejected":
                err(f"{n} photo {name} was rejected ({e.get('note') or 'a real name or mark in the frame'})")
            elif e.get("brand_check") != "clear":
                err(f"{n} photo {name}: look at it for brand names and logos first (illustrate.py photos review {name} --brands none|found)")
            if any(AI_CAPTION.search(str(e.get(k) or "")) for k in ("caption", "alt", "credit_shown")):
                err(f"{n} photo {name} has an 'AI generated' caption or alt text; take it off the page and tell the person instead")
            if e.get("ai_generated"):
                warn(f"{n} photo {name} is AI-made: tell the person once; never caption it on the page")
            if e.get("grade") and dr.get("photo_grade") and e["grade"] != dr["photo_grade"]:
                warn(f"{n} photo {name} is graded {e['grade']}, the direction says {dr['photo_grade']}")
            used_photos.setdefault(name, []).append(dr.get("id"))
    for name, where in used_photos.items():
        if len(where) > 1:
            warn(f"photo {name} is in directions {', '.join(map(str, where))}: one photo per direction keeps them apart")
    good = [x for x in dirs if isinstance(x, dict)]
    varying = [k for k in AXES if k not in fixed]
    if fixed and len(varying) < MIN_VARYING:
        err(f"with {', '.join(fixed)} settled, only {len(varying)} axes are left to change; directions need {MIN_VARYING}")
    for k in fixed:
        if len({json.dumps(_axis(x, k)) for x in good}) > 1:
            err(f"{AXES[k][0]} is settled by the person (fixed): keep it the same in all three")
    for i, a in enumerate(good):
        for b in good[i + 1:]:
            same = [AXES[k][0].lower() for k in varying if _axis(a, k) == _axis(b, k) and _axis(a, k)]
            if same:
                err(f"directions {a.get('id')} and {b.get('id')} share the same {', '.join(same)}. Each direction changes ground, "
                    "type pairing, photo grade, accent use and layout rhythm; swapping the accent alone reads identical")
    cat = category(users) if users else {}
    top = next(iter(cat.get("accents") or {}), None)
    fams = [hue_family(norm_hex((x.get("colors") or {}).get("accent"))) for x in good if norm_hex((x.get("colors") or {}).get("accent"))]
    if top and top != "neutral" and len(fams) == N_DIRECTIONS and all(f == top for f in fams) and cat["accents"][top] >= 2:
        warn(f"all three accents are {top}, like most of the category; let one take a family nobody uses "
             f"({', '.join(cat['unused_accents']) or 'none free'})")
    if is_b2b(rec, state):
        rd = next((x for x in good if x.get("id") == rec.get("recommended")), None)
        if rd and rd.get("photo_grade") not in (None, "natural"):
            warn("B2B imagery defaults to natural light: recommend the natural direction, or say why not")
        for x in good:
            if x.get("photo_grade") == "low-key" and not str(x.get("grade_why") or "").strip():
                warn(f"direction {x.get('id')} is low-key (dark, moody): for B2B it can read dead. Add grade_why, or lighten it")
    return out


def _dir_inputs(eng, d, path=None):
    path = path or os.path.join(d, DIRECTIONS)
    rec = load(path)
    state = eng.merge_defaults(eng.load_state(d))
    return path, rec, state, _users(d), _photo_ledger(d), load_positioning(d)


def directions_check(eng, d, path=None, as_json=False):
    path, rec, state, users, ledger, pos = _dir_inputs(eng, d, path)
    ps = directions_problems(rec, state, users, ledger, pos)
    if as_json:
        print(json.dumps([{"level": l, "text": t} for l, t in ps], indent=2, ensure_ascii=False))
    else:
        errs = [t for l, t in ps if l == "error"]
        print(f"{path}: {len(rec.get('directions') or [])} direction(s), {len(errs)} error(s), {len(ps) - len(errs)} warning(s)")
        for l, t in ps:
            print(f"  {l}: {t}")
    return 1 if any(l == "error" for l, _ in ps) else 0


def _photo(e):
    return {"src": f"photos/{e.get('file')}", "title": e.get("title") or e["name"], "author": e.get("author") or "",
            "licence": e.get("licence") or "", "page": e.get("page") if _host(e.get("page")) else "", "credit": e.get("attribution") or "",
            "grade": e.get("grade") or "", "ai": bool(e.get("ai_generated")), "alt": e.get("alt") or ""}


def board_payload(rec, state, users, ledger, pos):
    """The direction-board template's od-data: the positioning, the category strip, three directions with their photos."""
    name = state.get("name") or "This product"
    cat = category(users) if users else {}
    dirs = []
    for dr in rec.get("directions") or []:
        if not isinstance(dr, dict):
            continue
        x = {k: dr.get(k) for k in ("id", "name", "idea", "ground", "type", "photo_grade", "accent_use", "rhythm", "colors", "cta",
                                     "references", "devices", "risks")}
        x["photos"] = [_photo(ledger[p]) for p in dr.get("photos") or [] if isinstance(p, str) and p in ledger]
        cols = dr.get("colors") if isinstance(dr.get("colors"), dict) else {}
        x["colors"] = {k: norm_hex(cols.get(k)) for k in ("ground", "ink", "accent")}
        x["references"] = [dict(r, url=r["url"] if _host(r.get("url")) else "") for r in dr.get("references") or [] if isinstance(r, dict)]
        dirs.append(x)
    ai = [f"{p['title']} (direction {x['id']})" for x in dirs for p in x["photos"] if p["ai"]]
    return {"title": f"{name}: three directions", "product": name,
            "subtitle": "Each direction changes the ground, the type, the photo grade, how the accent is used and the layout rhythm.",
            "positioning": positioning_lines(pos) if pos else [],
            "category": {"lines": category_lines(cat),
                         "swatches": [{"name": n, "hex": h} for n, h in (cat.get("accent_hex") or {}).items()]},
            "axes": [{"key": k, "label": v[0]} for k, v in AXES.items()], "fixed": rec.get("fixed") or [],
            "recommended": rec.get("recommended"), "why": rec.get("why") or "", "directions": dirs,
            "notes": ([f"Made with AI, so tell the person and keep it off the page: {', '.join(ai)}"] if ai else [])}


def directions_board(eng, d, path=None, open_=False):
    path, rec, state, users, ledger, pos = _dir_inputs(eng, d, path)
    ps = directions_problems(rec, state, users, ledger, pos)
    errs = [t for l, t in ps if l == "error"]
    if errs:
        print(f"No board: {len(errs)} problem(s) in {path}.")
        for t in errs:
            print(f"  error: {t}")
        return 1
    tpl = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "templates", "direction-board.html")
    with open(tpl, encoding="utf-8") as f:
        page = f.read()
    blob = json.dumps(board_payload(rec, state, users, ledger, pos), indent=1, ensure_ascii=False).replace("</", "<\\/")
    page, n = re.subn(r'(<script type="application/json" id="od-data">).*?(</script>)', lambda m: m.group(1) + "\n" + blob + "\n" + m.group(2),
                      page, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f"{tpl} has no od-data block")
    dest = os.path.join(d, BOARD)
    _write_text(dest, page)
    for l, t in ps:
        print(f"  {l}: {t}")
    print(f"wrote {dest}. Show it (an artifact, a screenshot or the file), recommend {rec.get('recommended')} with its reason, "
          "and ask for one pick. Their 'Copy my choice' lines start OD:direction.")
    if open_:
        import webbrowser
        webbrowser.open("file://" + os.path.abspath(dest))
    return 0


def directions_pick(eng, d, pick, remix=None, why=None, path=None):
    path, rec, state, users, ledger, pos = _dir_inputs(eng, d, path)
    errs = [t for l, t in directions_problems(rec, state, users, ledger, pos) if l == "error"]
    if errs:
        raise SystemExit(f"Fix {path} first ({len(errs)} error(s)): research.py directions check")
    by = {x.get("id"): x for x in rec.get("directions") or [] if isinstance(x, dict)}
    if pick not in by:
        raise SystemExit(f"{pick!r} is not a direction; pick one of {', '.join(by)}")
    mix = {}
    for item in remix or []:
        k, _, v = item.partition("=")
        if k not in AXES or v not in by:
            raise SystemExit(f"--remix takes <axis>=<id>, axis one of {', '.join(AXES)} and id one of {', '.join(by)} (got {item!r})")
        mix[k] = v
    dr = by[pick]
    val = lambda k: by[mix[k]].get(k) if k in mix else dr.get(k)
    col = lambda src, k: norm_hex(((by[src].get("colors") or {}) if isinstance(by[src].get("colors"), dict) else {}).get(k))
    g_from, a_from = mix.get("ground", pick), mix.get("accent_use", pick)  # the ground brings its ink; the accent use, its accent
    colors = {"ground": col(g_from, "ground"), "ink": col(g_from, "ink"), "accent": col(a_from, "accent")}
    if all(colors.values()):
        if contrast(colors["ink"], colors["ground"]) < 4.5 or (val("accent_use") != "none" and contrast(colors["accent"], colors["ground"]) < 3):
            raise SystemExit(f"That mix puts accent {colors['accent']} or ink {colors['ink']} on ground {colors['ground']} below the contrast "
                             "floors (4.5:1 text, 3:1 accent). Take the accent from the same direction as the ground, or pick another mix.")
    chosen = {"id": pick, "name": dr.get("name"), "remix": mix, "colors": colors, "why": (why or "").strip(), "date": _today(),
              "set_by": "chosen"}
    rec["chosen"] = chosen
    _write(path, rec)
    r = summary(state)
    r["direction"] = chosen
    state["research"] = r
    eng.dump_json(os.path.join(d, eng.STATE_FILE), state)
    eng.refresh_docs(d)
    print(f"Direction {pick} ({dr.get('name')}) chosen" + (f", with {', '.join(f'{k} from {v}' for k, v in mix.items())}" if mix else "") + ".")
    t = val("type") or {}
    print(f"  ground {_axis({'colors': colors, 'ground': val('ground')}, 'ground')}, type {t.get('display')} / {t.get('text')}, "
          f"photos {val('photo_grade')}, accent {val('accent_use')}, rhythm {val('rhythm')}, colours {json.dumps(colors)}")
    print("Next, in the main flow: confirm each value at its stage with the person (colour, type, imagery, layout), "
          "recording it with --set-by chosen. The direction is a starting point, not a set of answers.")
    return 0


def product_section(state):
    """PRODUCT.md "Users": the brief, up to five findings, the positioning and the chosen direction, and where the rest is.
    Never claims research that was not done."""
    r = summary(state)
    extra = []
    p = r.get("positioning") or {}
    if p.get("confirmed"):
        extra += ["", f"Positioning (confirmed {p['confirmed']}): for {p.get('for')}. Problem: {p.get('problem')} "
                      f"Claim: {p.get('claim')} Proof: {'; '.join(p.get('proof') or [])}."]
    dr = r.get("direction") or {}
    if dr.get("id"):
        extra += ["", f"Direction {dr['id']}, {dr.get('name')} (chosen {dr.get('date')}): `opendesigner/{BOARD}`."]
    return _users_section(r) + ("\n".join(extra) if extra else "")


def _users_section(r):
    st = r.get("status")
    if st == "done":
        lines = [f"Researched {r.get('date')}: {r.get('brief', '').strip()}", ""]
        lines += [f"- {h['text'].strip()} ({h.get('confidence')}, {h['id']})" for h in r.get("highlights") or []]
        rest = (r.get("findings") or 0) - len(r.get("highlights") or [])
        lines += ["", f"All {r.get('findings')} findings, their {r.get('sources')} sources and what they change: `opendesigner/{DOC}`"
                  + (f" ({rest} more there)." if rest > 0 else ".")]
        if r.get("conflicts"):
            lines += ["", "Open: " + " ".join(r["conflicts"])]
        return "\n".join(lines)
    if st == "skipped":
        return f"Not researched: {r.get('skipped_why')}"
    if st == "planned":
        return "Research planned, no findings saved yet (`opendesigner/research/plan.json`)."
    return "Not researched yet. The user research step (references/research.md) fills this in."


def status(d, state, as_json=False):
    r = summary(state)
    if as_json:
        print(json.dumps(r or {"status": "none"}, indent=2, ensure_ascii=False))
        return 0
    st = r.get("status") or "none"
    if st == "done":
        print(f"Users researched {r.get('date')}: {r.get('findings')} finding(s), {r.get('sources')} source(s). {os.path.join(d, DOC)}")
        new = [p for p in r.get("proposals") or [] if p.get("status") == "new"]
        if new:
            print("Not applied yet: " + ", ".join(p["question"] for p in new) + " (ask the person, then research add --accept).")
        age = age_days(r)
        if age is not None and age > STALE_DAYS:
            print(f"It is {age} days old: run it again.")
    elif st == "skipped":
        print(f"Skipped: {r.get('skipped_why')}")
    elif st == "planned":
        print(f"Planned {r.get('planned')}, no findings yet. When the research is done: engine.py research add <file>.")
    else:
        print("Not researched yet: engine.py research plan.")
    return 0


def reminder(state):
    """One line after sketch and build until the research is done or skipped; '' otherwise."""
    st = summary(state).get("status")
    if st in ("done", "skipped"):
        return ""
    if st == "planned":
        return "User research is planned but not saved yet: when the findings are ready, engine.py research add <file>."
    return ("Next, before zooming in: research who the users are, so the defaults fit them (references/research.md): "
            "engine.py research plan. Or skip it: engine.py research skip --why \"...\".")


# ------------------------------------------------------------------------------------------------ command line

def main(argv=None):
    """research.py's own commands, for the steps after the findings: the market table, the positioning and the directions.
    The findings themselves still go through engine.py research plan|check|add|skip|status."""
    import argparse
    import sys
    here = os.path.dirname(os.path.abspath(__file__))
    if here not in sys.path:
        sys.path.insert(0, here)
    import engine as eng
    ap = argparse.ArgumentParser(prog="research.py", description=main.__doc__)
    ap.add_argument("--dir", default=None, help=f"state directory (default ./{eng.DEFAULT_DIR})")
    sub = ap.add_subparsers(dest="cmd", required=True)
    q = sub.add_parser("market", help="the competitor table, what the category does and the industry benchmark: show it before any colour")
    q.add_argument("--json", action="store_true")
    q = sub.add_parser("positioning", help="draft the positioning from the research, confirm it with the person, or show it")
    ps = q.add_subparsers(dest="sub", required=True)
    ps.add_parser("draft", help="draft it from users.json and the project; the proof is left to the person")
    c = ps.add_parser("confirm", help="record the person's yes, with their words for any part")
    c.add_argument("--for", dest="who")
    c.add_argument("--problem")
    c.add_argument("--claim")
    c.add_argument("--proof", action="append", help="one proof point; repeat for more")
    ps.add_parser("show")
    q = sub.add_parser("directions", help="check the three directions, render their board, or record the pick")
    ds = q.add_subparsers(dest="sub", required=True)
    c = ds.add_parser("check")
    c.add_argument("file", nargs="?")
    c.add_argument("--json", action="store_true")
    c = ds.add_parser("board", help=f"write {BOARD} from the direction-board template")
    c.add_argument("file", nargs="?")
    c.add_argument("--open", action="store_true")
    c = ds.add_parser("pick")
    c.add_argument("id")
    c.add_argument("--remix", action="append", help="take one axis from another direction: <axis>=<id>")
    c.add_argument("--why")
    c.add_argument("--file")
    a = ap.parse_args(argv)
    d = a.dir or eng.DEFAULT_DIR
    if a.cmd == "market":
        return cmd_market(d, a.json)
    if a.cmd == "positioning":
        if a.sub == "draft":
            positioning_draft(eng, d)
            return 0
        if a.sub == "confirm":
            return positioning_confirm(eng, d, a.who, a.problem, a.claim, a.proof)
        p = load_positioning(d)
        if not p:
            print("No positioning yet: research.py positioning draft.")
            return 0
        print(f"Positioning ({p.get('status')}{', ' + p['confirmed'] if p.get('confirmed') else ''}):")
        for line in positioning_lines(p):
            print("  " + line)
        return 0
    if a.sub == "check":
        return directions_check(eng, d, a.file, a.json)
    if a.sub == "board":
        return directions_board(eng, d, a.file, a.open)
    return directions_pick(eng, d, a.id, a.remix, a.why, a.file)


if __name__ == "__main__":
    raise SystemExit(main())
