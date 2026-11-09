# The OpenDesigner component library

An optional set of finished components. Each one is built only on the `--ds-*` tokens the engine writes, so it takes on the colours, type, spacing and corners of whatever system it lands in. Nobody has to use it: the skills offer it only when it fits (`references/library.md`).

## Why it exists
- **Fewer tokens.** A person's agent copies one small file instead of designing a table, a toast or a composer from scratch. In a project with an OpenDesigner system the file works as it is: its variables are already defined.
- **A good start.** The components come from the B2B pieces the maintainer reviewed in `brand/showcase/` (product screens and the component sheets), rebuilt as single parts.

## Structure
```
assets/library/
  README.md                 this file
  components/<slug>/
    component.html          the component: one <style> block scoped to .odl-<slug>, then the markup (and, only when needed, one <script>)
    meta.json               name, summary, use, type, style, industries, tags, states, source piece, accessibility notes
```
`scripts/library.py` reads these folders. There is no index file to keep in step: `library.py list --json` and the website build both read the folders.

### meta.json
| Field | What it holds |
|---|---|
| `name` | Plain name, sentence case ("Approval card") |
| `summary` | One sentence: what it is for, in plain words |
| `use` | When to use it, finishing "to use ..." ("at the top of a dashboard, for its headline numbers"). The website's first sentence for the part is built from it |
| `type` | One of the types below |
| `style` | One of the styles below |
| `industries` | One or more of the industries below, or `["any"]` |
| `tags` | 3 to 6 short words people would search for |
| `states` | The states the file shows or supports (hover, focus, selected, empty, loading, error...) |
| `source` | The showcase piece it comes from (a repo path), or `null` |
| `a11y` | One sentence on keyboard and screen-reader behaviour |
| `width` | The width it is designed for: `narrow` (up to 400 px), `medium` (up to 640 px) or `wide` |

**Types:** `data` (tables, rows, feeds, stats), `chart`, `form` (inputs, toggles, pickers), `feedback` (toasts, banners, empty states), `navigation` (command menus, steppers, tabs, sidebars), `overlay` (dialogs, drawers, menus), `ai` (composers, answers), `commerce` (plans, checkout, products), `content` (profiles, media, cards).
**Styles:** `quiet` (calm, lots of space), `dense` (many rows, small type, work tools), `technical` (mono figures, status), `friendly` (rounder, warmer copy), `editorial` (reading first).
**Industries:** work tools: `finance`, `saas`, `devtools`, `security`, `crm`, `logistics`, `productivity`; consumer: `social`, `media`, `retail`, `food`, `travel`, `events`, `health`, `fitness`, `money` (personal finance), `education`, `home` (smart home), `games`; or `any`. The website labels a part Consumer when its industries are consumer ones.

### component.html rules
Every part also meets the craft standard in [CRAFT.md](CRAFT.md): generous spacing, one title, neutral colour with one accent, Lucide icons, real photos where a picture belongs.
`library.py check` enforces the first five, and checks each meta.json.
1. **Tokens only.** No colour literals (hex, `rgb()`, `hsl()`, `color-mix()`, any named colour), and no font sizes, families or weights, radii, shadows, durations (also inside `transition` and `animation`) or padding, margin and gap lengths outside `var(--ds-*)`. Layout numbers (`1fr`, `%`, `max-inline-size`) are fine.
2. **Only variables every system writes.** Every `--ds-*` name must exist in three different engine systems (dense, regular and large audiences); some roles, such as `--ds-text-headline-md`, exist only in some.
3. **Scoped.** Every selector, also inside `@media` and `@container`, starts with `.odl-<slug>`, so the component never restyles the page around it.
4. **Self-contained.** One file. No framework, no build step, no external font or script, and no image except free Unsplash photos hotlinked from `images.unsplash.com` (rule 7). A `<script>`, when present, starts from `document.querySelectorAll(".odl-<slug>")` and only wires behaviour inside that root: no network, storage, `eval`, `scrollIntoView` (it scrolls the whole page; scroll only your own box) or writes to the document outside it. Guard it so each root is wired once.
5. **Floors.** Every clickable area is at least `--ds-size-target-min` (44 px on touch screens; a whole labelled row counts), focus uses `:focus-visible` with `--ds-color-border-focus`, and anything that moves has its own `@media (prefers-reduced-motion: reduce)` block that turns the motion off (the engine's raw duration tokens do not go to zero on their own).
6. **Invented content only.** Names, companies and figures are made up; domains end in `.example` and invented brand names pass `brand/tools/check_names.py`.
7. **Photos and icons.** A picture of a thing (a product, a dish, a place, a person, a post) is a photo from `photos.json`: free Unsplash License, hotlinked in an `<img>` with `alt`, `width`, `height` and `loading="lazy"`, credited in `meta.json` `photos`. Common icons are Lucide (ISC), copied inline, with a one-line licence comment. `library.py check` enforces the photo rules.

## Pulling one into a project
- **With OpenDesigner installed** (the person's agent has the skill): `python3 <skill>/scripts/library.py add <slug> [--into src/components/odl]`. It copies the file and lists any `--ds-*` variable the project's tokens lack.
- **Any agent:** paste the prompt shown on the website, for example:
  `Add the OpenDesigner component approval-panel to this project: https://opendesigner.dev/library/r/approval-panel.html. Keep its markup and states; map its --ds-* variables to my tokens.`
  The agent fetches one small file and maps variables; it does not redesign the component.

In React, Vue or Svelte the agent turns the file into one component in the project's own style (the CSS block can stay as it is).

## Licence
MIT, like the rest of OpenDesigner. Copy, change and ship them; no attribution in the UI.

Third-party content inside parts: icons from [Lucide](https://lucide.dev) (ISC licence; icons derived from Feather, MIT), and photos hotlinked from [Unsplash](https://unsplash.com/license) under the Unsplash License (free to use; the website credits each photographer). The photos are not part of this repository.

## References studied (structure and presentation only; no code, copy or assets were taken)
| Source | Licence (checked 2026-10-21) | What it taught |
|---|---|---|
| Opensource UI, https://opensourceui.in (github.com/bidyut10/opensourceui) | MIT | Categories in a side list; a live preview on a quiet patterned stage; setup steps and copy-ready code under it; a one-sentence description per component |
| shadcn/ui, https://ui.shadcn.com (github.com/shadcn-ui/ui) | MIT | Components you own as source, not a package; a registry that one short command pulls from |
| Magic UI, https://magicui.design (github.com/magicuidesign/magicui) | MIT | Presenting components as a showcase people come back to, not only as docs |

## Adding a component
1. Make a folder `components/<slug>/` with `component.html` and `meta.json`.
2. `python3 <skill>/scripts/library.py check` passes.
3. Look at it on the website preview in all three example systems (`python3 site/build.py`, then `/library/`).
