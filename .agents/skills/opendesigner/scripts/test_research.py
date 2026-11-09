#!/usr/bin/env python3
"""Tests for research.py and its place in the flow: the findings checks, the signal table against the questions, the
recommendations (never over the person's own answer), PRODUCT.md, review, the reminders after sketch and build, and the
instructions that put the step at the right time. Standard library only, no network.

    python3 skills/opendesigner/scripts/test_research.py
"""
import contextlib
import copy
import datetime as dt
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent
sys.path.insert(0, str(HERE))
import research  # noqa: E402
import engine as e  # noqa: E402

EXAMPLE = SKILL / "assets/output/research-users.example.json"
ENGINE = HERE / "engine.py"


def quiet(fn, *a, **k):
    with contextlib.redirect_stdout(io.StringIO()):
        return fn(*a, **k)


def run(d, *args):
    return subprocess.run([sys.executable, str(ENGINE), "--dir", str(d), *args], capture_output=True, text=True, timeout=300)


def example():
    return json.loads(EXAMPLE.read_text(encoding="utf-8"))


def errors(rec):
    return [t for l, t in research.problems(rec) if l == "error"]


class SignalTable(unittest.TestCase):
    """Every recommendation must land on a question and option the engine really has, or the step would write junk."""

    def test_every_effect_is_a_real_question_and_option(self):
        qs = e.questions()
        for sid, spec in research.SIGNALS.items():
            for qid, val in spec["effects"].items():
                self.assertIn(qid, qs, f"{sid} -> {qid} is not a question")
                opts = e.option_values(qs[qid])
                for v in val if isinstance(val, list) else [val]:
                    self.assertIn(v, opts, f"{sid} -> {qid}={v} is not an option of {qid}")
                self.assertEqual(isinstance(val, list), qid not in research.SINGLE, f"{qid}: single questions take one value")

    def test_every_signal_does_something(self):
        for sid, spec in research.SIGNALS.items():
            self.assertTrue(spec["effects"] or spec.get("note"), sid)
            self.assertTrue(spec["plain"], sid)

    def test_no_signal_lowers_an_accessibility_floor(self):
        for sid, spec in research.SIGNALS.items():
            self.assertNotEqual(spec["effects"].get("Q-aud-03"), "wcag22-a", sid)

    def test_topics_have_searches_and_tools_are_unique(self):
        self.assertEqual(set(research.QUERY_TEMPLATES), set(research.TOPICS))
        self.assertEqual(len(research.TOOL_IDS), len(set(research.TOOL_IDS)))
        self.assertIn("last30days", research.TOOL_IDS)
        self.assertTrue(set(research.NEEDS_ONE_OF) <= set(research.TOOL_IDS))

    def test_engine_knows_the_status(self):
        self.assertIn("research", e.SET_BY)
        self.assertIn("research", e.PERSON_SET_BY)
        self.assertIn("Users", e.PRODUCT_SECTIONS)


class Checks(unittest.TestCase):
    def test_the_example_passes(self):
        self.assertEqual(errors(example()), [])

    def test_the_market_block_is_checked_like_apps(self):
        rec = example()
        rec["market"]["competitors"][0]["sources"] = ["S9"]
        self.assertTrue(any("market.competitors Pharmacy chain one cites S9" in t for t in errors(rec)))
        rec = example()
        rec["market"]["rivals"] = []
        self.assertTrue(any("market.rivals is not a market field" in t for t in errors(rec)))
        rec = example()
        rec["market"]["gap"] = "a sentence without sources is the agent's own reading"
        self.assertEqual(errors(rec), [])
        rec = example()
        del rec["market"]
        self.assertEqual(errors(rec), [])                                       # the block is optional
        self.assertEqual(research.market_summary(rec)["conventions"], rec["patterns"])   # the patterns stand in

    def test_a_finding_without_a_source_fails_unless_inferred(self):
        rec = example()
        rec["findings"][0]["sources"] = []
        self.assertTrue(any("cites no source" in t for t in errors(rec)))
        rec["findings"][0]["confidence"] = "inferred"
        self.assertEqual(errors(rec), [])

    def test_unknown_source_signal_topic_and_confidence_fail(self):
        rec = example()
        rec["findings"][0]["sources"] = ["S99"]
        rec["findings"][1]["signals"] = ["rich-users"]
        rec["findings"][2]["topic"] = "money"
        rec["findings"][3]["confidence"] = "sure"
        errs = " | ".join(errors(rec))
        for bit in ("S99", "rich-users", "topic must be", "confidence must be"):
            self.assertIn(bit, errs)

    def test_a_source_needs_a_page_or_a_dated_note(self):
        rec = example()
        rec["sources"][0]["url"] = "a survey I remember"
        self.assertTrue(any("needs a url" in t for t in errors(rec)))
        rec["sources"][0]["url"] = "interview, 2026-10-20"
        self.assertEqual(errors(rec), [])

    def test_personal_data_is_refused(self):
        for bad in ("Write to ravi.k@mail.example for details.", "Call +91 98765 43210 to order.", "As @priya_sharma said, it is slow."):
            rec = example()
            rec["findings"][2]["text"] = bad
            self.assertTrue(any("personal data" in t for t in errors(rec)), bad)

    def test_missing_basics_fail(self):
        self.assertTrue(errors({}))
        rec = example()
        rec["brief"] = " "
        rec["date"] = "last week"
        rec["findings"] = []
        errs = " | ".join(errors(rec))
        self.assertIn("brief", errs)
        self.assertIn("date", errs)
        self.assertIn("findings is empty", errs)

    def test_forums_are_not_measured(self):
        rec = example()
        rec["findings"][4]["confidence"] = "measured"  # F5 cites only the forum
        warns = [t for l, t in research.problems(rec) if l == "warning"]
        self.assertTrue(any("only forums" in t for t in warns))

    def test_check_command(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad = Path(tmp, "bad.json")
            bad.write_text(json.dumps({"brief": "x"}), encoding="utf-8")
            self.assertEqual(run(Path(tmp, "od"), "research", "check", str(EXAMPLE)).returncode, 0)
            r = run(Path(tmp, "od"), "research", "check", str(bad))
            self.assertEqual(r.returncode, 1)
            self.assertIn("error", r.stdout)


class Project(unittest.TestCase):
    """A sketched project in a temporary folder."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = tmp.name
        self.d = os.path.join(tmp.name, "opendesigner")
        self.sketch = run(self.d, "sketch", "--name", "Pillbox", "--audience", "regular", "--platforms", "ios,android",
                          "--feel", "calm,friendly")
        self.assertEqual(self.sketch.returncode, 0, self.sketch.stdout + self.sketch.stderr)

    def write(self, rec, name="users.json"):
        p = Path(self.root, name)
        p.write_text(json.dumps(rec), encoding="utf-8")
        return str(p)

    def state(self):
        return e.merge_defaults(e.load_state(self.d))

    def product(self):
        return Path(self.root, "PRODUCT.md").read_text(encoding="utf-8")

    # --- the right time: reminders until done or skipped
    def test_sketch_and_build_remind_until_done(self):
        self.assertIn("engine.py research plan", self.sketch.stdout)
        self.assertIn("engine.py research plan", run(self.d, "build").stdout)
        self.assertEqual(run(self.d, "research", "add", str(EXAMPLE)).returncode, 0)
        self.assertNotIn("research plan", run(self.d, "build").stdout)

    def test_skip_stops_the_reminder_and_is_recorded(self):
        r = run(self.d, "research", "skip", "--why", "we interview our own customers")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertNotIn("research plan", run(self.d, "build").stdout)
        self.assertIn("Not researched: we interview our own customers", self.product())
        self.assertNotEqual(run(self.d, "research", "skip").returncode, 0)  # --why is required

    def test_plan_names_missing_tools_and_never_invents_users(self):
        r = run(self.d, "research", "plan", "--tools", "web-search")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("not known yet", r.stdout)          # the sketch gave no users line: ask, don't invent
        self.assertIn("last30days", r.stdout)
        self.assertIn("Mobbin", r.stdout)
        plan = json.loads(Path(self.d, research.PLAN).read_text(encoding="utf-8"))
        self.assertEqual(plan["brief"], "")
        self.assertIn("<the users>", plan["queries"][0]["query"])
        self.assertEqual(self.state()["research"]["status"], "planned")
        r = run(self.d, "research", "plan", "--brief", "pharmacy customers over 55, on Android", "--tools", "browser,last30days")
        plan = json.loads(Path(self.d, research.PLAN).read_text(encoding="utf-8"))
        self.assertTrue(plan["brief_confirmed"])
        self.assertTrue(all("pharmacy customers over 55" in q["query"] or "<" not in q["query"] for q in plan["queries"]))
        self.assertNotIn("Missing: The /last30days skill", r.stdout)
        self.assertNotEqual(run(self.d, "research", "plan", "--tools", "telepathy").returncode, 0)

    def test_no_web_tool_offers_the_template(self):
        r = run(self.d, "research", "plan", "--tools", "mobbin")
        self.assertIn("Nothing here can read the web", r.stdout)

    # --- add: saves, renders, recommends, changes nothing without a yes
    def test_add_saves_and_recommends_but_changes_nothing(self):
        before = copy.deepcopy(self.state()["answers"])
        r = run(self.d, "research", "add", str(EXAMPLE))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.state()["answers"], before)
        self.assertTrue(Path(self.d, research.FILE).is_file())
        md = Path(self.d, research.DOC).read_text(encoding="utf-8")
        for bit in ("## Findings", "## Sources", "[S1]", "desk research", "## What it means for the design system"):
            self.assertIn(bit, md.lower() if bit == "desk research" else md)
        self.assertIn("## Users", self.product())
        self.assertIn("Researched", self.product())
        st = self.state()["research"]
        self.assertEqual((st["status"], st["findings"], st["sources"]), ("done", 8, 5))
        props = {p["question"]: p for p in st["proposals"]}
        self.assertEqual(props["Q-aud-01"]["status"], "differs")   # the sketch said regular: ask, never overwrite
        self.assertEqual(props["Q-aud-02"]["status"], "new")
        self.assertIn("ASK", r.stdout)

    def test_add_refuses_a_bad_file_and_saves_nothing(self):
        rec = example()
        rec["findings"][0]["sources"] = ["S42"]
        r = run(self.d, "research", "add", self.write(rec))
        self.assertEqual(r.returncode, 1)
        self.assertIn("Nothing was saved", r.stdout)
        self.assertFalse(Path(self.d, research.FILE).exists())
        self.assertNotEqual(self.state()["research"].get("status"), "done")

    def test_accept_applies_new_ones_with_set_by_research(self):
        r = run(self.d, "research", "add", str(EXAMPLE), "--accept")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        ans = self.state()["answers"]
        self.assertEqual(e.answer_value(ans["Q-aud-02"]), "high-trust")
        self.assertEqual(e.answer_value(ans["Q-aud-01"]), "regular")      # differs: untouched without --only
        a4 = e.answer_value(ans["Q-aud-04"])
        self.assertIn("text-size", a4)                                      # the default it had is kept
        self.assertIn("contrast", a4)
        dec = e._decisions(self.d)
        self.assertEqual(dec["answers.Q-aud-02"]["set_by"], "research")
        log = Path(self.d, "decisions.md").read_text(encoding="utf-8")
        self.assertIn("source_ref: research/users.json", log)
        self.assertEqual(run(self.d, "build").returncode, 0)

    def test_only_names_the_ones_the_person_agreed_to(self):
        run(self.d, "research", "add", str(EXAMPLE))
        r = run(self.d, "research", "add", os.path.join(self.d, research.FILE), "--accept", "--only", "Q-aud-01")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        ans = self.state()["answers"]
        self.assertEqual(e.answer_value(ans["Q-aud-01"]), "large")         # they agreed to change their own answer
        self.assertNotIn("Q-aud-03", ans)                                   # not named, not applied
        self.assertEqual(run(self.d, "build").returncode, 0)

    def test_findings_that_disagree_become_a_question(self):
        rec = example()
        rec["findings"].append({"id": "F9", "topic": "context", "text": "Pharmacy staff use the same app all day at the counter.",
                                "confidence": "reported", "sources": ["S2"], "signals": ["all-day-work"]})
        rec["findings"][4]["signals"] = []  # leave older-users (large) against all-day-work (dense)
        run(self.d, "research", "add", self.write(rec), "--accept")
        st = self.state()["research"]
        self.assertTrue(any("Q-aud-01" in c for c in st["conflicts"]))
        self.assertNotIn("Q-aud-01", [p["question"] for p in st["proposals"]])
        self.assertEqual(e.answer_value(self.state()["answers"]["Q-aud-01"]), "regular")
        self.assertIn("Open:", self.product())

    # --- review keeps checking it
    def test_review_reports_missing_research_then_broken_and_old_files(self):
        r = run(self.d, "review")
        self.assertIn("User research: The users have not been researched yet", r.stdout)
        self.assertEqual(run(self.d, "review", "--strict").returncode, 0)   # optional: a note, not a failure
        run(self.d, "research", "add", str(EXAMPLE))
        self.assertNotIn("User research", run(self.d, "review").stdout)
        fp = Path(self.d, research.FILE)
        rec = json.loads(fp.read_text(encoding="utf-8"))
        rec["sources"] = rec["sources"][1:]                                # a source lost by hand
        fp.write_text(json.dumps(rec), encoding="utf-8")
        r = run(self.d, "review", "--strict")
        self.assertEqual(r.returncode, 1)
        self.assertIn("S1, which is not in sources", r.stdout)
        st = e.load_state(self.d)
        st["research"]["date"] = (dt.date.today() - dt.timedelta(days=research.STALE_DAYS + 20)).isoformat()
        e.dump_json(os.path.join(self.d, "state.json"), st)
        self.assertIn("days old", run(self.d, "review").stdout)
        j = json.loads(run(self.d, "review", "--json").stdout)
        self.assertEqual(j["research"]["status"], "done")
        self.assertTrue(j["research"]["errors"])

    def test_skip_after_research_is_refused(self):
        run(self.d, "research", "add", str(EXAMPLE))
        self.assertNotEqual(run(self.d, "research", "skip", "--why", "x").returncode, 0)

    def test_product_md_market_comes_from_the_research_until_their_own_line(self):
        self.assertIn("- **Competitors** (what people would use instead): Not enough information.", self.product())
        quiet(research.add, e, self.d, self.write(example()))
        product = self.product()
        self.assertIn("- **Competitors** (what people would use instead): Pharmacy chain one: search first, with offers "
                      "on the home screen [S5]; Pharmacy chain two: offers and categories first [S5]; Online pharmacy three: "
                      "prescription upload first [S5]; Ordering by phone or WhatsApp from the local chemist: what many do today [S4]. "
                      "*(from the user research: opendesigner/research/users.md)*", product)
        self.assertIn("- **The gap** (what none of them does well, and this product can): Last month's order, ready to repeat", product)
        self.assertIn("## Market", Path(self.d, research.DOC).read_text(encoding="utf-8"))
        quiet(e.cmd_set, self.d, "context.market.gap", "repeat an order by voice", "their words")
        quiet(e.cmd_design_md, self.d)
        product = self.product()
        self.assertIn("- **The gap** (what none of them does well, and this product can): repeat an order by voice.\n", product)
        self.assertIn("Search and offers first", product)                       # the other lines still come from the research

    def test_product_md_never_claims_research_that_was_not_done(self):
        self.assertIn("Not researched yet", self.product() if Path(self.root, "PRODUCT.md").exists()
                      else research.product_section(self.state()))
        self.assertEqual(research.product_section({"research": {"status": "planned"}}).split(",")[0], "Research planned")


DIR_EXAMPLE = SKILL / "assets/output/research-directions.example.json"
TEMPLATE = SKILL / "assets/templates/direction-board.html"
RESEARCH = HERE / "research.py"


def directions():
    return json.loads(DIR_EXAMPLE.read_text(encoding="utf-8"))


def ledger_for(rec, **over):
    """A photo ledger with every photo the directions name, looked at and clear."""
    out = {}
    for dr in rec["directions"]:
        for n in [x for x in dr["photos"] if isinstance(x, str)]:
            out[n] = {"name": n, "file": f"{n}.jpg", "source": "openverse", "licence": "CC0", "verdict": "ok", "brand_check": "clear",
                      "grade": dr["photo_grade"], "title": n.replace("-", " "), **over}
    return out


def confirmed():
    return {"status": "confirmed", "for": {"text": "people over 55"}, "problem": {"text": "reordering takes too long"},
            "claim": {"text": "last month's order in one tap"}, "proof": [{"text": "a pilot with 40 customers"}]}


def dprobs(rec, state=None, users="example", ledger=None, pos="confirmed", level="error"):
    users = example() if users == "example" else users
    pos = confirmed() if pos == "confirmed" else pos
    ledger = ledger_for(rec) if ledger is None else ledger
    return [t for l, t in research.directions_problems(rec, state or {}, users, ledger, pos) if l == level]


class Market(unittest.TestCase):
    """The competitor table and the benchmark the person sees before any colour."""

    def test_example_table_is_ready_and_counted(self):
        rec = example()
        self.assertEqual(errors(rec), [])
        self.assertEqual(len([x for x in research.competitors(rec) if research.table_ready(x)]), 3)
        cat = research.category(rec)
        self.assertEqual(cat["accents"], {"blue": 2, "green": 1})
        self.assertEqual(cat["grounds"], {"light": 2, "dark": 1})
        self.assertIn("orange", cat["unused_accents"])
        self.assertIn("tinted", cat["unused_grounds"])
        md = research.market_table_md(rec)
        for bit in ("## Competitors, measured", "[Pharmacy chain one](https://chain-one.example)", "`#0A6CFF` cta", "## Industry benchmark",
                    "Stays theirs", "Nobody uses"):
            self.assertIn(bit, md)

    def test_bad_rows_fail(self):
        rec = example()
        c = rec["market"]["competitors"]
        c[0]["colors"][2]["hex"] = "blue"
        c[1].pop("url")
        c[2]["cta"]["shape"] = "blob"
        rec["market"]["benchmark"][0].pop("takes")
        errs = " | ".join(errors(rec))
        for bit in ("needs a hex", "colours need the url", "cta needs a shape", "needs takes"):
            self.assertIn(bit, errs)

    def test_a_thin_table_warns(self):
        rec = example()
        rec["market"]["competitors"] = rec["market"]["competitors"][:1]
        warns = [t for l, t in research.problems(rec) if l == "warning"]
        self.assertTrue(any("before any colour" in t for t in warns))

    def test_colour_maths(self):
        self.assertEqual([research.hue_family(h) for h in ("#FF0000", "#0000FF", "#00A86B", "#808080", "#FF8C00", "#7E33FF")],
                         ["red", "blue", "green", "neutral", "orange", "violet"])
        self.assertEqual([research.ground_kind(h) for h in ("#FFFFFF", "#0A0A0A", "#F2E6C9")], ["light", "dark", "tinted"])
        self.assertAlmostEqual(research.contrast("#FFFFFF", "#000000"), 21, places=3)
        self.assertLess(research.distance("#0A6CFF", "#0B6DFF"), research.NEAR_ERROR)


class Directions(unittest.TestCase):
    """Three directions that truly differ, after the research, with licensed photos looked at for brands."""

    def test_example_passes(self):
        self.assertEqual(dprobs(directions()), [])

    def test_research_and_positioning_come_first(self):
        rec = directions()
        self.assertTrue(any("research first" in t for t in dprobs(rec, users=None)))
        self.assertTrue(any("positioning is not confirmed" in t for t in dprobs(rec, pos={"status": "draft"})))
        thin = example()
        thin["market"]["competitors"] = thin["market"]["competitors"][:2]
        self.assertTrue(any("competitor table has 2" in t for t in dprobs(rec, users=thin)))
        skipped = {"research": {"status": "skipped"}}
        self.assertEqual(dprobs(rec, state=skipped, users=None), [])                 # skipped by the person: a warning
        self.assertTrue(dprobs(rec, state=skipped, users=None, level="warning"))
        self.assertTrue(any("positioning" in t for t in dprobs(rec, state=skipped, users=None, pos=None)))  # still needed

    def test_ground_is_read_from_the_colour(self):
        rec = directions()
        for dr in rec["directions"]:
            dr["colors"]["ground"], dr["colors"]["ink"] = "#FFFFFF", "#111111"
        errs = " | ".join(dprobs(rec))
        self.assertIn("reads light: the colour decides", errs)
        self.assertIn("share the same ground", errs)

    def test_odd_inputs_never_crash_the_board(self):
        rec = directions()
        rec["directions"][0]["photos"].append({"name": "x"})
        self.assertTrue(any("must be names" in t for t in dprobs(rec)))
        rec = directions()
        rec["directions"][0]["colors"]["ground"] = "FFFFFF"
        led = ledger_for(rec)
        led["kitchen-table-morning"]["page"] = "javascript:alert(1)"
        data = research.board_payload(rec, {}, example(), led, confirmed())
        self.assertEqual(data["directions"][0]["colors"]["ground"], "#FFFFFF")
        self.assertEqual(data["directions"][0]["photos"][0]["page"], "")
        self.assertTrue(research.is_b2b({}, {"answers": {"Q-aud-02": "work, state-stressed"}}))

    def test_a_rejected_photo_stays_off(self):
        rec = directions()
        led = ledger_for(rec)
        led["clinic-window"]["status"] = "rejected"
        self.assertTrue(any("was rejected" in t for t in dprobs(rec, ledger=led)))
        self.assertTrue(research.AI_CAPTION.search("Created with Midjourney"))
        self.assertFalse(research.AI_CAPTION.search("We photograph every order"))

    def test_exactly_three(self):
        rec = directions()
        rec["directions"] = rec["directions"][:2]
        self.assertTrue(any("exactly 3" in t for t in dprobs(rec)))

    def test_accent_swaps_read_identical(self):
        rec = directions()
        a, b = rec["directions"][0], rec["directions"][1]
        for k in ("ground", "type", "photo_grade", "rhythm"):
            b[k] = copy.deepcopy(a[k])
        b["colors"] = dict(a["colors"], accent="#1D6B3A")
        errs = " | ".join(dprobs(rec, ledger={}))
        self.assertIn("directions A and B share the same ground, type pairing, photo grade, layout rhythm", errs)

    def test_settled_axes_stay_the_same(self):
        rec = directions()
        rec["fixed"] = ["type"]
        self.assertTrue(any("settled by the person" in t for t in dprobs(rec)))
        for dr in rec["directions"]:
            dr["type"] = {"display": "Inter", "text": "Inter", "class": "grotesk"}
        self.assertEqual(dprobs(rec), [])
        rec["fixed"] = ["type", "ground", "rhythm"]
        for dr in rec["directions"]:
            dr["ground"], dr["rhythm"] = "light", "stack"
            dr["colors"]["ground"], dr["colors"]["ink"] = "#FFFFFF", "#111111"
        self.assertTrue(any("only 2 axes are left" in t for t in dprobs(rec)))

    def test_a_competitors_colour_is_theirs(self):
        rec = directions()
        rec["directions"][0]["colors"]["accent"] = "#0A6CFF"
        self.assertTrue(any("Pharmacy chain one's colour" in t for t in dprobs(rec)))
        rec["directions"][0]["colors"]["accent"] = "#1F74F0"
        self.assertTrue(any("close to" in t for t in dprobs(rec, level="warning")))

    def test_contrast_floors(self):
        rec = directions()
        rec["directions"][0]["colors"]["ink"] = "#BBBBBB"
        rec["directions"][1]["colors"]["accent"] = "#1A2026"
        errs = " | ".join(dprobs(rec))
        self.assertIn("text needs 4.5:1", errs)
        self.assertIn("needs 3:1", errs)

    def test_identity_firewall(self):
        rec = directions()
        rec["directions"][0]["devices"].append("Basket mascot in the hero")
        rec["directions"][1]["references"][0]["name"] = "Pharmacy chain two"
        rec["directions"][2]["references"] = rec["directions"][2]["references"][:1]
        errs = " | ".join(dprobs(rec))
        self.assertIn("signature device", errs)
        self.assertIn("is the competitor Pharmacy chain two", errs)
        self.assertIn("at least 2 references", errs)
        rec = directions()
        rec["directions"][0]["devices"] = ["a basket-shaped mascot"]                  # reworded, still theirs
        rec["directions"][1]["references"][0]["url"] = "https://www.chain-one.example/home"   # a competitor's own site
        rec["directions"][2]["references"][0].pop("signature")
        errs = " | ".join(dprobs(rec))
        self.assertIn("uses 'a basket-shaped mascot'", errs)
        self.assertIn("is the competitor Pharmacy chain one", errs)
        self.assertIn("name its signature device", errs)
        self.assertFalse(research._same_device("crest over a closed grid", "closed grid"))

    def test_photos_are_licensed_looked_at_and_uncaptioned(self):
        rec = directions()
        led = ledger_for(rec)
        led["kitchen-table-morning"]["brand_check"] = "pending"
        led["pharmacist-counter"]["verdict"] = "blocked"
        led["family-phone-evening"]["caption"] = "AI-generated image"
        led["medicine-shelf-warm"]["ai_generated"] = True
        led["clinic-window"]["grade"] = "mono"
        errs = " | ".join(dprobs(rec, ledger=led))
        warns = " | ".join(dprobs(rec, ledger=led, level="warning"))
        self.assertIn("look at it for brand names", errs)
        self.assertIn("blocked by its licence", errs)
        self.assertIn("'AI generated' caption", errs)
        self.assertIn("AI-made: tell the person", warns)
        self.assertIn("graded mono", warns)
        rec["directions"][0]["photos"] = []
        self.assertTrue(any("needs licensed stock photos" in t for t in dprobs(rec)))

    def test_b2b_defaults_to_natural_light(self):
        rec = directions()
        rec["b2b"] = True
        rec["recommended"] = "B"
        rec["directions"][1]["photo_grade"] = "low-key"
        warns = " | ".join(dprobs(rec, ledger=ledger_for(rec), level="warning"))
        self.assertIn("natural light", warns)
        self.assertIn("can read dead", warns)
        self.assertTrue(research.is_b2b({}, {"answers": {"Q-aud-02": {"value": "work"}}}))

    def test_template_is_self_contained_and_its_sample_differs(self):
        page = TEMPLATE.read_text(encoding="utf-8")
        self.assertIn('id="od-data"', page)
        self.assertIn("Copy my choice", page)
        self.assertIn("OD:direction", page)
        self.assertNotRegex(page, r'(src|href)="https?://')
        sample = json.loads(re.search(r'<script type="application/json" id="od-data">(.*?)</script>', page, re.S).group(1))
        ds = sample["directions"]
        self.assertEqual(len(ds), 3)
        for k in research.AXES:
            self.assertEqual(len({json.dumps(research._axis(x, k)) for x in ds}), 3, k)
        self.assertFalse(any(research.AI_CAPTION.search(p["title"]) for x in ds for p in x["photos"]))


class DirectionsProject(Project):
    """The whole path in a project: findings, the table, positioning, photos, the board and the pick."""

    def cli(self, *args):
        return subprocess.run([sys.executable, str(RESEARCH), "--dir", self.d, *args], capture_output=True, text=True, timeout=120)

    def test_end_to_end(self):
        self.assertEqual(run(self.d, "research", "add", self.write(example())).returncode, 0)
        users_md = Path(self.d, research.DOC).read_text(encoding="utf-8")
        self.assertIn("## Competitors, measured", users_md)
        r = self.cli("market")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("Pharmacy chain two", r.stdout)
        r = self.cli("directions", "check", str(DIR_EXAMPLE))
        self.assertEqual(r.returncode, 1)
        self.assertIn("positioning is not confirmed", r.stdout)
        r = self.cli("positioning", "draft")
        self.assertEqual(r.returncode, 0, r.stderr)
        p = json.loads(Path(self.d, research.POSITIONING).read_text(encoding="utf-8"))
        self.assertEqual(p["status"], "draft")
        self.assertEqual(p["proof"], [])                       # the proof is never invented
        self.assertIn("The proof", p["needs"])
        self.assertTrue(p["claim"]["text"])                    # from the market gap
        self.assertNotEqual(self.cli("positioning", "confirm").returncode, 0)
        p["proof"] = [{"text": "an invented number"}]                          # a proof the agent wrote is never confirmed
        Path(self.d, research.POSITIONING).write_text(json.dumps(p), encoding="utf-8")
        self.assertNotEqual(self.cli("positioning", "confirm").returncode, 0)
        self.assertNotEqual(self.cli("positioning", "confirm", "--proof", "<a number>").returncode, 0)
        r = self.cli("positioning", "confirm", "--proof", "a pilot with 40 customers")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.state()["research"]["positioning"]["proof"], ["a pilot with 40 customers"])
        self.assertNotEqual(self.cli("positioning", "draft").returncode, 0)  # confirmed: never redrafted over
        photos = Path(self.d, research.PHOTO_DIR)
        photos.mkdir(parents=True)
        rec = directions()
        Path(photos, "ledger.json").write_text(json.dumps({"items": list(ledger_for(rec).values())}), encoding="utf-8")
        dest = Path(self.d, research.DIRECTIONS)
        dest.write_text(json.dumps(rec), encoding="utf-8")
        r = self.cli("directions", "check")
        self.assertEqual(r.returncode, 0, r.stdout)
        r = self.cli("directions", "board")
        self.assertEqual(r.returncode, 0, r.stdout)
        board = Path(self.d, research.BOARD).read_text(encoding="utf-8")
        data = json.loads(re.search(r'<script type="application/json" id="od-data">(.*?)</script>', board, re.S).group(1))
        self.assertEqual([x["id"] for x in data["directions"]], ["A", "B", "C"])
        self.assertEqual(data["directions"][0]["photos"][0]["src"], "photos/kitchen-table-morning.jpg")
        self.assertTrue(data["positioning"][3].endswith("a pilot with 40 customers"))
        self.assertTrue(data["category"]["swatches"])
        self.assertNotEqual(self.cli("directions", "pick", "D").returncode, 0)
        self.assertNotEqual(self.cli("directions", "pick", "A", "--remix", "colour=B").returncode, 0)
        r = self.cli("directions", "pick", "A", "--remix", "accent_use=B")         # B's yellow accent on A's white ground: unreadable
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("contrast", r.stdout + r.stderr)
        r = self.cli("directions", "pick", "A", "--remix", "photo_grade=C", "--remix", "ground=C", "--why", "liked: A")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        st = self.state()["research"]["direction"]
        self.assertEqual((st["id"], st["remix"]), ("A", {"photo_grade": "C", "ground": "C"}))
        self.assertEqual((st["colors"]["ground"], st["colors"]["accent"]), ("#CFE3DA", "#B4361F"))
        self.assertEqual(json.loads(dest.read_text())["chosen"]["id"], "A")
        run(self.d, "design-md")
        users, positioning = self.product().split("## Users", 1)[1].split("## Positioning", 1)
        self.assertNotIn("Direction A", users)                                    # its own section, not inside Users
        self.assertIn("Confirmed ", positioning)
        self.assertIn("Direction A, Kitchen table", positioning)


class PhotoGrades(unittest.TestCase):
    def test_same_grades_in_research_and_illustrate(self):
        sys.path.insert(0, str(SKILL.parent / "opendesigner-illustrate" / "scripts"))
        import illustrate
        self.assertEqual(research.PHOTO_GRADES, illustrate.PHOTO_GRADES)
        self.assertEqual(research.PHOTO_DIR, illustrate.PHOTO_DIR.split("/", 1)[1])


class Process(unittest.TestCase):
    """The instructions put the step at the right time and stay in step with the code."""

    def read(self, rel):
        return (SKILL / rel).read_text(encoding="utf-8")

    def test_skill_points_to_the_step(self):
        s = self.read("SKILL.md")
        self.assertIn("references/research.md", s)
        self.assertIn("engine.py research", s)
        self.assertIn("/last30days", s)

    def test_the_offer_after_the_sketch_starts_with_research(self):
        z = self.read("references/zoom.md")
        offer = z.split("## The offer after every level", 1)[1]
        self.assertLess(offer.index("research"), offer.index("Offer at most 3 choices"))

    def test_research_md_lists_every_signal_tool_and_topic(self):
        r = self.read("references/research.md")
        for sid in research.SIGNALS:
            self.assertIn(f"`{sid}`", r, sid)
        for t in research.TOOL_IDS:
            self.assertIn(f"`{t}`", r, t)
        self.assertEqual(len(re.findall(r"^\d\. \*\*(Who|Context|Apps|Expectations|Preferences that touch design|Accessibility|Market):\*\*", r,
                                        flags=re.M)), len(research.TOPICS))

    def test_research_md_documents_positioning_and_directions(self):
        r = self.read("references/research.md")
        for bit in ("research.py market", "research.py positioning", "research.py directions", "direction-board", "photos search",
                    "natural light", "signature device"):
            self.assertIn(bit, r, bit)
        for v in research.PHOTO_GRADES + research.ACCENT_USES + research.RHYTHMS + research.CTA_SHAPES:
            self.assertIn(f"`{v}`", r, v)

    def test_status_is_documented_and_extend_checks_it(self):
        self.assertIn("| `research` |", self.read("references/rules.md"))
        ext = (SKILL.parent / "opendesigner-extend/SKILL.md").read_text(encoding="utf-8")
        self.assertIn("research.md", ext)


if __name__ == "__main__":
    unittest.main(verbosity=1)
