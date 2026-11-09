#!/usr/bin/env python3
"""OpenDesigner journey tracker: a private log of the steps a person takes, and a report on how to make them fewer.

Standard library only, Python 3.10+ (BRIEF requirements 18 and 19). Two separate consents live in state.json:
    profile.tracking       "on" | "off"; missing means ask once        keep a local log in opendesigner/journey/
    profile.share_reports  "always" | "ask" | "never"; missing means not asked yet
                                                                       send an anonymous report to the maintainers
The local log never leaves the project. `share` sends only the allowlisted payload described by
references/report.schema.json, and only with the person's yes.

Commands (run from the person's project; files live in ./opendesigner/journey/ unless --dir is given):
    journey.py consent [on|off] [--forget] [--where local|web]   show or set local logging (--forget deletes the log)
    journey.py log <event> [--step ID] [--level L] [--area A] [--how H] [--secs N] [--turns N]
                   [--signal S] [--reason R] [--kind K] [--count N] [--note "..."] [--session auto]
    journey.py events                                 every event and value, in plain words
    journey.py report [--json]                        write journey/JOURNEY.md and print a short summary
    journey.py level-line <level>                     "You took N steps; the shortest path is M." when worth saying
    journey.py export --anon [--out FILE|-]           the anonymous report, to attach to a feedback issue
    journey.py share-consent [always|ask|never] [--details]   print the short sharing question (or the full facts),
                                                      or record the answer
    journey.py share [--dry-run] [--yes] [--host H]   send the anonymous report (or keep it in journey/outbox/)
    journey.py aggregate <files or folders...> --out FILE   one report across many reports or logs (maintainers)

Files in opendesigner/journey/: events.jsonl (append-only), JOURNEY.md, anonymous-report.json, pending.json,
shared.json, outbox/, and a .gitignore that keeps all of it out of git.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import re
import secrets
import shutil
import sys
import urllib.request

TOOL_VERSION = "1.0.0"
REPORT_SCHEMA = "opendesigner-report/1"
HERE = os.path.dirname(os.path.abspath(__file__))
SKILL_ROOT = os.path.dirname(HERE)
REFERENCES = os.path.join(SKILL_ROOT, "references")
DEFAULT_DIR = "opendesigner"
IDLE_MINUTES = 30          # a new session starts after this long without an event
DUPLICATE_SECS = 120       # the engine and the model may both log one answer; the second is ignored
MAX_STEP_SECS = 1800       # one step never counts for more than 30 minutes
MAX_SECS_ITEMS = 20        # timings kept per question in a report
POST_TIMEOUT = 5
MAX_REPORT_BYTES = 16384   # server/telemetry/worker.js refuses anything bigger
LEVELS = ["sketch", "broad", "defined", "detailed"]
WEIGHT_SECS = {"high": 60, "medium": 30, "low": 15}   # pacing.json _about: planned time per question [inferred]
ASKED_TOGETHER = {"Q-scope-06": "Q-scope-01", "Q-brand-03": "Q-color-01"}   # zoom.md level 0, questions 1 and 5: one message each

# The texts below are shown word for word, and rules.md, docs/PRIVACY.md and docs/JOURNEY-TRACKER.md quote them
# (test_journey.py ConsentTexts checks that they match).
# The log question is host-aware: "on this computer" only when the scripts run on the person's own computer.
CONSENT_QUESTIONS = {
    "local": "I keep a private log of your steps on this computer so I can make this faster for you. OK?",
    "web": "I keep a private log of your steps in your project files so I can make this faster for you. OK?",
}
CONSENT_QUESTION = CONSENT_QUESTIONS["local"]
# The sharing ask: short, once, at the end of the first session. The full facts are one reply away ("details").
SHARE_CONSENT = """\
Can I send the OpenDesigner team an anonymous report of which steps were slow or confusing, so they can make them faster?
It never includes your answers, names, colors, files or anything you typed. Share every time, ask me each time, or don't share?
Say "details" to see exactly what is sent."""
SHARE_DETAILS = """\
Why: it shows the OpenDesigner team where people get stuck, so the steps get faster for everyone.
What is sent: which questions came up, how long each took (to 5 seconds), how you answered (kept the default, picked an option and so on), skips, stops and help requests, plus the OpenDesigner version, the AI tool and the week.
Never sent: your answers, names, colors, brand, files, paths, links, notes or anything you typed. No ID ties reports to you or your device.
Where it goes: a small server run by the OpenDesigner maintainers. Until it is set up, reports wait in your project files and nothing is sent.
How long: reports are kept 12 months; after that only the totals stay.
To see the exact report first, say "show me".
Choose: share every time · ask me each time · don't share. To change your mind later, say "stop sharing" or "start sharing"."""
SHARE_ASK = 'Send this session\'s anonymous report? Say "show me" to see it first.'   # when share_reports is "ask"
# Messages that are not questionnaire questions. Log `step_shown --step <moment>` before them, so help and frustration
# about them are not blamed on the last question. They never reach the anonymous report (not public question ids).
MOMENTS = {"consent.share": "the question about sharing reports", "result": "a result or preview",
           "offer": "the offer to stop or zoom in", "finish.agents": "the question about the AGENTS.md note",
           "finish.feedback": "the offer to send feedback"}
BETWEEN = "(between steps)"   # help or frustration logged when no step was on screen
ATTACHED = ("help", "frustration", "speed_mode")   # these belong to the step on screen when --step is not given
UNSEEN_REASONS = ("rule", "known")   # skipped without being shown: not a step the person took

EVENTS = {
    "session_start": "They started working with OpenDesigner. Logged by itself when a new session begins.",
    "session_end": "They stopped on purpose: they said stop, or the finish steps ran.",
    "step_shown": "A question or screen was put in front of them.",
    "step_answered": "They answered it. --how says how; --secs and --turns are optional.",
    "step_skipped": "They skipped it, or a rule did. --reason says why.",
    "step_changed": "They changed an answer they gave earlier.",
    "help": "They asked for help. --kind says which kind.",
    "frustration": "They seemed stuck or annoyed. --signal says what showed it; --note is at most 12 words, never personal.",
    "error": "The engine reported errors, for example from validate. --count says how many.",
    "level_complete": "A zoom level finished. --level says which.",
    "export": "Files were exported. --kind is the format.",
    "review": "The end-of-implementation review ran.",
    "feedback_filed": "A gap, bug, confusing step or idea was recorded. --kind says which.",
    "speed_mode": "They asked to go faster.",
}
HOW = {"default": "kept the recommended default", "option": "picked one of the options", "free": "gave their own answer",
       "delegated": "said 'you choose'", "reference": "took it from a reference they shared"}
SIGNALS = {"said": "said it outright ('this is annoying')", "repeat_question": "asked the same thing again",
           "undo": "undid or reverted a choice", "rage_skip": "skipped several steps in a row", "just_do_it": "said 'just do it'",
           "error_loop": "hit the same error again", "slow": "said it is slow or taking too long"}
REASONS = {"person": "they said skip", "rule": "a skip rule said it does not apply",
           "known": "their files or earlier words already answered it",
           "speed": "skipped to go faster", "later": "parked for later"}
HELP_KINDS = {"explain": "asked what something means", "voice_switch": "asked for the designer or engineer wording",
              "glossary": "looked up a term", "example": "asked for an example"}
FEEDBACK_KINDS = ["gap", "bug", "confusing", "idea"]
EXPORT_FORMATS = ["css", "tailwind", "figma", "paper", "swift", "compose", "dtcg", "all"]
KINDS = {"help": list(HELP_KINDS), "feedback_filed": FEEDBACK_KINDS, "export": EXPORT_FORMATS}
SHARE_CHOICES = {"always": "share every time", "ask": "ask me each time", "never": "don't share"}
HOSTS = ["claude-code", "claude-ai", "claude-desktop", "chatgpt", "codex", "cursor", "copilot", "gemini-cli", "other", "unknown"]
HOW_FROM_SET_BY = {"chosen": "option", "confirmed_default": "default", "auto_default": "default", "assumed": "default",
                   "delegated": "delegated", "reference": "reference", "asset": "free"}   # engine --set-by to --how
COUNT_FIELDS = ["shown", "answered", "skipped", "changed", "dropped", "turns", "help", "errors", "faster"]
RX_PRIVATE = re.compile(r"\S+@\S+|\S*://\S+|\S*[/\\]\S+|#[0-9a-fA-F]{3,8}\b|\+?\d[\d\s().-]{5,}\d")


# =============================================================================================
# Small utilities
# =============================================================================================

def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_text(path, text):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def dump_json(path, data):
    write_text(path, json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def now_local():
    return _dt.datetime.now().astimezone().replace(microsecond=0)


def parse_ts(s):
    return _dt.datetime.fromisoformat(s)


def bump(dct, key, n=1):
    dct[key] = dct.get(key, 0) + n


def num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) and v >= 0 else None


def r5(secs):
    """Timings leave the computer rounded to 5 seconds."""
    return int(5 * round(float(secs) / 5))


def jpath(d, *parts):
    return os.path.join(d, "journey", *parts)


_REF = {}


def ref(name):
    if name not in _REF:
        p = os.path.join(REFERENCES, name)
        _REF[name] = read_json(p) if os.path.exists(p) else {}
    return _REF[name]


def questions():
    if "_q" not in _REF:
        _REF["_q"] = {q["id"]: q for q in ref("questions.json").get("questions", [])}
    return _REF["_q"]


def areas():
    return {a["id"]: a for a in ref("pacing.json").get("areas", [])}


def q_level(step):
    z = (questions().get(step) or {}).get("zoom")
    return LEVELS[z] if isinstance(z, int) and 0 <= z < len(LEVELS) else None


def od_version():
    try:
        with open(os.path.join(SKILL_ROOT, "SKILL.md"), encoding="utf-8") as f:
            m = re.search(r'^\s*version:\s*"?(\d+\.\d+\.\d+)"?', f.read(), re.M)
        return m.group(1) if m else "0.0.0"
    except OSError:
        return "0.0.0"


def detect_host():
    return "claude-code" if os.environ.get("CLAUDECODE") else "unknown"


def detect_where():
    """'local' when the scripts clearly run on the person's own computer; otherwise 'web', whose wording is always true."""
    return "local" if os.environ.get("CLAUDECODE") and not os.environ.get("CLAUDE_CODE_REMOTE") else "web"


def consent_question(where=None):
    return CONSENT_QUESTIONS.get(where or detect_where(), CONSENT_QUESTIONS["web"])


def norm_level(v):
    if v in (None, ""):
        return None
    v = str(v).strip().lower()
    if v.isdigit() and int(v) < len(LEVELS):
        return LEVELS[int(v)]
    if v in LEVELS:
        return v
    raise ValueError(f"--level is one of {', '.join(LEVELS)} (or 0-3)")


def clean_note(text, words=12):
    """At most 12 words, with emails, links, paths, colors and phone-like numbers removed."""
    text = RX_PRIVATE.sub("[removed]", " ".join(str(text).split()))
    return " ".join(text.split()[:words])


# =============================================================================================
# Consent (two separate answers in state.json -> profile)
# =============================================================================================

def profile(d):
    sp = os.path.join(d, "state.json")
    return (read_json(sp).get("profile") or {}) if os.path.exists(sp) else {}


def set_profile(d, key, value):
    """Write one profile key and leave the rest of state.json as it was."""
    sp = os.path.join(d, "state.json")
    if not os.path.exists(sp):
        raise SystemExit(f"no state at {sp}; run `engine.py init` first")
    state = read_json(sp)
    state.setdefault("profile", {})[key] = value
    dump_json(sp, state)


def set_tracking(d, on, forget=False):
    set_profile(d, "tracking", "on" if on else "off")
    if forget:
        shutil.rmtree(jpath(d), ignore_errors=True)


def set_share(d, choice):
    if choice not in SHARE_CHOICES:
        raise ValueError(f"choose one of: {', '.join(SHARE_CHOICES)}")
    set_profile(d, "share_reports", choice)
    if choice == "never":  # unsent reports go too
        shutil.rmtree(jpath(d, "outbox"), ignore_errors=True)
        if os.path.exists(jpath(d, "pending.json")):
            os.remove(jpath(d, "pending.json"))


# =============================================================================================
# Logging
# =============================================================================================

def read_events(path):
    if not os.path.exists(path):
        return []
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            try:
                out.append(json.loads(line))
            except ValueError:
                continue  # an empty or half-written line
    return out


def check_event(event, data):
    if event not in EVENTS:
        raise ValueError(f"unknown event {event!r}; one of: {', '.join(EVENTS)}")
    for key, allowed in (("how", HOW), ("signal", SIGNALS), ("reason", REASONS)):
        if key in data and data[key] not in allowed:
            raise ValueError(f"--{key} is one of: {', '.join(allowed)}")
    if "kind" in data and event in KINDS and data["kind"] not in KINDS[event]:
        raise ValueError(f"--kind for {event} is one of: {', '.join(KINDS[event])}")
    if event == "frustration" and "signal" not in data:
        raise ValueError("frustration needs --signal")
    for key in ("secs", "turns", "count"):
        if key in data and num(data[key]) is None:
            raise ValueError(f"--{key} is a number, 0 or more")


HOUSEKEEPING = ("review", "export", "feedback_filed", "error")   # engine events that may run just after session_end


def current_session(events, event, now):
    """The session in progress, or a new one after session_end, after IDLE_MINUTES quiet, or on session_start.
    Engine housekeeping right after session_end (a final review or export) stays in the session that just ended."""
    last = events[-1] if events else None
    if not last or event == "session_start" or now - parse_ts(last["ts"]) > _dt.timedelta(minutes=IDLE_MINUTES):
        last = None
    else:
        person = next((e for e in reversed(events) if e.get("event") not in HOUSEKEEPING), None)
        if person and person.get("event") == "session_end" and event not in HOUSEKEEPING:
            last = None
    if last:
        return last["session"], False
    used = {e.get("session") for e in events}
    n = len(used) + 1
    while f"S{n:03d}" in used:
        n += 1
    return f"S{n:03d}", True


def advance(current, e):
    """The step on screen after event e: set by step_shown; cleared when that step is answered or skipped, when a
    level completes, and when a session starts or ends. Help and frustration without --step belong to it."""
    ev, step = e.get("event"), e.get("step")
    if ev == "step_shown" and step:
        return step
    if ev in ("step_answered", "step_skipped") and step == current or ev in ("level_complete", "session_start", "session_end"):
        return None
    return current


def current_step(events, session):
    cur = None
    for e in events:
        if e.get("session") == session:
            cur = advance(cur, e)
    return cur


def log(d, event, step=None, level=None, area=None, session="auto", now=None, **data):
    """Append one event and return it; None when local logging is not on. Raises ValueError on a bad event.
    Help, frustration and speed_mode without --step or --area are stamped with the step on screen, if any."""
    if profile(d).get("tracking") != "on":
        return None
    data = {k: v for k, v in data.items() if v is not None}
    check_event(event, data)
    if "note" in data:
        data["note"] = clean_note(data["note"])
    if "kind" in data and event not in KINDS:
        data["kind"] = re.sub(r"[^a-z0-9_-]", "", str(data["kind"]).lower())[:32]
    now = now or now_local()
    path = jpath(d, "events.jsonl")
    events = read_events(path)
    fresh = False
    if session in (None, "", "auto"):
        session, fresh = current_session(events, event, now)
    if event in ATTACHED and not step and not area and not fresh:
        step = current_step(events, session)
    q = questions().get(step or "")
    level = norm_level(level) or q_level(step)
    area = area or (q or {}).get("area")
    recs = []
    if fresh and event != "session_start":
        recs.append({"ts": now.isoformat(), "session": session, "event": "session_start", "step": None, "level": None,
                     "area": None, "data": {"auto": True}})
    recs.append({"ts": now.isoformat(), "session": session, "event": event, "step": step, "level": level, "area": area, "data": data})
    os.makedirs(jpath(d), exist_ok=True)
    if not os.path.exists(jpath(d, ".gitignore")):
        write_text(jpath(d, ".gitignore"), "# Private journey log (journey.py): keep it out of git.\n*\n")
    with open(path, "a", encoding="utf-8", newline="\n") as f:
        f.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in recs)
    return recs[-1]


def record(d, event, **kw):
    """For other tools such as engine.py: log, and never raise or print. A journey problem must not stop design work."""
    try:
        return log(d, event, **kw)
    except Exception:  # noqa: BLE001 (deliberate: the tracker is optional)
        return None


def how_for(qid, value, set_by="chosen"):
    """How an engine answer was given, for step_answered: a value outside the question's options is a free answer."""
    how = HOW_FROM_SET_BY.get(set_by, "option")
    opts = [o.get("v") for o in (questions().get(qid) or {}).get("options") or []]
    if how == "option" and opts and not all(v in opts for v in (value if isinstance(value, list) else [value])):
        return "free"
    return how


# =============================================================================================
# Summary: one person's numbers (the anonymous payload and the aggregate keep the same shape)
# =============================================================================================

def new_stats(runs=1, level=None, area=None):
    return {"runs": runs, "level": level, "area": area, **{k: 0 for k in COUNT_FIELDS},
            "how": {}, "signals": {}, "secs": [], "help_kinds": {}, "reasons": {}, "notes": []}


def summarize(events, now=None):
    now = now or now_local()
    steps, sessions, counts, done, dropoffs = {}, {}, {}, {}, []
    secs_total = 0.0

    def st(step, e):
        s = steps.setdefault(step, new_stats())
        s["level"] = s["level"] or (e.get("level") if e.get("level") in LEVELS else None) or q_level(step)
        s["area"] = s["area"] or e.get("area") or (questions().get(step) or {}).get("area")
        return s

    for e in events:
        if isinstance(e, dict) and e.get("event") in EVENTS and e.get("ts"):
            sessions.setdefault(str(e.get("session")), []).append(e)
    last_sid = list(sessions)[-1] if sessions else None
    for sid, evs in sessions.items():
        times = [parse_ts(e["ts"]) for e in evs]
        secs_total += (times[-1] - times[0]).total_seconds()
        open_, answered_at, current, last_shown, last_done, ended = {}, {}, None, None, None, False
        unseen = set()  # skipped by a rule or already known: never put in front of the person
        for e, ts in zip(evs, times):
            ev, step = e["event"], e.get("step")
            data = e.get("data") if isinstance(e.get("data"), dict) else {}
            bump(counts, ev)
            current = advance(current, e)
            if ev == "step_shown" and step:
                for v in open_.values():
                    v["until"] = v["until"] or ts
                st(step, e)["shown"] += 1
                open_[step] = {"t": ts, "until": None, "help": 0}
                unseen.discard(step)
                last_shown = ts
            elif ev in ("step_answered", "step_skipped") and step:
                s = st(step, e)
                prev = answered_at.get(step)
                if step not in open_ and prev and (ts - prev).total_seconds() < DUPLICATE_SECS:
                    continue
                v = open_.pop(step, None)
                if ev == "step_skipped" and data.get("reason") in UNSEEN_REASONS and v is None:
                    unseen.add(step)
                elif v is None and step not in ASKED_TOGETHER and step not in unseen:
                    s["shown"] += 1  # answered without a logged step_shown: it was still a step
                secs = num(data.get("secs"))
                if secs is None and v:
                    secs = ((v["until"] or ts) - v["t"]).total_seconds()
                if secs is not None:
                    s["secs"].append(round(min(secs, MAX_STEP_SECS)))
                turns = num(data.get("turns"))
                s["turns"] += int(turns) - 1 if turns and turns >= 1 else (v["help"] if v else 0)
                if ev == "step_answered":
                    s["answered"] += 1
                    if data.get("how") in HOW:
                        bump(s["how"], data["how"])
                else:
                    s["skipped"] += 1
                    if data.get("reason") in REASONS:
                        bump(s["reasons"], data["reason"])
                answered_at[step] = ts
            elif ev == "step_changed" and step:
                st(step, e)["changed"] += 1
            elif ev in ATTACHED or ev == "error":
                if step:
                    target, src = step, e
                elif ev in ATTACHED and e.get("area"):
                    target, src = f"area:{e['area']}", {"area": e["area"]}  # about a whole area, not one step
                elif current:
                    target, src = current, e  # no step given: the step on screen (logs made before steps were stamped)
                elif ev in ATTACHED:
                    target, src = BETWEEN, {}  # nothing on screen: never blame the last question
                else:
                    continue
                s = st(target, src)
                if ev == "help":
                    s["help"] += 1
                    if data.get("kind") in HELP_KINDS:
                        bump(s["help_kinds"], data["kind"])
                    if target in open_:
                        open_[target]["help"] += 1
                elif ev == "frustration" and data.get("signal") in SIGNALS:
                    bump(s["signals"], data["signal"])
                    if data.get("note"):
                        s["notes"].append(clean_note(data["note"]))
                elif ev == "speed_mode":
                    s["faster"] += 1
                elif ev == "error":
                    s["errors"] += int(num(data.get("count")) or 1)
            elif ev == "level_complete" and e.get("level") in LEVELS:
                done[e["level"]] = 1
                last_done = ts
            elif ev == "session_end":
                ended = True
        finished = ended or (last_done is not None and (last_shown is None or last_done >= last_shown))
        over = sid != last_sid or (now - times[-1]).total_seconds() > IDLE_MINUTES * 60
        if over and not finished:  # left mid-step: every step still on screen is a drop-off
            for step, v in open_.items():
                steps[step]["dropped"] += 1
                dropoffs.append({"session": sid, "step": step, "at": v["t"].isoformat()})
    return {"runs": 1, "sessions": len(sessions), "secs_total": round(secs_total), "levels": level_totals(steps, done),
            "events": counts, "steps": steps, "dropoffs": dropoffs}


def level_totals(steps, done):
    """Per zoom level: steps taken (every time a step was shown, plus extra turns) against the fewest possible
    (one message per question reached), the planned questions and minutes (pacing.json), and seconds spent."""
    out = {}
    for i, lvl in enumerate(LEVELS):
        rows = {k: s for k, s in steps.items() if s["level"] == lvl}
        if not rows and not done.get(lvl):
            continue
        reached = {s["area"] for s in rows.values()}
        plan = [a["levels"][str(i)] for a in areas().values()
                if str(i) in a.get("levels", {}) and (i < 2 or a["id"] in reached)]  # levels 2-3: only areas zoomed into
        out[lvl] = {"reached": 1, "completed": done.get(lvl, 0),
                    "steps_taken": sum(s["shown"] + s["turns"] for k, s in rows.items() if k not in ASKED_TOGETHER),
                    "fewest": sum(1 for k, s in rows.items() if s["shown"] and k not in ASKED_TOGETHER),
                    "planned": sum(len([q for q in p["questions"] if q not in ASKED_TOGETHER]) for p in plan),
                    "secs": round(sum(sum(s["secs"]) for s in rows.values())),
                    "planned_min": sum(p["minutes"] for p in plan)}
    return out


# =============================================================================================
# The anonymous report: an allowlist, nothing else (references/report.schema.json)
# =============================================================================================

def payload(sm, host="unknown", report_id=None, today=None):
    """Only public question ids, enums, counts and timings rounded to 5 s. No answers, notes, names, colors, paths,
    project names, links, timezone or lasting ids: the report id is new and random every time."""
    y, w, _ = (today or _dt.date.today()).isocalendar()
    out = {"schema": REPORT_SCHEMA, "report_id": report_id or secrets.token_hex(8), "version": od_version(),
           "host": host if host in HOSTS else "unknown", "week": f"{y}-W{w:02d}", "sessions": int(sm["sessions"]),
           "secs_total": r5(sm["secs_total"]), "levels": {}, "events": {}, "questions": {}}
    for lvl, L in sm["levels"].items():
        if lvl in LEVELS:
            out["levels"][lvl] = {"completed": int(bool(L["completed"])), "steps_taken": int(L["steps_taken"]),
                                  "fewest": int(L["fewest"]), "planned": int(L["planned"]), "secs": r5(L["secs"]),
                                  "planned_min": int(L["planned_min"])}
    out["events"] = {ev: int(n) for ev, n in sm["events"].items() if ev in EVENTS}
    for qid, s in sorted(sm["steps"].items()):
        if qid not in questions():
            continue
        row = {k: int(s[k]) for k in COUNT_FIELDS if s.get(k)}
        how = {k: int(n) for k, n in s["how"].items() if k in HOW}
        sig = {k: int(n) for k, n in s["signals"].items() if k in SIGNALS}
        secs = [min(r5(x), MAX_STEP_SECS) for x in s["secs"]][:MAX_SECS_ITEMS]
        row.update({k: v for k, v in (("how", how), ("signals", sig), ("secs", secs)) if v})
        if row:
            out["questions"][qid] = row
    if len(json.dumps(out, separators=(",", ":"))) > MAX_REPORT_BYTES:  # a very long run: timings go first
        for row in out["questions"].values():
            row.pop("secs", None)
    return out


def validate(value, schema, root=None, path="$"):
    """A tiny JSON Schema check for the keywords report.schema.json uses. Returns a list of problems."""
    root = root or schema
    if "$ref" in schema:
        node = root
        for part in schema["$ref"].lstrip("#/").split("/"):
            node = node[part]
        return validate(value, node, root, path)
    kinds = {"object": dict, "array": list, "string": str, "boolean": bool}
    t = schema.get("type")
    isnum = isinstance(value, (int, float)) and not isinstance(value, bool)
    if t == "integer" and not (isnum and float(value).is_integer()) or t == "number" and not isnum \
            or t in kinds and not isinstance(value, kinds[t]):
        return [f"{path}: expected {t}"]
    errs = []
    if "const" in schema and value != schema["const"]:
        errs.append(f"{path}: must be {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        errs.append(f"{path}: not an allowed value")
    if isinstance(value, str):
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errs.append(f"{path}: does not match {schema['pattern']}")
        if len(value) > schema.get("maxLength", len(value)):
            errs.append(f"{path}: too long")
    if isnum:
        if value < schema.get("minimum", value) or value > schema.get("maximum", value):
            errs.append(f"{path}: out of range")
        if "multipleOf" in schema and value % schema["multipleOf"]:
            errs.append(f"{path}: not a multiple of {schema['multipleOf']}")
    if isinstance(value, list):
        if len(value) > schema.get("maxItems", len(value)):
            errs.append(f"{path}: too many items")
        for i, v in enumerate(value):
            errs += validate(v, schema.get("items", {}), root, f"{path}[{i}]")
    if isinstance(value, dict):
        errs += [f"{path}: missing {k}" for k in schema.get("required", []) if k not in value]
        if len(value) > schema.get("maxProperties", len(value)):
            errs.append(f"{path}: too many keys")
        props, extra = schema.get("properties", {}), schema.get("additionalProperties", True)
        for k, v in value.items():
            if "propertyNames" in schema:
                errs += validate(k, schema["propertyNames"], root, f"{path}.<key {k!r}>")
            if k in props:
                errs += validate(v, props[k], root, f"{path}.{k}")
            elif extra is False:
                errs.append(f"{path}: key {k!r} is not allowed")
            elif isinstance(extra, dict):
                errs += validate(v, extra, root, f"{path}.{k}")
    return errs


def report_schema():
    return ref("report.schema.json")


# =============================================================================================
# Sharing (requirement 19): only with consent, never through the person's GitHub account
# =============================================================================================

def post(url, data):
    if not (url.startswith("https://") or re.match(r"^http://(localhost|127\.0\.0\.1)(:\d+)?/", url)):
        return False
    req = urllib.request.Request(url, data=json.dumps(data, separators=(",", ":")).encode("utf-8"), method="POST",
                                 headers={"Content-Type": "application/json", "User-Agent": "opendesigner-journey"})
    try:
        with urllib.request.urlopen(req, timeout=POST_TIMEOUT) as r:
            return 200 <= r.status < 300
    except (OSError, ValueError):
        return False


def share(d, dry_run=False, yes=False, host=None, now=None):
    """Returns (status, payload). Status: nothing, dry_run, not_asked, off, needs_yes, sent, outbox, queued."""
    events = read_events(jpath(d, "events.jsonl"))
    start = read_json(jpath(d, "shared.json")).get("lines", 0) if os.path.exists(jpath(d, "shared.json")) else 0
    if len(events) <= start:
        return "nothing", None
    pend = read_json(jpath(d, "pending.json")) if os.path.exists(jpath(d, "pending.json")) else {}
    if pend.get("lines") == len(events) and (host is None or pend["payload"]["host"] == host):
        p = pend["payload"]  # the exact report the person was shown
    else:
        p = payload(summarize(events[start:], now), host or detect_host())
    errs = validate(p, report_schema())
    if errs:
        raise ValueError("report failed its schema: " + "; ".join(errs[:3]))
    if dry_run:
        dump_json(jpath(d, "pending.json"), {"lines": len(events), "payload": p})
        return "dry_run", p
    prof = profile(d)
    choice = prof.get("share_reports")
    if choice not in SHARE_CHOICES:
        return "not_asked", p
    if choice == "never":
        return "off", p
    if choice == "ask" and not yes:
        return "needs_yes", p
    dump_json(jpath(d, "shared.json"), {"lines": len(events)})
    if os.path.exists(jpath(d, "pending.json")):
        os.remove(jpath(d, "pending.json"))
    dump_json(jpath(d, "outbox", p["report_id"] + ".json"), p)
    url = os.environ.get("OPENDESIGNER_REPORTS_URL") or prof.get("reports_url")
    if not url:
        return "outbox", p
    sent = 0
    for fn in sorted(os.listdir(jpath(d, "outbox"))):
        if not post(url, read_json(jpath(d, "outbox", fn))):
            break
        os.remove(jpath(d, "outbox", fn))
        sent += 1
    return ("sent" if not os.path.exists(jpath(d, "outbox", p["report_id"] + ".json")) else "queued"), p


# =============================================================================================
# Aggregate: many anonymous reports (or raw logs) into one
# =============================================================================================

def merge(reports):
    out = {"runs": 0, "sessions": 0, "secs_total": 0, "levels": {}, "events": {}, "steps": {}, "hosts": {}, "versions": {}}
    for p in reports:
        out["runs"] += 1
        out["sessions"] += p["sessions"]
        out["secs_total"] += p["secs_total"]
        bump(out["hosts"], p["host"])
        bump(out["versions"], p["version"])
        for ev, n in p["events"].items():
            bump(out["events"], ev, n)
        for lvl, L in p["levels"].items():
            t = out["levels"].setdefault(lvl, {"reached": 0, "completed": 0, "steps_taken": 0, "fewest": 0, "planned": 0, "secs": 0,
                                               "planned_min": 0})
            t["reached"] += 1
            for k, v in L.items():
                t[k] += v
        for qid, row in p["questions"].items():
            s = out["steps"].setdefault(qid, new_stats(0, q_level(qid), (questions().get(qid) or {}).get("area")))
            s["runs"] += 1
            for k, v in row.items():
                if k == "secs":
                    s["secs"] += v
                elif isinstance(v, dict):
                    for kk, n in v.items():
                        bump(s[k], kk, n)
                else:
                    s[k] += v
    return out


def load_reports(paths, now=None):
    """Reports from files or folders: report JSON, a list of them, a `wrangler d1 execute --json` export, or events.jsonl.
    Returns (unique reports, number skipped because they failed the schema)."""
    found, skipped = [], 0
    files = []
    for p in paths:
        if os.path.isdir(p):
            files += sorted(os.path.join(r, f) for r, _, fs in os.walk(p) for f in fs if f.endswith((".json", ".jsonl")))
        else:
            files.append(p)
    for fp in files:
        if fp.endswith(".jsonl"):
            events = read_events(fp)
            items = [payload(summarize(events, now))] if events else []
        else:
            try:
                data = read_json(fp)
            except ValueError:
                continue
            items = data if isinstance(data, list) else [data]
            flat = []
            for it in items:
                for row in it["results"] if isinstance(it, dict) and isinstance(it.get("results"), list) else [it]:  # D1 export
                    if isinstance(row, dict) and "payload" in row:  # a stored row: {"payload": "<report JSON>"}
                        row = json.loads(row["payload"]) if isinstance(row["payload"], str) else row["payload"]
                    flat.append(row)
            items = [it for it in flat if isinstance(it, dict) and it.get("schema") == REPORT_SCHEMA]
        for it in items:
            if validate(it, report_schema()):
                skipped += 1
            elif it["report_id"] not in {r["report_id"] for r in found}:  # the same report twice counts once
                found.append(it)
    return found, skipped


# =============================================================================================
# Reading the numbers: funnel, drop-offs, hotspots, efficiency, speed-ups
# =============================================================================================

def label(step, s=None):
    if step in MOMENTS:
        return f"{step} ({MOMENTS[step]})"
    if step == BETWEEN:
        return "between steps (nothing was on screen)"
    if str(step).startswith("area:"):
        return f"{area_name(step[5:])} (the whole area)"
    q = questions().get(step)
    ask = (q or {}).get("ask") or ""
    short = ask if len(ask) <= 48 else ask[:48].rsplit(" ", 1)[0] + "..."
    return f"{step} ({short})" if short else step


def area_name(a):
    return (areas().get(a) or {}).get("name") or a or "other"


def pct(a, b):
    return f"{round(100 * a / b)}%" if b else "n/a"


def _requests(explicit):
    if explicit is None:
        return set()
    if isinstance(explicit, str):
        return {explicit}
    return {item for item in explicit if item}


def suggest_flow(question_id, *, owner=False, locked=False, answered=False, high_impact=False,
                 explicit=None, help_count=0, consented_friction=False):
    """Suggest how to ask one question. Never writes, skips, or changes an answer.

    explicit is an in-session request, or several: "faster", "show an example", "explain more".
    Friction counts are used only when consented_friction is true. Owner and high-impact
    questions stay on screen; a speed request does not remove them.
    """
    asked = _requests(explicit)
    suggestion = "keep"
    reason = "No signal says this question should change."
    if locked or answered:
        reason = "This question is already settled in the project, so the suggestion is to leave it."
    elif "faster" in asked and "explain more" in asked:
        reason = "The signals disagree, so leave the question as it is."
    elif owner or high_impact:
        if "explain more" in asked or (consented_friction and help_count >= 2):
            suggestion = "explain-more"
            reason = "They asked for more explanation. The question still has to be asked."
        elif "show an example" in asked:
            suggestion = "show-example"
            reason = "They asked to see an example. The question still has to be asked."
        elif "faster" in asked:
            reason = "A request to go faster does not skip an owner or high-impact question."
        else:
            reason = "Owner and high-impact questions stay visible."
    elif "faster" in asked and help_count >= 2:
        reason = "A speed request and repeated help disagree, so leave the question as it is."
    elif "faster" in asked:
        suggestion = "shorten"
        reason = "They asked to go faster in this session. This does not change the shared interview."
    elif "show an example" in asked:
        suggestion = "show-example"
        reason = "They asked to see one example before answering."
    elif "explain more" in asked or (consented_friction and help_count >= 2):
        suggestion = "explain-more"
        reason = "They need the explanation. Friction counts are included only because logging was allowed."
    elif help_count >= 2:
        reason = "Help requests are ignored until logging is allowed. The question stays as written."
    return {
        "question": question_id,
        "suggestion": suggestion,
        "reason": reason,
        "writes": False,
        "skips": False,
    }


def analyze(sm, min_n=1):
    steps = sm["steps"]
    qsteps = {k: s for k, s in steps.items() if s["level"] in LEVELS}

    def funnel(rows):
        ans = [min(s["answered"], s["runs"]) for s in rows]
        return {"reached": sum(s["runs"] for s in rows), "answered": sum(ans),
                "skipped": sum(min(s["skipped"], s["runs"] - a) for s, a in zip(rows, ans)),
                "dropped": sum(s["dropped"] for s in rows)}

    levels = []
    for lvl in LEVELS:
        L = sm["levels"].get(lvl)
        if L:
            levels.append({"level": lvl, "runs": L["reached"], "completed": L["completed"], "taken": L["steps_taken"],
                           "fewest": L["fewest"], "planned_q": L["planned"], "minutes": round(L["secs"] / 60, 1),
                           "planned": L["planned_min"],
                           **funnel([s for s in qsteps.values() if s["level"] == lvl])})
    by_area = {}
    for s in qsteps.values():
        by_area.setdefault((s["area"], s["level"]), []).append(s)
    area_rows = [{"area": a, "level": lvl, **funnel(rows)}
                 for (a, lvl), rows in sorted(by_area.items(), key=lambda kv: (LEVELS.index(kv[0][1]), area_name(kv[0][0])))]

    def top(key, n=5):
        rows = [(key(s), k) for k, s in steps.items() if key(s)]
        return [k for _, k in sorted(rows, key=lambda r: (-r[0], r[1]))[:n]]

    frustration = top(lambda s: sum(s["signals"].values()))
    help_ = top(lambda s: s["help"])
    dropped = top(lambda s: s["dropped"], 10)
    changed = top(lambda s: s["changed"], 10)
    defaults = []
    for k, s in qsteps.items():
        unseen = sum(s["reasons"].get(r, 0) for r in UNSEEN_REASONS)  # a rule or their own words settled it
        total = s["answered"] + s["skipped"] - unseen
        if total > 0:
            kept = s["how"].get("default", 0) + s["skipped"] - unseen
            defaults.append({"step": k, "kept": kept, "delegated": s["how"].get("delegated", 0), "total": total,
                             "weight": (questions().get(k) or {}).get("weight"),
                             "secs": round(sum(s["secs"]) / len(s["secs"])) if s["secs"] else None})
    defaults.sort(key=lambda r: (-(r["kept"] + r["delegated"]) / r["total"], -r["total"], r["step"]))
    speedups = [f"{k}: {sum(steps[k]['signals'].values())} frustration signals: reword it, split it, or show a visual."
                for k in frustration if sum(steps[k]["signals"].values()) >= 2]
    speedups += [f"{k}: {steps[k]['help']} help requests: put the explanation into the question itself."
                 for k in help_ if steps[k]["help"] >= 2]
    speedups += [f"{k}: stopped here {steps[k]['dropped']} times: make it skippable, or ask it later."
                 for k in dropped if steps[k]["dropped"] >= max(min_n, 2)]
    auto = [r for r in defaults if auto_apply(r, min_n)]
    speedups += [f"{r['step']}: {kept_words(r)} and {r['weight'] or 'unknown'} impact: hypothesis, not applied: mention it in one line after testing."
                 for r in auto]

    def names(rows):
        return ", ".join(rows[:6]) + (f" and {len(rows) - 6} more" if len(rows) > 6 else "")
    high = [r for r in defaults if r["total"] >= min_n and r["weight"] == "high"]
    kept_high = [r["step"] for r in high if r["kept"] / r["total"] >= 0.8]
    if kept_high:
        speedups.append(names(kept_high) + ": default kept every time or nearly, but they shape a lot: keep asking, "
                        "with the default as a one-tap yes.")
    handed = [r["step"] for r in high if r["delegated"] / r["total"] >= 0.8]
    if handed:  # delegation is a choice to go faster, not a vote for the default
        speedups.append(names(handed) + ": handed over ('you choose') every time or nearly: when someone is in a hurry, "
                        "pick these for them and list them in one line.")
    slowest = sorted((r for r in defaults if r["secs"] is not None), key=lambda r: (-r["secs"], r["step"]))[:5]
    how = {}
    for s in qsteps.values():
        for k, n in s["how"].items():
            bump(how, k, n)
    return {"levels": levels, "areas": area_rows, "frustration": frustration, "help": help_, "dropped": dropped,
            "changed": changed, "defaults": defaults, "speedups": speedups, "slowest": slowest, "how": how}


def auto_apply(r, min_n=1):
    """A low- or medium-impact question whose default stayed (accepted, skipped or handed over) at least 80% of the time."""
    return r["total"] >= min_n and r["weight"] != "high" and (r["kept"] + r["delegated"]) / r["total"] >= 0.8


def kept_words(r):
    parts = [f"default kept {r['kept']} of {r['total']} times"] if r["kept"] else []
    if r["delegated"]:
        parts.append(f"handed over ('you choose') {r['delegated']} of {r['total']} times")
    return " and ".join(parts)


def headline(sm, an):
    """The few lines printed after `report`, also the top of JOURNEY.md."""
    taken = sum(r["taken"] for r in an["levels"])
    fewest = sum(r["fewest"] for r in an["levels"])
    f = {k: sum(r[k] for r in an["levels"]) for k in ("answered", "skipped", "dropped")}
    who = "you" if sm["runs"] == 1 else "people"
    lines = [(f"{sm['runs']} reports, " if sm["runs"] > 1 else "") + f"{sm['sessions']} session{'s' if sm['sessions'] != 1 else ''}, "
             f"{round(sm['secs_total'] / 60)} min in total. {taken} steps taken: {f['answered']} answered, "
             f"{f['skipped']} skipped, {f['dropped']} dropped."]
    if taken:
        lines.append(f"Shortest path for what was covered: {fewest} steps, one per question; {who} took {taken} "
                     f"({pct(fewest, taken)} efficient).")
    if an["dropped"]:
        lines.append("Stopped at: " + ", ".join(label(k) for k in an["dropped"][:2]) + ".")
    if an["frustration"]:
        k = an["frustration"][0]
        n = sum(sm["steps"][k]["signals"].values())
        lines.append(f"Most frustrating: {label(k)}, {n} signal{'s' if n != 1 else ''}.")
    if an["speedups"]:
        lines.append("Top speed-up: " + an["speedups"][0])
    return lines


def level_line(d, level, now=None):
    """One line for the offer after a level, only when logging is on and 3 or more steps could have been saved."""
    if profile(d).get("tracking") != "on":
        return ""
    L = summarize(read_events(jpath(d, "events.jsonl")), now)["levels"].get(level)
    if not L or L["steps_taken"] - L["fewest"] < 3:
        return ""
    return f"You took {L['steps_taken']} steps; the shortest path is {L['fewest']}."


def feedback_text(d, now=None):
    """Hotspots for `engine.py feedback --from-journey`: public question ids and counts only, never notes."""
    events = read_events(jpath(d, "events.jsonl"))
    if not events:
        return ""
    sm = summarize(events, now)
    an = analyze(sm)
    known, steps = questions(), sm["steps"]
    parts = ["Steps taken of shortest: " + ", ".join(f"{r['level']} {r['taken']} of {r['fewest']}" for r in an["levels"])]
    for name, ks, n in (("Stopped at", an["dropped"], lambda k: steps[k]["dropped"]),
                        ("Frustration", an["frustration"], lambda k: sum(steps[k]["signals"].values())),
                        ("Help asked", an["help"], lambda k: steps[k]["help"])):
        ks = [k for k in ks if k in known][:3]
        if ks:
            parts.append(f"{name}: " + ", ".join(f"{k} ({n(k)})" for k in ks))
    auto = [r for r in an["defaults"] if r["step"] in known and auto_apply(r)][:5]
    if auto:
        parts.append("Default kept: " + ", ".join(f"{r['step']} ({r['kept']} of {r['total']})" for r in auto))
    return "Journey hotspots: " + "; ".join(parts) + "."


def render_md(sm, an, title="Your OpenDesigner journey", about=None):
    steps = sm["steps"]
    many = sm["runs"] > 1

    def counts(dct, names=None):
        return ", ".join(f"{names.get(k, k) if names else k} {n}" for k, n in sorted(dct.items(), key=lambda kv: (-kv[1], kv[0])))

    out = [f"# {title}", "", about or ("A private record of how this design system was made, so the steps can get fewer. "
           "It stays in your project files. `journey.py export --anon` shows the only part that could ever be shared."), "",
           "## In short", *[f"- {x}" for x in headline(sm, an)], ""]
    out += ["## Funnel by level", "Steps taken counts every time a step was shown, plus extra back-and-forth. The shortest path is "
            "one message per question reached. Planned is what pacing.json lists for the areas zoomed into.", "",
            "| Level | " + ("Reports | " if many else "") + "Reached | Answered | Skipped | Dropped | Finished | Steps taken / shortest "
            "| Planned questions | Minutes / planned |",
            "|---|" + ("---|" if many else "") + "---|---|---|---|---|---|---|---|"]
    for r in an["levels"]:
        fin = f"{r['completed']} of {r['runs']}" if many else ("yes" if r["completed"] else "no")
        out.append(f"| {r['level']} | " + (f"{r['runs']} | " if many else "") + f"{r['reached']} | {r['answered']} | {r['skipped']} | "
                   f"{r['dropped']} | {fin} | {r['taken']} / {r['fewest']} ({pct(r['fewest'], r['taken'])}) | {r['planned_q']} | "
                   f"{r['minutes']} / {r['planned']} |")
    out += ["", "## Funnel by area", "", "| Area | Level | Reached | Answered | Skipped | Dropped |", "|---|---|---|---|---|---|"]
    out += [f"| {area_name(r['area'])} | {r['level']} | {r['reached']} | {r['answered']} | {r['skipped']} | {r['dropped']} |"
            for r in an["areas"]]
    out += ["", "## Where it stopped", "A drop-off is a step left on screen when a session ended without finishing a level."]
    for k in an["dropped"]:
        where = ", ".join(x["session"] for x in sm.get("dropoffs", []) if x["step"] == k)
        out.append(f"- {label(k)}: {steps[k]['dropped']} time{'s' if steps[k]['dropped'] != 1 else ''}" + (f" (session {where})" if where else ""))
    if not an["dropped"]:
        out.append("- Nowhere: every session ended cleanly or is still going.")
    out += ["", "## Frustration hotspots"]
    for k in an["frustration"]:
        s = steps[k]
        n = sum(s["signals"].values())
        out.append(f"- {label(k)}: {n} signal{'s' if n != 1 else ''} ({counts(s['signals'])})")
        out += [f"  - note: \"{n}\"" for n in s["notes"][:3]]
    if not an["frustration"]:
        out.append("- None logged.")
    out += ["", "## Help hotspots"]
    out += [f"- {label(k)}: {steps[k]['help']} request{'s' if steps[k]['help'] != 1 else ''}"
            + (f" ({counts(steps[k]['help_kinds'])})" if steps[k]["help_kinds"] else "") for k in an["help"]] or ["- None logged."]
    out += ["", "## Changed answers"]
    out += [f"- {label(k)}: changed {steps[k]['changed']} time{'s' if steps[k]['changed'] != 1 else ''}" for k in an["changed"]] or ["- None."]
    out += ["", "## Speed-ups to try"]
    out += [f"- {x}" for x in an["speedups"][:10]] or ["- None yet: more runs give clearer signals."]
    out += ["", "## Default kept, per question", "Kept means they accepted the default or skipped the question. Handed over means they "
            "said \"you choose\". Questions a rule skipped, or that their own words already answered, are left out.", "",
            "| Question | Kept | Handed over | Impact | Average time |", "|---|---|---|---|---|"]
    out += [f"| {r['step']} | {r['kept']} of {r['total']} | {r['delegated']} | {r['weight'] or '?'} | "
            f"{str(r['secs']) + ' s' if r['secs'] is not None else '-'} |" for r in an["defaults"][:25]]
    out += ["", "## Slowest steps"]
    out += [f"- {label(r['step'])}: {r['secs']} s on average (planned about {WEIGHT_SECS.get(r['weight'], 30)} s)"
            for r in an["slowest"]] or ["- No timings yet."]
    ev = sm["events"]
    out += ["", "## Everything else",
            "- How answers were given: " + (counts(an["how"]) or "none logged") + ".",
            f"- Errors: {ev.get('error', 0)}. Exports: {ev.get('export', 0)}. Reviews: {ev.get('review', 0)}. "
            f"Feedback notes: {ev.get('feedback_filed', 0)}. Asked to go faster: {ev.get('speed_mode', 0)}."]
    faster = [k for k, s in steps.items() if s["faster"]]
    if faster:
        out.append("- Asked to go faster at: " + ", ".join(faster) + ".")
    if many:
        out.append("- Hosts: " + counts(sm["hosts"]) + ". Versions: " + counts(sm["versions"]) + ".")
    return "\n".join(out) + "\n"


# =============================================================================================
# CLI
# =============================================================================================

def cmd_report(d, as_json=False):
    events = read_events(jpath(d, "events.jsonl"))
    if not events:
        print("No journey yet: logging is off, or nothing was logged.")
        return 0
    sm = summarize(events)
    an = analyze(sm)
    write_text(jpath(d, "JOURNEY.md"), render_md(sm, an))
    if as_json:
        print(json.dumps({"summary": sm, "analysis": an}, indent=2, ensure_ascii=False, default=str))
    else:
        print("\n".join(headline(sm, an)))
        print(f"Full report: {jpath(d, 'JOURNEY.md')}")
    return 0


SHARE_MESSAGES = {
    "nothing": "Nothing new to report since the last report.",
    "not_asked": "Not sent: they haven't been asked. Ask once, at the end of the first session, with the text from "
                 "`journey.py share-consent`.",
    "off": "Not sent: sharing is off. Nothing was sent.",
    "needs_yes": "Not sent: sharing is set to 'ask'. Ask them: " + SHARE_ASK + " After a yes, run `journey.py share --yes`.",
    "sent": "Sent the anonymous report {id}. Thank you.",
    "queued": "Couldn't reach the report server, so report {id} waits in {outbox} and goes with the next one.",
    "outbox": "Reports aren't being collected yet, so report {id} stays in your project files, in {outbox}. Nothing was sent.",
}


def main(argv=None):
    ap = argparse.ArgumentParser(prog="journey.py", description="OpenDesigner journey tracker (stdlib only; local unless you share).")
    ap.add_argument("--dir", default=DEFAULT_DIR, help=f"state directory (default ./{DEFAULT_DIR})")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("consent", help="show or set local logging")
    p.add_argument("value", nargs="?", choices=["on", "off"])
    p.add_argument("--forget", action="store_true", help="with off: delete the journey folder")
    p.add_argument("--where", choices=list(CONSENT_QUESTIONS), default=None,
                   help="which log question to print: local (scripts run on their computer) or web (a web chat's sandbox)")
    p = sub.add_parser("log", help="append one event")
    p.add_argument("event")
    for flag in ("--step", "--level", "--area", "--how", "--signal", "--reason", "--kind", "--note"):
        p.add_argument(flag)
    for flag in ("--secs", "--turns", "--count"):
        p.add_argument(flag, type=float)
    p.add_argument("--session", default="auto")
    sub.add_parser("events", help="every event and value, in plain words")
    p = sub.add_parser("report", help="write JOURNEY.md and print a short summary")
    p.add_argument("--json", action="store_true")
    p = sub.add_parser("level-line", help="the steps-taken line for the offer after a level, when worth saying")
    p.add_argument("level", choices=LEVELS)
    p = sub.add_parser("export", help="write the anonymous report")
    p.add_argument("--anon", action="store_true", required=True)
    p.add_argument("--out", default=None, help="file, or - for stdout (default journey/anonymous-report.json)")
    p.add_argument("--host", choices=HOSTS, default=None)
    p = sub.add_parser("share-consent", help="print the short sharing question, or record the answer")
    p.add_argument("value", nargs="?", choices=list(SHARE_CHOICES))
    p.add_argument("--details", action="store_true", help="print the full facts, for when they say 'details'")
    p = sub.add_parser("share", help="send the anonymous report, if they agreed")
    p.add_argument("--dry-run", dest="dry_run", action="store_true", help="print the exact JSON; send nothing")
    p.add_argument("--yes", action="store_true", help="they confirmed this report (needed when sharing is 'ask')")
    p.add_argument("--host", choices=HOSTS, default=None)
    p = sub.add_parser("aggregate", help="one report across many anonymous reports or logs")
    p.add_argument("paths", nargs="+")
    p.add_argument("--out", required=True, help="a .md report, or .json for the merged numbers")
    a = ap.parse_args(argv)
    d = a.dir
    if a.cmd == "consent":
        if a.value:
            set_tracking(d, a.value == "on", a.forget)
            print(f"Local journey log is {a.value}." + (" The log was deleted." if a.forget else ""))
        else:
            cur = profile(d).get("tracking")
            print(f"Local journey log is {cur}." if cur else f"Not asked yet. Ask once:\n  {consent_question(a.where)}\n"
                  "Then run: journey.py consent on   (or: consent off)")
    elif a.cmd == "log":
        data = {k: getattr(a, k) for k in ("how", "signal", "reason", "kind", "note", "secs", "turns", "count")}
        cur = profile(d).get("tracking")
        if cur is None:
            print(f"Not logged: they haven't been asked. Ask once:\n  {consent_question()}\n"
                  "Then run: journey.py consent on   (or: consent off)")
            return 0
        try:
            log(d, a.event, a.step, a.level, a.area, a.session, **data)
        except ValueError as ex:
            raise SystemExit(str(ex))
    elif a.cmd == "events":
        for name, table in (("Events", EVENTS), ("--how", HOW), ("--signal (frustration)", SIGNALS),
                            ("--reason (step_skipped)", REASONS), ("--kind (help)", HELP_KINDS)):
            print(f"{name}:")
            for k, v in table.items():
                print(f"  {k:16} {v}")
        print("--kind (feedback_filed): " + ", ".join(FEEDBACK_KINDS) + ". --kind (export): " + ", ".join(EXPORT_FORMATS) + ".")
    elif a.cmd == "report":
        return cmd_report(d, a.json)
    elif a.cmd == "level-line":
        line = level_line(d, a.level)
        if line:
            print(line)
    elif a.cmd == "export":
        p_ = payload(summarize(read_events(jpath(d, "events.jsonl"))), a.host or detect_host())
        text = json.dumps(p_, indent=2) + "\n"
        if a.out == "-":
            sys.stdout.write(text)
        else:
            out = a.out or jpath(d, "anonymous-report.json")
            write_text(out, text)
            print(f"Anonymous report: {out}. It holds question ids, counts and rounded timings only: "
                  "no answers, notes, names, colors, paths or links.")
    elif a.cmd == "share-consent":
        if a.value:
            set_share(d, a.value)
            record(d, "step_answered", step="consent.share", how="option")  # closes the moment, so later signals aren't blamed on it
            print(f"Sharing: {SHARE_CHOICES[a.value]}." + (" Unsent reports were deleted." if a.value == "never" else ""))
        else:
            print(SHARE_DETAILS if a.details else SHARE_CONSENT)
            cur = profile(d).get("share_reports")
            print(f"(now: {SHARE_CHOICES.get(cur, 'not asked yet')}. Record the answer: journey.py share-consent always|ask|never)",
                  file=sys.stderr)
    elif a.cmd == "share":
        status, p_ = share(d, a.dry_run, a.yes, a.host)
        if status == "dry_run":
            print(json.dumps(p_, indent=2))
        else:
            print(SHARE_MESSAGES[status].format(id=(p_ or {}).get("report_id"), outbox=jpath(d, "outbox")))
    elif a.cmd == "aggregate":
        reports, skipped = load_reports(a.paths)
        sm = merge(reports)
        if a.out.endswith(".json"):
            dump_json(a.out, sm)
        else:
            an = analyze(sm, min_n=3)
            write_text(a.out, render_md(sm, an, f"OpenDesigner journeys: {sm['runs']} reports",
                                        "Merged from anonymous reports. Counts are per report: a step reached in 3 reports counts 3. "
                                        "Speed-ups need at least 3 answers."))
            print("\n".join(headline(sm, an)))
        print(f"Merged {len(reports)} reports" + (f", skipped {skipped} that failed the schema" if skipped else "") + f": {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
