# The whole process, step by step

What the person does, what the agent runs, and what exists after each step.

| # | Step | The person | The agent runs | What exists afterwards |
|---|---|---|---|---|
| 0 | **Ask** | "Make a painted hero for our launch", "a celebration loop", "a hand-made-looking film in our colours" | Picks this skill. If no design system exists, offers the opendesigner interview first (or a quick palette from one colour) | A clear request and a slot |
| 1 | **Look** | Nothing | `paint.py doctor`; reads DESIGN.md and `state.json` (dials, Q-img answers, hooks, context) | It knows Node, npm and ffmpeg are present and what the brand already decided. The engine is already in the skill |
| 2 | **Consent to install** (once per film project) | Says yes or no to the npm packages (pinned p5, p5.brush, Vite, Playwright) and a Chromium build | Nothing yet; it asks | A yes for step 5. On a no, stop at a written brief |
| 3 | **Brief** | Answers one question: this style, or another? Gives the message in one line if asked | `paint.py brief --slot <slot> --message "..."` | `opendesigner/paintings/<slot>/brief.md` and `.json`: style and reasons, palette families, font decision, text, motion, sound and identity rules |
| 4 | **Shot list** | Approves or edits the list | The agent plans shots from the brief (`painting-workflow.md`): frames, archetype, subject, family, material, sound | An agreed plan; nothing painted yet |
| 5 | **Scaffold** | Nothing (already consented) | `paint.py scaffold <dir> --style <style> --id <id>`, then `npm ci` and `npx playwright install chromium` in it | A runnable film project with `src/brand.js` and `BRIEF.md` |
| 6 | **Paint plates** | Looks at the plates the agent shows, says what to change | Writes one scene per plate using `family(...)`; `npm run plates -- --only <id>`; looks at each plate at full size; `paint.py lint <dir>` | Lossless PNG plates in brand colours, no text inside, no copied library art |
| 7 | **Motion and sound** (films) | Optional choices: particles, draw-on, line boil, score | Sets them in `film.js`; recolours the particles in `src/particles.js` from `src/brand.js` | A timed film plan |
| 8 | **Export and verify** | Watches the contact sheet or the film | `npm run export` (fails if any check fails), `cut_audit.py`, visual review | MP4 delivery and master, WAV, plates, contact sheet, `manifest.json`, `checks.json`; a report of what was measured and what was watched |
| 9 | **Bring it in** | Says where it goes, and whether it carries meaning (a label) or is decorative | `paint.py ingest <dir> --to <app folder> --as react\|html\|img` | The MP4 and poster in the app; a component that is muted, shows a still for reduced motion and has a pause control over 5 s; a ledger row and `CREDITS.md` |
| 10 | **Check in the app** | Looks at it on phone and desktop, light and dark, reduced motion on and off | opendesigner-review (or the agent's own pass) | Evidence that it reads, stays out of the way, and respects the floors |
| 11 | **Record** | Nothing | `engine.py set hooks.H-motion.status '"tool"'` (or `H-illus`), `engine.py review` | DESIGN.md and the decision log know the art exists, where it came from and who owns it |

## Branches
- **No design system:** `paint.py brief --accent '#hex'`. The palette is built from one colour; offer the interview afterwards.
- **No installs allowed** (or claude.ai): stop after step 3. The brief is a written commission for a person or another tool.
- **A still painting** (og-image, empty-state, background): skip step 7. The deliverable is a plate PNG, brought in with `ingest --as img`.
- **Checks fail at step 8:** fix and export again. `ingest` refuses failed exports.
- **The person wants another look:** run `brief --style <other>`, then repaint. The engine replays the same geometry in a new material, so scenes stay the same.
