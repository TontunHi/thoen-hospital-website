## Design system (OpenDesigner)
This project's design system lives in `opendesigner/`, and `DESIGN.md` is its living spec.

**`opendesigner/PROTOCOL.md` is binding.** Follow its steps, gates and checks in every session, whoever you are. Read `opendesigner/RULES.md` before each round: it holds the owner's repeated notes.

**Before any UI, styling or visual work**
1. Read `DESIGN.md` and `PRODUCT.md` at the project root.
2. Use the tokens in `opendesigner/tokens/` (DTCG, canonical) or their exports in `opendesigner/build/` (for example `build/css/tokens.css` or `build/tailwind/theme.css`).
3. Never hard-code colors, font sizes, spacing, radii, shadows or durations.
4. Check `opendesigner/decisions.md` for why a value is what it is. Locked decisions (`locks` in `opendesigner/state.json`) change only with the owner's consent.
5. Follow the standards listed in DESIGN.md (for example: which easing, which properties to animate, which library for toasts). They are rules, not suggestions. Only the owner can change one, and only when they ask: `engine.py standard override <id> --why "<their words>"` for one value, or `engine.py standard add ... --beats <id>` when their own rule always wins. `engine.py set --force` never changes a standard's value.

**At the end of every implementation** (a page, a component, a refactor)
1. Run `python3 <opendesigner skill>/scripts/engine.py review`. It lists hard-coded values that skip the tokens, code that breaks a standard, DESIGN.md sections that are out of date, code that uses no tokens, and a system older than the code.
2. Re-read the DESIGN.md sections you touched.
3. If the work needed a value the system lacks, add it as a decision: `engine.py set <path> <value> --why "..."`, then `engine.py design-md`. Don't inline it.
4. Fix any drift `review` reports before the next draft.
5. Show the result: screenshots or an artifact, before and after, with each check and its result.

**To change or extend the system,** use the `opendesigner-extend` skill. The accessibility floors are part of the system, not options: WCAG 2.2 AA contrast, 24 px minimum targets, visible focus and reduced motion.

**`opendesigner/journey/` is a private log of the owner's steps.** It stays out of git. Never commit it, share it or read it into other work.

**If a step was missing, wrong or confusing,** record it with `engine.py feedback "..." --kind gap|bug|confusing|idea`. Nothing is posted without the owner's OK.
