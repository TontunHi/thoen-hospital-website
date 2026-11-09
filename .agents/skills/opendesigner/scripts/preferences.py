#!/usr/bin/env python3
"""Resolve a user-workflow preference against one project's state.

This module does not read or write files, does not inherit tracking or sharing
consent, and does not send anything. Cloud sync is intentionally absent.
A project decision stays in that project's state. A portable preference is
applied only in the returned report, and only when it does not conflict.
"""
from __future__ import annotations

import re

# Portable process choices. Project facts, tokens, names and consent flags are not in this list.
ALLOWLIST = {
    "explanation_voice": {"plain", "designer", "engineer"},
    "show_example_before_asking": {True, False},
}
# Privacy permissions and the project voice key. Never copy these from outside the project.
FORBIDDEN = {"tracking", "share_reports", "voice"}
PROJECT_FACTS = {"name", "answers", "references", "taste", "dials", "raw", "tokens", "context", "hooks", "overrides"}

_PRIVATE = re.compile(
    r"https?://\S+"
    r"|\b[\w.+-]+@[\w.-]+\.\w+\b"
    r"|#[0-9A-Fa-f]{3,8}\b"
    r"|(?:^|[\s])/(?:[\w.-]+/)+[\w.-]+"
)


def _locks(project_state, locked):
    found = set(locked or [])
    raw = project_state.get("locks") if isinstance(project_state, dict) else None
    if isinstance(raw, dict):
        found.update(key for key, on in raw.items() if on)
    elif isinstance(raw, list):
        found.update(raw)
    return found


def resolve(project_state, external=None, locked=None):
    """Return which portable preferences apply. Does not mutate project_state.

    Absent or malformed external input is ignored. The caller keeps the project as it was.
    """
    project_state = project_state if isinstance(project_state, dict) else {}
    profile = project_state.get("profile") if isinstance(project_state.get("profile"), dict) else {}
    locks = _locks(project_state, locked)
    report = {"applied": [], "kept_project": [], "ignored": [], "asks": [], "mutated": False}

    if external is None:
        return report
    prefs = external.get("preferences") if isinstance(external, dict) else None
    if not isinstance(prefs, list):
        report["ignored"].append({"key": None, "reason": "malformed"})
        return report

    for item in prefs:
        if not isinstance(item, dict):
            report["ignored"].append({"key": None, "reason": "malformed-entry"})
            continue
        key = item.get("key")
        if key in FORBIDDEN or key in PROJECT_FACTS:
            report["ignored"].append({"key": key, "reason": "not-portable"})
            continue
        if key not in ALLOWLIST:
            report["ignored"].append({"key": key, "reason": "not-allowlisted"})
            continue
        value = item.get("value")
        if value not in ALLOWLIST[key]:
            report["ignored"].append({"key": key, "reason": "invalid-value"})
            continue
        if item.get("scope") not in (None, "user-workflow"):
            report["ignored"].append({"key": key, "reason": "wrong-scope"})
            continue

        if key == "explanation_voice":
            local = profile.get("voice")
            path = "profile.voice"
            if path in locks:
                report["ignored"].append({"key": key, "reason": "locked", "project_value": local})
                report["kept_project"].append({"key": path, "value": local})
                continue
            if local not in (None, "") and local != value:
                report["asks"].append({
                    "key": key, "project_value": local, "proposed": value,
                    "reason": "project voice and user-workflow voice differ",
                })
                continue
            if local == value:
                report["kept_project"].append({"key": path, "value": local, "source": "project"})
                continue

        report["applied"].append({
            "key": key, "value": value, "scope": "user-workflow", "source": "explicit-user-choice",
        })
    return report


def improvement_proposal(text):
    """A review packet for a product change. Nothing is posted or copied from project state."""
    cleaned = _PRIVATE.sub(" [removed]", " ".join(str(text or "").split()))
    cleaned = " ".join(cleaned.split())
    return {
        "kind": "product-improvement",
        "scope": "repo-contribution",
        "text": cleaned,
        "posted": False,
        "includes_project_state": False,
    }
