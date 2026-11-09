#!/usr/bin/env python3
"""Tests for journey.py (standard library unittest; the only network use is a local test server on 127.0.0.1).

    python3 skills/opendesigner/scripts/test_journey.py        (or: python3 -m unittest test_journey)
"""
import contextlib
import datetime as dt
import http.server
import io
import json
import os
import random
import sys
import tempfile
import threading
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import journey as j  # noqa: E402

TZ = dt.timezone(dt.timedelta(hours=5, minutes=30))
T0 = dt.datetime(2026, 9, 20, 10, 0, tzinfo=TZ)


def run(argv):
    out = io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
        code = j.main(argv)
    return code, out.getvalue()


def ev(t, event, step=None, session="S001", **data):
    return {"ts": t.isoformat(), "session": session, "event": event, "step": step, "level": None, "area": None, "data": data}


class Project(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = os.path.join(self.tmp.name, "opendesigner")
        j.dump_json(os.path.join(self.d, "state.json"), {"name": "Test", "profile": {"voice": "plain"}, "answers": {}})
        self.t = T0

    def tearDown(self):
        self.tmp.cleanup()

    def log(self, event, secs=5, **kw):
        self.t += dt.timedelta(seconds=secs)
        return j.log(self.d, event, now=self.t, **kw)

    def events(self):
        return j.read_events(j.jpath(self.d, "events.jsonl"))

    def state(self):
        return j.read_json(os.path.join(self.d, "state.json"))


class Consent(Project):
    def test_nothing_is_logged_until_they_say_yes(self):
        self.assertIsNone(self.log("step_shown", step="Q-aud-01"))
        with mock.patch.dict(os.environ, {"CLAUDECODE": "", "CLAUDE_CODE_REMOTE": ""}):
            code, out = run(["--dir", self.d, "log", "step_shown", "--step", "Q-aud-01"])
        self.assertEqual(code, 0)
        self.assertIn(j.CONSENT_QUESTIONS["web"], out)
        self.assertFalse(os.path.exists(j.jpath(self.d, "events.jsonl")))
        with mock.patch.dict(os.environ, {"CLAUDECODE": "1", "CLAUDE_CODE_REMOTE": ""}):
            code, out = run(["--dir", self.d, "log", "step_shown", "--step", "Q-aud-01"])
        self.assertEqual(code, 0)
        self.assertIn(j.CONSENT_QUESTIONS["local"], out)
        self.assertFalse(os.path.exists(j.jpath(self.d, "events.jsonl")))
        # A remote Claude Code session is not the person's own computer, so the web wording stays.
        with mock.patch.dict(os.environ, {"CLAUDECODE": "1", "CLAUDE_CODE_REMOTE": "1"}):
            code, out = run(["--dir", self.d, "log", "step_shown", "--step", "Q-aud-01"])
        self.assertEqual(code, 0)
        self.assertIn(j.CONSENT_QUESTIONS["web"], out)
        self.assertNotIn(j.CONSENT_QUESTIONS["local"], out)
        self.assertFalse(os.path.exists(j.jpath(self.d, "events.jsonl")))

    def test_off_logs_nothing_and_says_nothing(self):
        run(["--dir", self.d, "consent", "off"])
        code, out = run(["--dir", self.d, "log", "step_shown", "--step", "Q-aud-01"])
        self.assertEqual((code, out), (0, ""))
        self.assertEqual(self.events(), [])

    def test_consent_keeps_the_rest_of_state(self):
        run(["--dir", self.d, "consent", "on"])
        s = self.state()
        self.assertEqual(s["profile"], {"voice": "plain", "tracking": "on"})
        self.assertEqual(s["name"], "Test")
        self.assertIsNotNone(self.log("step_shown", step="Q-aud-01"))

    def test_forget_deletes_the_log(self):
        j.set_tracking(self.d, True)
        self.log("step_shown", step="Q-aud-01")
        run(["--dir", self.d, "consent", "off", "--forget"])
        self.assertFalse(os.path.exists(j.jpath(self.d)))
        self.assertEqual(self.state()["profile"]["tracking"], "off")

    def test_share_consent_is_separate(self):
        j.set_tracking(self.d, True)
        _, out = run(["--dir", self.d, "share-consent"])
        self.assertEqual(out.strip(), j.SHARE_CONSENT)
        _, out = run(["--dir", self.d, "share-consent", "--details"])
        self.assertEqual(out.strip(), j.SHARE_DETAILS)
        run(["--dir", self.d, "share-consent", "ask"])
        self.assertEqual(self.state()["profile"], {"voice": "plain", "tracking": "on", "share_reports": "ask"})

    def test_share_ask_is_short_and_the_details_are_complete(self):
        """BRIEF 13 and 19 together: a short plain ask, with every fact one reply away (U5 consent decision)."""
        ask = j.SHARE_CONSENT
        self.assertLessEqual(len(ask.splitlines()), 3)
        self.assertLessEqual(len(ask.split()), 55)
        self.assertIn('"details"', ask)
        for choice in j.SHARE_CHOICES.values():
            self.assertIn(choice, ask.lower())
        det = j.SHARE_DETAILS
        self.assertLessEqual(len(det.splitlines()), 8)
        for part in ("Why:", "What is sent:", "Never sent:", "Where it goes:", "How long:", '"show me"', "change your mind"):
            self.assertIn(part, det)
        for choice in j.SHARE_CHOICES.values():
            self.assertIn(choice, det.splitlines()[-1])
        self.assertNotIn("this computer", ask + det)   # true in every host

    def test_log_question_is_host_aware(self):
        self.assertIn("on this computer", j.consent_question("local"))
        self.assertIn("in your project files", j.consent_question("web"))
        with mock.patch.dict(os.environ, {"CLAUDECODE": "1"}, clear=False):
            os.environ.pop("CLAUDE_CODE_REMOTE", None)
            self.assertEqual(j.detect_where(), "local")
        with mock.patch.dict(os.environ, {"CLAUDECODE": "", "CLAUDE_CODE_REMOTE": ""}):
            self.assertEqual(j.detect_where(), "web")
        _, out = run(["--dir", self.d, "consent", "--where", "web"])
        self.assertIn(j.CONSENT_QUESTIONS["web"], out)


class Logging(Project):
    def setUp(self):
        super().setUp()
        j.set_tracking(self.d, True)

    def test_append_infers_level_and_area(self):
        rec = self.log("step_shown", step="Q-aud-01")
        self.assertEqual((rec["level"], rec["area"], rec["session"]), ("sketch", "accessibility", "S001"))
        lines = self.events()
        self.assertEqual([e["event"] for e in lines], ["session_start", "step_shown"])
        self.assertEqual(lines[0]["data"], {"auto": True})
        self.assertEqual(set(lines[1]), {"ts", "session", "event", "step", "level", "area", "data"})
        self.log("step_answered", step="Q-aud-01", how="default", secs=12)
        self.assertEqual(len(self.events()), 3)
        with open(j.jpath(self.d, ".gitignore")) as f:
            self.assertIn("*", f.read())

    def test_bad_events_are_refused(self):
        for event, kw in (("clicked", {}), ("step_answered", {"how": "maybe"}), ("frustration", {}),
                          ("help", {"kind": "psychic"}), ("step_answered", {"turns": -1})):
            with self.assertRaises(ValueError):
                self.log(event, step="Q-aud-01", **kw)
        with self.assertRaises(SystemExit):
            run(["--dir", self.d, "log", "frustration", "--signal", "grumpy"])
        self.assertIsNone(j.record(self.d, "clicked"))

    def test_notes_are_short_and_scrubbed(self):
        rec = self.log("frustration", step="Q-aud-01", signal="said",
                       note="ugh kunal@acme.dev see https://acme.dev and /Users/kunal/app #167874 one two three four five six seven")
        note = rec["data"]["note"]
        self.assertLessEqual(len(note.split()), 12)
        for bad in ("@", "acme.dev", "/Users", "#167874"):
            self.assertNotIn(bad, note)

    def test_sessions_rotate(self):
        self.log("step_shown", 0, step="Q-aud-01")
        self.log("step_answered", 600, step="Q-aud-01", how="option")
        self.assertEqual(self.events()[-1]["session"], "S001")
        self.log("step_shown", 45 * 60, step="Q-plat-01")          # 45 idle minutes
        self.assertEqual([e["event"] for e in self.events()[-2:]], ["session_start", "step_shown"])
        self.assertEqual(self.events()[-1]["session"], "S002")
        self.log("session_end")
        self.log("step_shown", step="Q-brand-01")                  # after session_end
        self.assertEqual(self.events()[-1]["session"], "S003")
        self.log("session_start")                                  # an explicit start opens a new one
        self.assertEqual(self.events()[-1]["session"], "S004")

    def test_how_for_engine_answers(self):
        self.assertEqual(j.how_for("Q-shape-01", "soft"), "option")
        self.assertEqual(j.how_for("Q-shape-01", "banana"), "free")
        self.assertEqual(j.how_for("Q-plat-01", ["web", "ios"]), "option")
        self.assertEqual(j.how_for("Q-shape-01", "soft", "delegated"), "delegated")
        self.assertEqual(j.how_for("Q-shape-01", "subtle", "confirmed_default"), "default")


class Report(Project):
    def setUp(self):
        super().setUp()
        j.set_tracking(self.d, True)

    def test_drop_offs(self):
        self.log("step_shown", step="Q-aud-01")
        self.log("step_answered", step="Q-aud-01", how="option")
        self.log("step_shown", step="Q-plat-01")                        # left here: session S001 just stops
        self.log("step_shown", 2 * 3600, step="Q-dir-01")
        self.log("step_answered", step="Q-dir-01", how="default")
        self.log("step_shown", step="Q-dir-02")                         # still on screen, but the level finished after it
        self.log("level_complete", level="broad")
        self.log("step_shown", 2 * 3600, step="Q-type-01")
        self.log("session_end")                                         # stopped on purpose
        self.log("step_shown", 2 * 3600, step="Q-shape-01")             # the last session, still going
        sm = j.summarize(self.events(), now=self.t + dt.timedelta(minutes=5))
        self.assertEqual([x["step"] for x in sm["dropoffs"]], ["Q-plat-01"])
        sm = j.summarize(self.events(), now=self.t + dt.timedelta(hours=2))
        self.assertEqual([x["step"] for x in sm["dropoffs"]], ["Q-plat-01", "Q-shape-01"])
        self.assertEqual(sm["steps"]["Q-plat-01"]["dropped"], 1)
        self.assertEqual(sm["sessions"], 4)

    def test_help_and_frustration_blame_the_step_that_caused_them(self):
        """U5 student F30: a complaint about the sharing text was pinned on Q-color-01, long after it was answered."""
        for q in ("Q-color-01", "Q-plat-01"):
            self.log("step_shown", step=q)
        self.log("help", kind="explain")                               # asked while Q-plat-01 was on screen
        self.assertEqual(self.events()[-1]["step"], "Q-plat-01")       # stamped in the log itself
        for q in ("Q-color-01", "Q-plat-01"):
            self.log("step_answered", step=q, how="option")            # the engine records the sketch answers
        self.log("level_complete", level="sketch")
        self.log("frustration", signal="said")                         # nothing on screen: nobody is blamed
        self.assertIsNone(self.events()[-1]["step"])
        self.log("step_shown", step="consent.share")                   # a moment, not a question
        self.log("frustration", signal="said", note="too much text")
        self.assertEqual(self.events()[-1]["step"], "consent.share")
        run(["--dir", self.d, "share-consent", "never"])               # answering closes the moment
        self.log("help", kind="explain")
        self.log("frustration", area="color", signal="said")           # about a whole area
        sm = j.summarize(self.events())
        steps = sm["steps"]
        self.assertEqual(steps["Q-plat-01"]["help"], 1)
        self.assertEqual(steps["Q-color-01"]["signals"], {})
        self.assertEqual(steps["consent.share"]["signals"], {"said": 1})
        self.assertEqual(steps[j.BETWEEN]["signals"], {"said": 1})
        self.assertEqual(steps[j.BETWEEN]["help"], 1)
        self.assertEqual(steps["area:color"]["signals"], {"said": 1})
        an = j.analyze(sm)
        self.assertNotIn("Q-color-01", an["frustration"])
        self.assertEqual(j.label("consent.share"), "consent.share (the question about sharing reports)")
        self.assertEqual(j.label("area:color"), "Color (the whole area)")
        self.assertNotIn("consent.share", j.payload(sm)["questions"])   # moments never reach the report
        # an old log without stamped steps reads the same way
        old = [dict(e, step=None) if e["event"] in j.ATTACHED and not e["data"].get("auto") else e for e in self.events()]
        self.assertEqual(j.summarize(old)["steps"]["consent.share"]["signals"], {"said": 1})

    def test_known_and_rule_skips_are_not_steps_taken(self):
        """U5 student F5 and F31: a question their words already answered, or a rule skipped, was never in front of them."""
        self.log("step_shown", step="Q-aud-01")
        self.log("step_answered", step="Q-aud-01", how="option")
        self.log("step_skipped", step="Q-plat-01", reason="known")       # "a website" already said where it runs
        self.log("step_answered", 200, step="Q-plat-01", how="option")   # the sketch records it later
        self.log("step_skipped", step="Q-color-06", reason="rule")
        sm = j.summarize(self.events())
        self.assertEqual(sm["levels"]["sketch"]["steps_taken"], 1)
        self.assertEqual(sm["levels"]["sketch"]["fewest"], 1)
        an = j.analyze(sm)
        self.assertNotIn("Q-color-06", [r["step"] for r in an["defaults"]])
        self.assertFalse(any("Q-color-06" in x for x in an["speedups"]))

    def test_delegation_is_not_a_vote_for_the_default(self):
        """U5 engineer F19: after 'just pick', the report said 'keep asking' the questions they handed over."""
        for q in ("Q-brand-01", "Q-color-01"):
            self.log("step_answered", step=q, how="delegated")
        self.log("step_shown", step="Q-color-20")
        self.log("step_answered", step="Q-color-20", how="delegated")
        an = j.analyze(j.summarize(self.events()))
        text = " ".join(an["speedups"])
        self.assertNotIn("keep asking", text)
        self.assertIn("Q-brand-01, Q-color-01: handed over", text)
        self.assertIn("Q-color-20: handed over ('you choose') 1 of 1 times and low impact: hypothesis, not applied:", text)

    def test_housekeeping_after_the_end_stays_in_that_session(self):
        """U5 designer F31: a review right after session_end opened a phantom second session."""
        self.log("step_shown", step="Q-aud-01")
        self.log("session_end")
        self.log("review")
        self.log("export", kind="css")
        self.assertEqual({e["session"] for e in self.events()}, {"S001"})
        self.log("step_shown", step="Q-shape-01")                       # real work after the end: a new session
        self.assertEqual(self.events()[-1]["session"], "S002")

    def test_frustration_hotspots_rank_by_count(self):
        self.log("step_shown", step="Q-type-01")
        self.log("frustration", signal="said")
        self.log("frustration", signal="undo")                          # no step: the one on screen
        self.log("step_shown", step="Q-shape-01")
        self.log("frustration", step="Q-shape-01", signal="slow")
        self.log("step_shown", step="Q-depth-01")
        for sig in ("said", "rage_skip", "just_do_it"):
            self.log("frustration", signal=sig)
        an = j.analyze(j.summarize(self.events()))
        self.assertEqual(an["frustration"], ["Q-depth-01", "Q-type-01", "Q-shape-01"])
        self.assertTrue(an["speedups"][0].startswith("Q-depth-01: 3 frustration signals"))

    def test_efficiency_against_pacing(self):
        pace = j.ref("pacing.json")
        zoom0 = [q for q in pace["zoom0"] if q not in j.ASKED_TOGETHER]
        for q in zoom0:
            self.log("step_shown", step=q)
            self.log("step_answered", 20, step=q, how="option", turns=3 if q == "Q-brand-01" else None)
        self.log("step_answered", 1, step="Q-brand-03", how="default")  # asked in the same message as Q-color-01
        self.log("step_shown", step="Q-plat-01")                         # asked again
        self.log("step_answered", step="Q-plat-01", how="option")
        self.log("step_shown", step="Q-color-03")
        self.log("help", kind="explain")                                 # one extra turn, counted without --turns
        self.log("step_answered", 30, step="Q-color-03", how="option")
        L = j.summarize(self.events())["levels"]
        self.assertEqual(L["sketch"]["fewest"], len(zoom0))
        self.assertEqual(L["sketch"]["planned"], len(zoom0))
        self.assertEqual(L["sketch"]["steps_taken"], len(zoom0) + 1 + 2)
        self.assertEqual(L["sketch"]["planned_min"], sum(a["levels"]["0"]["minutes"] for a in pace["areas"] if "0" in a["levels"]))
        color2 = next(a for a in pace["areas"] if a["id"] == "color")["levels"]["2"]
        self.assertEqual((L["defined"]["steps_taken"], L["defined"]["fewest"]), (2, 1))
        self.assertEqual((L["defined"]["planned"], L["defined"]["planned_min"]), (len(color2["questions"]), color2["minutes"]))
        self.assertNotIn("broad", L)

    def test_one_answer_logged_twice_counts_once(self):
        self.log("step_shown", step="Q-aud-01")
        self.log("step_answered", 10, step="Q-aud-01", how="default")    # the model
        self.log("step_answered", 2, step="Q-aud-01", how="default")     # the engine
        s = j.summarize(self.events())["steps"]["Q-aud-01"]
        self.assertEqual((s["shown"], s["answered"], s["secs"]), (1, 1, [10]))

    def test_level_line_only_when_worth_saying(self):
        for q in ("Q-scope-01", "Q-aud-01"):
            self.log("step_shown", step=q)
            self.log("step_answered", step=q, how="option")
        self.assertEqual(j.level_line(self.d, "sketch"), "")
        self.log("step_shown", step="Q-plat-01")
        self.log("step_answered", step="Q-plat-01", how="option", turns=4)  # 3 extra turns
        self.assertEqual(j.level_line(self.d, "sketch"), "You took 6 steps; the shortest path is 3.")
        j.set_tracking(self.d, False)
        self.assertEqual(j.level_line(self.d, "sketch"), "")

    def test_feedback_text_holds_ids_and_counts_only(self):
        self.log("step_shown", step="Q-type-01")
        self.log("frustration", signal="said", note="Acme fonts are ugly")
        self.log("frustration", signal="undo")
        self.log("step_shown", step="Priya's landing page", level="defined")
        self.log("help", kind="explain")
        self.log("help", kind="example")
        text = j.feedback_text(self.d)
        self.assertIn("Frustration: Q-type-01 (2)", text)
        for bad in ("Acme", "ugly", "Priya"):
            self.assertNotIn(bad, text)

    def test_report_writes_journey_md(self):
        self.log("step_shown", step="Q-aud-01")
        self.log("step_answered", step="Q-aud-01", how="default")
        code, out = run(["--dir", self.d, "report"])
        self.assertEqual(code, 0)
        self.assertIn("1 steps taken", out)
        with open(j.jpath(self.d, "JOURNEY.md")) as f:
            md = f.read()
        for section in ("## In short", "## Funnel by level", "## Where it stopped", "## Frustration hotspots", "## Speed-ups to try"):
            self.assertIn(section, md)


PRIVATE = ["kunal@example.com", "https://acme.dev/brand", "/Users/kunal/acme-app/src", "C:\\Users\\priya\\app", "#167874", "#ff00aa",
           "Priya Sharma", "Acme Rocket", "SecretLaunch", "+91 98765 43210", "Europe/Berlin", "tokens.css", "rgb(10, 20, 30)",
           "my-startup", "Kunal's laptop"]


class Sharing(Project):
    def setUp(self):
        super().setUp()
        j.set_tracking(self.d, True)

    def sample(self):
        self.log("step_shown", step="Q-aud-01")
        self.log("step_answered", 12, step="Q-aud-01", how="default")
        self.log("frustration", signal="said", note="Acme Rocket colors from kunal@example.com")

    def test_schema_matches_the_code(self):
        sc = j.report_schema()
        self.assertEqual(sc["properties"]["host"]["enum"], j.HOSTS)
        self.assertEqual(set(sc["properties"]["events"]["properties"]), set(j.EVENTS))
        self.assertEqual(set(sc["properties"]["levels"]["properties"]), set(j.LEVELS))
        q = sc["$defs"]["question"]["properties"]
        self.assertEqual(set(q["how"]["properties"]), set(j.HOW))
        self.assertEqual(set(q["signals"]["properties"]), set(j.SIGNALS))
        self.assertEqual(set(q) - {"how", "signals", "secs"}, set(j.COUNT_FIELDS))
        bad = j.payload(j.summarize(self.events()))
        bad["project"] = "Acme"
        self.assertTrue(j.validate(bad, sc))

    def test_fuzz_nothing_personal_reaches_the_report(self):
        rng = random.Random(19)
        qids = list(j.questions())
        keys = ["note", "how", "signal", "reason", "kind", "answer", "value", "url", "count", "secs"]
        for _ in range(40):
            t, events = T0.replace(tzinfo=dt.timezone(dt.timedelta(hours=rng.choice([-7, 2, 9])))), []
            for i in range(60):
                t += dt.timedelta(seconds=rng.randint(1, 900))
                e = ev(t, rng.choice(list(j.EVENTS)), rng.choice(qids + PRIVATE + [None]), rng.choice(["S001", "Priya Sharma"]))
                e["level"] = rng.choice(j.LEVELS + PRIVATE + [None])
                e["area"] = rng.choice(["color", None] + PRIVATE)
                for k in rng.sample(keys, 4):
                    e["data"][k] = rng.choice(PRIVATE + list(j.HOW) + list(j.SIGNALS) + [3, 42.5])
                e["project"] = rng.choice(PRIVATE)
                events.append(e)
            p = j.payload(j.summarize(events, now=t), host=rng.choice(j.HOSTS + PRIVATE))
            self.assertEqual(j.validate(p, j.report_schema()), [])
            text = json.dumps(p).lower()
            for bad in PRIVATE + ["+02:00", "-07:00", "+09:00", "s001", self.tmp.name.lower()]:
                self.assertNotIn(bad.lower(), text)
            self.assertTrue(set(p["questions"]) <= set(qids))

    def test_export_anon_leaks_nothing(self):
        self.sample()
        code, out = run(["--dir", self.d, "export", "--anon", "--out", "-"])
        p = json.loads(out)
        self.assertEqual(j.validate(p, j.report_schema()), [])
        for bad in ("acme", "kunal", "note", self.tmp.name, "+05:30", "2026-09-20"):
            self.assertNotIn(bad.lower(), out.lower())
        self.assertEqual(p["questions"]["Q-aud-01"]["secs"], [10])   # 12 s, rounded to 5
        self.assertNotEqual(p["report_id"], j.payload(j.summarize(self.events()))["report_id"])

    def test_sending_needs_consent(self):
        self.sample()
        self.assertEqual(j.share(self.d)[0], "not_asked")
        j.set_share(self.d, "never")
        self.assertEqual(j.share(self.d)[0], "off")
        j.set_share(self.d, "ask")
        self.assertEqual(j.share(self.d)[0], "needs_yes")
        status, shown = j.share(self.d, dry_run=True)
        self.assertEqual(status, "dry_run")
        with mock.patch.dict(os.environ, {"OPENDESIGNER_REPORTS_URL": ""}):
            status, sent = j.share(self.d, yes=True)
        self.assertEqual((status, sent), ("outbox", shown))           # exactly the report they saw
        self.assertTrue(os.path.exists(j.jpath(self.d, "outbox", shown["report_id"] + ".json")))
        self.assertEqual(j.share(self.d, yes=True)[0], "nothing")     # never reported twice
        j.set_share(self.d, "never")
        self.assertFalse(os.path.exists(j.jpath(self.d, "outbox")))   # saying no deletes what was waiting

    def test_send_posts_json_and_keeps_failures(self):
        got = []

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                got.append(self.rfile.read(int(self.headers["Content-Length"])))
                self.send_response(202)
                self.end_headers()

            def log_message(self, *a):
                pass
        srv = http.server.HTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        self.addCleanup(srv.server_close)
        self.addCleanup(srv.shutdown)
        self.sample()
        j.set_share(self.d, "always")
        with mock.patch.dict(os.environ, {"OPENDESIGNER_REPORTS_URL": "http://127.0.0.1:9/v1/reports"}):
            self.assertEqual(j.share(self.d)[0], "queued")            # unreachable: kept, no error
        self.log("step_shown", step="Q-plat-01")
        with mock.patch.dict(os.environ, {"OPENDESIGNER_REPORTS_URL": f"http://127.0.0.1:{srv.server_port}/v1/reports"}):
            self.assertEqual(j.share(self.d)[0], "sent")
        self.assertEqual(len(got), 2)                                 # the queued one went too
        self.assertEqual(os.listdir(j.jpath(self.d, "outbox")), [])
        for body in got:
            self.assertEqual(j.validate(json.loads(body), j.report_schema()), [])
        self.assertFalse(j.post("ftp://example.com/x", {}))


class Aggregate(Project):
    def test_merge_reports_logs_and_exports(self):
        folder = os.path.join(self.tmp.name, "reports")
        os.makedirs(folder)
        reports = []
        for i in range(3):
            t = T0 + dt.timedelta(days=i)
            events = [ev(t, "step_shown", "Q-color-20"), ev(t + dt.timedelta(seconds=9), "step_answered", "Q-color-20", how="default"),
                      ev(t + dt.timedelta(seconds=20), "step_shown", "Q-aud-01"), ev(t + dt.timedelta(seconds=30), "frustration", signal="said")]
            reports.append(j.payload(j.summarize(events, now=t + dt.timedelta(hours=3)), "codex"))
        j.dump_json(os.path.join(folder, "a.json"), reports[0])
        j.dump_json(os.path.join(folder, "b.json"), [{"results": [{"payload": json.dumps(reports[1])}], "success": True}])  # D1 export
        with open(os.path.join(folder, "c.jsonl"), "w") as f:
            f.writelines(json.dumps(e) + "\n" for e in [ev(T0, "step_shown", "Q-color-20"),
                                                        ev(T0 + dt.timedelta(seconds=5), "step_answered", "Q-color-20", how="default")])
        j.dump_json(os.path.join(folder, "bad.json"), {**reports[2], "name": "Acme"})
        j.dump_json(os.path.join(folder, "d.json"), reports[2])
        found, skipped = j.load_reports([folder])
        self.assertEqual((len(found), skipped), (4, 1))
        sm = j.merge(found)
        self.assertEqual(sm["runs"], 4)
        self.assertEqual(sm["steps"]["Q-color-20"]["answered"], 4)
        self.assertEqual(sm["steps"]["Q-aud-01"]["dropped"], 3)
        self.assertEqual(sm["hosts"]["codex"], 3)
        out = os.path.join(self.tmp.name, "journeys.md")
        code, printed = run(["aggregate", folder, "--out", out])
        with open(out) as f:
            md = f.read()
        self.assertIn("OpenDesigner journeys: 4 reports", md)
        self.assertIn("Q-color-20: default kept 4 of 4 times and low impact: hypothesis, not applied:", md)
        self.assertIn("Q-aud-01: stopped here 3 times", md)
        self.assertIn("skipped 1", printed)


class ConsentTexts(unittest.TestCase):
    """The consent texts are word for word the same in journey.py, the skill and the docs (BRIEF requirements 18-19)."""
    REPO = os.path.abspath(os.path.join(j.SKILL_ROOT, "..", ".."))

    def read(self, where, rel):
        path = os.path.join(j.SKILL_ROOT if where == "skill" else self.REPO, rel)
        if not os.path.exists(path):
            self.skipTest(f"{rel} is not beside this copy of the skill")
        with open(path, encoding="utf-8") as f:
            return f.read()

    def quoted_block(self, text, lines):
        quoted = [x[2:] for x in text.splitlines() if x.startswith("> ")]
        return any(quoted[i:i + len(lines)] == lines for i in range(len(quoted)))

    FILES = (("skill", "references/rules.md"), ("repo", "docs/PRIVACY.md"), ("repo", "docs/JOURNEY-TRACKER.md"))

    def test_log_question(self):
        for where, rel in self.FILES:
            for q in j.CONSENT_QUESTIONS.values():
                self.assertTrue(self.quoted_block(self.read(where, rel), [q]), f"{rel}: the log question drifted from journey.py")

    def test_share_text(self):
        for where, rel in self.FILES:
            text = self.read(where, rel)
            for name, block in (("sharing question", j.SHARE_CONSENT), ("details", j.SHARE_DETAILS)):
                self.assertTrue(self.quoted_block(text, block.splitlines()), f"{rel}: the {name} drifted from journey.py")
            self.assertIn(j.SHARE_ASK, text, rel)


class FlowSuggestions(unittest.TestCase):
    def test_suggestions_never_write_or_skip(self):
        cases = [
            dict(explicit="faster"),
            dict(owner=True, explicit="faster"),
            dict(high_impact=True, explicit="faster"),
            dict(locked=True, explicit="faster"),
            dict(answered=True, explicit="explain more"),
            dict(explicit="show an example"),
            dict(explicit="explain more"),
            dict(help_count=3, consented_friction=True),
            dict(help_count=3, consented_friction=False),
            dict(explicit=["faster", "explain more"]),
        ]
        for kwargs in cases:
            with self.subTest(kwargs):
                result = j.suggest_flow("Q-scope-01", **kwargs)
                self.assertFalse(result["writes"])
                self.assertFalse(result["skips"])
                self.assertIn(result["suggestion"], {"keep", "shorten", "show-example", "explain-more"})

    def test_owner_question_stays_when_they_want_to_go_faster(self):
        result = j.suggest_flow("Q-scope-01", owner=True, explicit="faster")
        self.assertEqual(result["suggestion"], "keep")

    def test_one_speed_request_only_shortens_a_ordinary_question(self):
        result = j.suggest_flow("Q-shape-02", explicit="faster")
        self.assertEqual(result["suggestion"], "shorten")

    def test_help_without_consent_does_not_change_the_question(self):
        result = j.suggest_flow("Q-shape-02", help_count=4, consented_friction=False)
        self.assertEqual(result["suggestion"], "keep")

    def test_conflicting_requests_leave_the_question_alone(self):
        result = j.suggest_flow("Q-shape-02", explicit=["faster", "explain more"])
        self.assertEqual(result["suggestion"], "keep")


if __name__ == "__main__":
    unittest.main()
