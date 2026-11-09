# Post-change audit: check everything after something is implemented

Run this after every change to a page, a component, a site or a library, before you show it to anyone. It exists because the
owner should never have to point out the same kind of mistake twice (owner, 2026-10-21: "I am tired of highlighting so many of
your mistakes ... add them in a post-change audit that checks everything after something is implemented").

How to use it:
1. Run the automatic checks (section A). In this repo: `python3 site/post_change_audit.py`. In a person's project: the commands
   their stack has, plus `engine.py review` and the `opendesigner-review` skill's probe at every width.
2. Walk section B by eye on the rendered result, at phone (390), tablet (768) and desktop (1280 or wider), in light and in every
   theme or look the work ships with. Crop corners and edges at 2x.
3. Write down each rule as passed, fixed, or failed with the reason. Show nothing until every line is passed or explained.
4. When the owner points out a new kind of mistake, add it here (with how to check it) in the same change that fixes it.

## A. Automatic (must report 0 errors)
| Check | What it catches | Command in this repo |
|---|---|---|
| Layout at 13 widths | overflow, clipping, overlap, misaligned rows and edges, small targets, widows, broken labels, **corners that do not nest** (check 14) | `python3 site/check_layout.py` |
| Same chrome on every page | the header or footer moving, resizing or losing links between pages | `python3 site/check_chrome.py` |
| Links, titles, structured data | broken links, missing anchors, two h1s, title and description lengths | `python3 site/check.py` |
| Library components | tokens only, scoped, every variable exists in every system, focus, reduced motion, script rules, **no underline stroke on a highlight** | `python3 skills/opendesigner/scripts/library.py check` |
| Library components unscaled | each component on its own at 13 widths | `python3 site/library_layout.py` |
| Library previews in Safari and Chrome | a scaled card or part page drawn as a sliver or a one-letter column, or past its frame, in WebKit (Safari's engine) or Chrome, after scrolling the shop fast | `python3 site/check_browsers.py` |
| Repo rules | AGENTS.md "Before you commit" | the list there |

## B. By eye (each one was an owner correction)
**Structure and calm**
1. The page reads as structured and calm: one backdrop for a set of cards (not a different photo each), tiles of one size in a grid, one rhythm of section spacing, generous white space. Nothing looks like a hero collage where the owner asked for a store. [2026-10-21]
2. The top of a page is confident and specific (a clear headline in the site's type, one search or one action), never "okayish". Look up two or three shipped examples on Mobbin first. [2026-10-21]
3. Every page shares one shell: the header, footer and content width do not move between pages (`check_chrome.py`). [2026-10-21]

**Frames and corners**
4. Corners nest everywhere: a rounded box close inside another takes the outer radius minus the gap, so the curves run parallel, at every screen size. When content is scaled, compute the frames from the inside out (the part's own corner plus its margin, at the shown scale). [2026-10-21]
5. One frame language: a framed screen uses the site's frosted-glass bezel; never a black device bezel next to glass ones. [2026-10-21]
6. A frame fits what it holds: no small part lost in a wide or tall empty frame. The frame hugs the part, or the part is shown at a view where it fills the frame. In one column (a phone) a card is as tall as its part, not a fixed 4:3 box that crops it to a strip; no forced phone shape around a short part. [2026-10-21]
7. Parts are placed properly: centred in their frame and shown whole, never a cropped slice, never pinned to a corner with empty space. [2026-10-21; whole, 2026-10-24]
8. Look in Safari as well as Chrome before showing anything. Safari draws some CSS differently (it keeps text at a minimum size inside `zoom`); scale with `transform`, never `zoom`. The owner's own screenshots are from Safari. [2026-10-24]
9. Backgrounds behind frames are calm (a smooth gradient), never a busy streaked photo at the corners. [2026-10-21]

**Components**
10. Radius roles: control radii only on single-line controls; a box that can hold more than one line uses the container radius. Check every look, including one with pill controls: no box becomes an oval. [2026-10-21]
11. No curved underline strokes: a highlight is a plain fill; no bottom border or inset shadow under highlighted or inline text, and no hard ledge under a box (a shadow pushed down with no blur, the "3D button" lip). `library.py check` catches both. [2026-10-21, ledge 2026-10-22]
12. Every component looks like someone spent time on it, at phone, tablet and desktop: considered spacing, aligned edges, one focal point, nothing cramped, nothing lost. The phone view is designed for a phone. [2026-10-21]
13. Form controls share one style (selects get the same padding and chevron as the other fields; no native arrow jammed at the edge). [2026-10-21]
12a. Library parts meet `assets/library/CRAFT.md`: generous token spacing (outer padding `inset-xl`, sections `stack-lg` apart), neutral colour with one accent, Lucide icons (never a hand-drawn smiley), real Unsplash photos wherever a picture belongs, and phones that stack instead of squeezing. Judge it in the dense look too. [2026-10-23]

**Previews and detail**
14. A preview shows the same thing its detail view opens on, and a click carries that view. On a wide screen both open on the desktop view; other views show only while hovering. On a phone both open on the phone view. [2026-10-21, desktop first 2026-10-23]
15. Moving between views is a soft crossfade (fade and a 2 px blur, ease-out, under 300 ms), pointer only, none with reduced motion. It can never get stuck half-faded. [2026-10-21]
14a. A preview never changes height when its view changes on a phone (one column): the page would jump under the reader's thumb. Measure `scrollY` and the card's height before and after a view change. [2026-10-23]

**Labels and stickers**
16. Stickers sit below a picture, never on top of the thing being shown; one sticker beats three. [2026-10-21]
17. Known tools show their real marks; invented brands use `.example` domains and names checked against the registry. [standing]

**Commerce and prompts**
18. A cart or checkout looks premium and familiar (an order summary beside one focused action, like a good payments checkout), scrolls when long, shows a real picture of each item (a larger look on hover), and never asks for anything as a wall: a star or follow is a soft ask after the value, once. [2026-10-21]
19. A prompt for a coding agent is one tap to copy and works as pasted: one paste is one action (install commands are their own step with their own copy button, never glued to the prompt). On a phone the main action stays in reach (a sticky bar), not below a long order. [2026-10-21]

**Layout safety**
22. A grid or flex column that holds long unbroken text (a link, a command) sets `minmax(0, 1fr)` / `min-width: 0`, so wrapping rules never widen the column past the screen. Check `scrollWidth` and every element's right edge at 390 px. [2026-10-21]
23. A part never uses an attribute the host page's own scripts read across the page: the site's star counter once wrote the GitHub star count into a review list that used `data-stars`. `library.py check` rejects the reserved names. [2026-10-22]

**Process**
20. Every step ends with proof (a check output, a measurement or a screenshot you looked at), and a fresh reviewer who did not build it re-checks the whole against the brief before it is shown. [2026-10-21]
21. Nothing is pushed or deployed before the owner has seen a local preview. [standing]
