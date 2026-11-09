# Improving OpenDesigner (the self-improvement loop)

OpenDesigner gets better when you say what went wrong. This covers BRIEF requirement 16 and lane U3. All nine skills link here.

## When to use it
Record feedback the moment you notice one of these:
| Kind | Example |
|---|---|
| `gap` | A building block, question or option is missing. For example, there is no question for chart colors in dark mode. |
| `bug` | The engine or a template gives a wrong or failing result. For example, validate passes a pair that fails contrast. |
| `confusing` | A step made the person hesitate, or a question needed re-asking or explaining twice. |
| `idea` | A better default, wording, visual, or order. |

Don't interrupt the person for this. Record it quietly, and mention it once at the end of the level or the session.

## In someone's project (the usual case)
1. Record it: `engine.py feedback "<area or question id>: <what happened, what you expected>" --kind gap|bug|confusing|idea`. The engine appends it to `opendesigner/feedback.md` and prints a pre-filled issue link for github.com/ckryptickunal/OpenDesigner.
   - If the journey log is on and shows where they got stuck, add `--from-journey`. It adds the hotspots from the log: question ids and counts only, never notes.
2. Write about OpenDesigner, not about their product. Leave out names, customers, private URLs, file contents and anything else they didn't choose to share.
3. At the end, show the feedback in one short list, and offer the link: "Want to send these to the OpenDesigner project? The link opens a pre-filled issue. You check it and press submit yourself." Nothing is posted without their OK.
4. If `gh` is installed and they say yes, you may run `gh issue create --repo ckryptickunal/OpenDesigner` with the same title and body. Show the exact command first.
5. If they are offline or say no, the notes stay in `opendesigner/feedback.md`, and nothing leaves their machine.
6. An anonymous report can go with an issue, only with their OK: `journey.py export --anon` writes it (`docs/PRIVACY.md`). Shared reports never go through GitHub issues, because an issue is posted under their account.

**The owner's notes on the work** are not feedback about OpenDesigner. Record each with `engine.py feedback "<the rule>" --kind note`. Said twice, it is a rule in `opendesigner/RULES.md`. At the third time the engine prints one question offering a GitHub issue: ask it once, and file the issue only after a yes, about OpenDesigner, with nothing private.

## Inside the OpenDesigner repo itself
You are in the repo when `_coordination/PROTOCOL.md` and `tools/od.py` exist. Then fix the source directly:
1. Edit the source, never a generated copy.
   - Interview text lives in `skills/<skill>/SKILL.md` and `skills/opendesigner/references/*.md` (zoom, rules, improve, hooks, guardrails).
   - Questions, options, defaults and cards live in `synthesis/`: `QUESTIONNAIRE.md` (then run `python3 tools/build_questionnaire.py`), `levers.json`, `ontology.json` and `glossary.json`.
   - Templates live in `skills/opendesigner/assets/templates/`. The engine, `skills/opendesigner/scripts/engine.py`, is owned by R2: message them instead.
   - Never edit `.agents/`, `.claude/`, `data/`, `references/stages/`, `references/cards/`, `references/*.json` or `chatgpt-project/knowledge/`. They are generated. One exception: `references/report.schema.json` is written by hand, and `journey.py` and `server/telemetry/` read it.
2. Rebuild and check:
   ```
   python3 tools/build_data.py && python3 tools/sync_skills.py
   python3 tools/build_data.py --check && python3 tools/sync_skills.py --check
   python3 tools/build_dist.py --check && python3 tools/jev_nav.py check
   ```
3. Record why with `python3 tools/od.py log "<what changed and why>"`. Then commit and push following `_coordination/PROTOCOL.md` section 4. When other sessions share the checkout, commit only your paths (`git commit -- <paths>`), because `od.py sync` adds everything. If you don't own the file, send its owner a message with `od.py send` instead of editing it.
4. For a research claim, add the source to the lane's `traces/` file and cite it. If you can't cite it, mark it `[inferred]`.
5. When the owner gives an instruction, or a session makes a mistake worth not repeating, append it to `_coordination/OWNER-FEEDBACK.md` (his words, what it means, its status). Then turn it into a rule where agents will read it: `_coordination/PROTOCOL.md`, `learn/IMPROVING.md`, a skill reference or a test. A note in one tool's private memory is not enough, because other models and hosts never see it.
   - A mistake in visual work becomes a check, in the same change: a numbered line in `opendesigner-preflight/references/checklist.md` with its story in `mistakes.md`, a row in `making.md` section 10 (or 11 for a tell), and, when a review should catch it, a case in `synthesis/review-cases.json` (then `python3 tools/build_data.py`).
   - When it can be measured, add a small tool and name it in the check: `site/check_layout.py` (alignment at 13 widths), `brand/tools/check_dates.py` (weekdays), `brand/tools/check_names.py` (names). Mark the row's status in OWNER-FEEDBACK.md with the files that address it.
