# Craft standard for library parts

Every part in `components/` meets this before it ships. It exists because the owner reviewed the library on 2026-10-23 and
found parts "very congested in sizing and placement", colours and systems "not well thought of", hand-drawn icons that were
not properly done (a smiley in the comment thread), drawn shapes where a photo belonged, a filter bar without proper sizing
on a phone, and a congested leaderboard and activity list. `library.py check` enforces what a script can see; the rest is
checked by eye on `site/library_sheet.py` contact sheets at phone, tablet and desktop in four looks.

## 1. Space: give everything room
Spacing comes from tokens, chosen one step more generous than feels necessary. The density of the system (dense, regular,
large) already scales every token; a part never compresses it further.

| Where | Token | Not less than |
|---|---|---|
| Outer padding of a card or panel | `--ds-space-inset-xl` from tablet up, `--ds-space-inset-lg` on a phone | `inset-lg` |
| Between sections inside a part (header, list, footer) | `--ds-space-stack-lg` | `stack-md` |
| Between a title and its meta line | `--ds-space-stack-xs` | |
| Between a meta line and body text | `--ds-space-stack-sm` | |
| Between rows of a list (no divider) | `--ds-space-stack-sm`, rows at least `max(var(--ds-size-control-md), var(--ds-size-target-min))` tall | |
| Between groups of rows | `--ds-space-stack-lg` (several times the row gap) | |
| Icon to its label | `--ds-space-inline-md` | half the icon |
| Between buttons in a row | `--ds-space-inline-sm` | `--ds-space-target-gap` |
| Content edge to the selected-row fill | inset the row by `--ds-space-inset-xs`..`sm` from the container edge | |

On a phone, a part stacks rather than squeezes: two columns of chips or buttons that would each be narrower than about 140 px
become one scrolling row or a full-width stack. Long labels wrap whole or truncate with an ellipsis, never mid-word.

## 2. Type: one voice, clear steps
- One title per part (`--ds-text-title-md` or `-lg`). Body text `--ds-text-body-md`. Metadata `--ds-text-label-md`.
- `--ds-text-label-sm` only for counts, timestamps and tags, never for content a person must read.
- Numbers that line up use `font-variant-numeric: tabular-nums`.
- At most three type sizes in a phone-sized part.

## 3. Colour: neutral first, one accent, status only for status
- Surfaces and text are neutral (`--ds-color-surface-*`, `--ds-color-text-primary|secondary|tertiary`).
- The accent marks one thing: the primary action or the current selection. Never fill whole rows, cards or podium blocks
  with the accent; a selected row uses `--ds-color-bg-accent-subtle` at most.
- Success, warning and danger colours only mean those states.
- Pictures carry colour; the chrome around them stays quiet.

## 4. Icons: Lucide, never hand-drawn
- Use [Lucide](https://lucide.dev) icons (ISC licence; the Feather-derived ones MIT), copied inline as SVG from
  `https://unpkg.com/lucide-static@0.460.0/icons/<name>.svg`. Keep Lucide's 24-unit viewBox, `fill="none"`,
  `stroke="currentColor"`, round caps and joins. Size them with `--ds-size-icon-sm|md` and set `stroke-width: var(--ds-icon-stroke-md)`.
- A file that uses them carries one comment near the top: `<!-- Icons: Lucide (lucide.dev), ISC licence -->`.
- Only brand-free marks may be drawn by hand (a chart, a map route, a progress ring). Never redraw a common icon.

## 5. Photos: real Unsplash photos where a picture belongs
- Covers, products, food, places, posters, post images and avatars of people are photos, not drawn shapes or initials-only
  circles. Pick from `photos.json` (each verified, free Unsplash License, no Unsplash+), or add a verified one there.
- Hotlink `https://images.unsplash.com/<img>?w=<2x display width>&h=<2x height>&fit=crop&auto=format&q=70` in an `<img>`
  with `alt`, `width`, `height`, `loading="lazy"` and `decoding="async"`, and `object-fit: cover` in the CSS. No CSS
  `url()` backgrounds.
- List every photo in `meta.json` under `"photos": [{"img": "...", "author": "...", "page": "..."}]`; the website credits
  them. A part never shows a photo's subject as a real brand.
- Initials stay only where a real product shows initials (a person with no photo, a workspace switcher).

## 6. Placement
- Align to one left edge per column; centre only symmetric things (a podium, an empty state).
- The thing a person came for is the largest and first; secondary actions are quieter (text or secondary buttons).
- A part fills its width cap (`max-inline-size`) and is centred at desktop; it never sits as a narrow strip on the left.

## 7. Our own shapes and words
A part may follow a common pattern (a progress bar, a week strip, a product card), never one product's signature. Don't
copy a component people recognise as a brand's, or its wording: `activity-rings` drew Apple's three nested Move, Exercise
and Stand rings and said "close your Move ring", and had to become `daily-goals` (2026-10-24). If someone could name the
product from the part alone, change the shape and the words.

## 8. Check before you show
1. `python3 skills/opendesigner/scripts/library.py check`
2. `python3 site/library_layout.py <slugs> --errors-only`
3. `python3 site/library_sheet.py <slugs> --out <scratch>`: read every image at phone, tablet and desktop in all four looks
   and compare against two shipped products of the same kind (Mobbin or the products themselves).
