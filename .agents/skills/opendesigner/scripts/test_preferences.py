#!/usr/bin/env python3
"""Tests for preferences.py. No files are written and nothing is sent."""
import copy
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preferences as p  # noqa: E402


class Resolve(unittest.TestCase):
    def test_absent_or_malformed_profile_changes_nothing(self):
        state = {"name": "Acme", "profile": {"voice": "plain", "tracking": "on"}, "answers": {"Q-scope-01": "app"}}
        before = copy.deepcopy(state)
        self.assertEqual(p.resolve(state, None)["applied"], [])
        self.assertEqual(p.resolve(state, {"preferences": "nope"})["ignored"][0]["reason"], "malformed")
        self.assertEqual(state, before)

    def test_project_voice_wins_when_it_conflicts(self):
        state = {"profile": {"voice": "designer"}}
        report = p.resolve(state, {"preferences": [
            {"key": "explanation_voice", "value": "engineer", "scope": "user-workflow"},
        ]})
        self.assertEqual(report["applied"], [])
        self.assertEqual(report["asks"][0]["project_value"], "designer")
        self.assertEqual(report["asks"][0]["proposed"], "engineer")

    def test_locked_voice_cannot_be_overridden(self):
        state = {"profile": {"voice": "plain"}, "locks": {"profile.voice": True}}
        report = p.resolve(state, {"preferences": [
            {"key": "explanation_voice", "value": "engineer", "scope": "user-workflow"},
        ]})
        self.assertEqual(report["ignored"][0]["reason"], "locked")
        self.assertEqual(report["applied"], [])

    def test_tracking_and_project_facts_never_inherit(self):
        state = {"name": "Secret", "profile": {"tracking": "off", "share_reports": "never"}}
        before = copy.deepcopy(state)
        report = p.resolve(state, {"preferences": [
            {"key": "tracking", "value": "on", "scope": "user-workflow"},
            {"key": "share_reports", "value": "always", "scope": "user-workflow"},
            {"key": "answers", "value": {"Q-color-01": "#ff00aa"}, "scope": "user-workflow"},
            {"key": "name", "value": "Other", "scope": "user-workflow"},
            {"key": "show_example_before_asking", "value": True, "scope": "user-workflow"},
        ]})
        self.assertEqual(state, before)
        reasons = {item["key"]: item["reason"] for item in report["ignored"]}
        self.assertEqual(reasons["tracking"], "not-portable")
        self.assertEqual(reasons["share_reports"], "not-portable")
        self.assertEqual(reasons["answers"], "not-portable")
        self.assertEqual(reasons["name"], "not-portable")
        self.assertEqual(report["applied"], [{
            "key": "show_example_before_asking", "value": True,
            "scope": "user-workflow", "source": "explicit-user-choice",
        }])
        self.assertNotIn("Secret", str(report))
        self.assertNotIn("#ff00aa", str(report))

    def test_matching_voice_stays_a_project_value(self):
        report = p.resolve({"profile": {"voice": "plain"}}, {"preferences": [
            {"key": "explanation_voice", "value": "plain", "scope": "user-workflow"},
        ]})
        self.assertEqual(report["applied"], [])
        self.assertEqual(report["kept_project"][0]["source"], "project")


class Proposal(unittest.TestCase):
    def test_export_is_local_and_strips_private_bits(self):
        packet = p.improvement_proposal(
            "The type step is long. Contact me at a@b.co about https://secret.example/path and #11aa22."
        )
        self.assertFalse(packet["posted"])
        self.assertFalse(packet["includes_project_state"])
        self.assertEqual(packet["scope"], "repo-contribution")
        self.assertNotIn("a@b.co", packet["text"])
        self.assertNotIn("secret.example", packet["text"])
        self.assertNotIn("#11aa22", packet["text"])
        self.assertIn("type step", packet["text"])


if __name__ == "__main__":
    unittest.main()
