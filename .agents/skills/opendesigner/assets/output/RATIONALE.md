# Why {{name}} looks the way it does

<!-- One page for teammates, managers and designers who will not read decisions.md. The model writes it
from the decision log at the end of the interview, and refreshes it after each extend session.
Plain language. Question ids and D-numbers go only in the footnotes. -->

## What we built
{{One paragraph: the product, who it is for, the direction in one line, and the one thing people should remember.}}

## The five choices that shape everything
1. **{{Personality}}:** we chose {{X}} because {{Y}}. The main alternative was {{Z}}. It would have meant {{W}}.
2. **{{Platforms}}:** ...
3. **{{Visual direction}}:** ...
4. **{{Density}}:** ...
5. **{{Brand color role}}:** ...

## What the rules guarantee
- Text contrast of at least 4.5:1 (3:1 for large text and controls) in light and dark mode.
- Touch and click targets of at least {{24 px web / 44 pt iOS / 48 dp Android}}.
- A visible focus ring on every interactive element.
- Motion that respects the reduced-motion setting.

## What is still open
- Assumed answers to confirm: {{list}}
- Assets pending, with owner and brief: {{hook, owner, opendesigner/briefs/<hook>.md}}
- Warnings waived, with reasons: {{list}}

## How to ask for a change
{{Who approves design-system changes.}} Ask your agent to use the opendesigner-extend skill. It reads this system first, shows what a change would move, and records the new decision in `opendesigner/decisions.md`.

## For designers
{{What is yours to make, with a brief for each missing asset: logo, illustration, photography, custom icons, signature motion.}}

---
Footnotes: {{Q-ids and D-numbers for each choice above}}
