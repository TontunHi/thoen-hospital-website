# Protocol

How work runs in this project. Every agent follows it. Written by OpenDesigner on {{date}}; edit it to fit.

## Six steps, each ending at a gate
Show what the gate names, get the owner's yes, tick the box with the date, then start the next step. Skip a step only when the owner says so ("just do it" counts); name the steps you skip, in one line.

| Step | Do | Show at the gate | Gate |
|---|---|---|---|
| 1 Discover | Read the repo and the owner's documents. Fill in the brief (below). A built product starts with the audit | The brief | [ ] |
| 2 Research | Shipped references for each section (Mobbin when connected; live sites measured with opendesigner-extract). The users and the market (`engine.py research plan`, `research market`) | The competitor table, the positioning the owner confirmed, and the direction board (`research directions board`) | [ ] |
| 3 System | The OpenDesigner sketch (it may come earlier, as a draft), then the areas that matter. `engine.py build` | The overview, as screenshots or an artifact | [ ] |
| 4 Structure | Pages, section order, the parts each needs, grey wireframes built from tokens | Wireframes at desktop and phone | [ ] |
| 5 Build | Parts first, then pages. Every value from `opendesigner/build/` | Every round (below) | [ ] |
| 6 Verify | The milestone checks (below) on every page | The audit and its fixes | [ ] |

## Every round
1. Read this file, `RULES.md` and `decisions.md`.
2. Take every value from the tokens. A value the system lacks becomes a decision (`engine.py set`), never a literal.
3. Render it. Run `engine.py review`, opendesigner-review on each changed page, and opendesigner-preflight before anything is shared.
4. Screenshot desktop (1440) and phone (390).
5. Show the screenshots or an artifact, before and after, with each check and its result. Never only a local link.

Nothing is done until 3 to 5 have run.

## At each milestone
- Full audit: the opendesigner skill's `references/audit.md`, on every page.
- Clean up: dead CSS, stale drafts, options nobody picked. `engine.py review` then says "DESIGN.md matches state.json" and prints no "Tokens are" or "behind the code" line.
- Ask about deploying here, once. Never every round.

## Owner notes
Record each one: `engine.py feedback "<the rule, one line>" --kind note`. Said twice, it is a rule in `RULES.md`: apply it everywhere, in every later round.

## Brief
- What it is:
- Who it's for:
- The one action:
- Proof we can show:
- Words we never use:

A site that persuades also gets the site brief (Q-site-01 to 05: goal, roles, proof, how it is found, page families). Record it with `engine.py pick`; PRODUCT.md shows it, and step 4 builds one layout per page family.

## Answered
Read before asking anything. Add every answer given outside the interview. Never ask one again.

| Date | Question | Answer |
|---|---|---|
