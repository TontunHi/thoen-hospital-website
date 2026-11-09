# From design system to painting decisions

`paint.py brief` makes each of these decisions from the person's files. The engine's own guides referred to below (`choosing-and-mixing-styles.md`, `widescreen-and-titles.md`, `styles/<style>/STYLE.md`) are vendored in this skill. This page says what it reads, what it decides and why, so the agent can explain any line of the brief and override it with the person.

| Painting decision | Read from | Rule | Source |
|---|---|---|---|
| **Style** | `Q-img-04` if answered; else the Energy, Colorfulness, Warmth, Expression (and Roundness) dials | `hand-drawn` and `line` lead to sketch; `flat` and `mascot` lead to 2D cel; `none` means no painting. Otherwise the style whose dial profile is nearest (below) | The engine's mood table (`choosing-and-mixing-styles.md`), translated to dials [inferred] |
| **One style or mixed** | Expression and the slot | Mixed only at Expression 75+ in a hero or launch film; otherwise one style ("one artist") | `choosing-and-mixing-styles.md` §2; DC-L05-19 (one primary style) |
| **Palette families** | Token ramps (neutral, accent, accent2, accent3; light and dark) | 7 families, plus one per extra accent ramp, across pale, dark and saturated grounds, one per plate, 3-6 keys plus an ink. Includes "almost nothing" (near-white, one accent) and "monument" (near-black). No colour outside the ramps | `style-dna.md` §3 logic; DESIGN.md colour roles |
| **Accent mark** | `accent-9` hue | Charcoal, sketch and woodcut turn only warm reds into their accent mark. A non-red brand accent paints as value, so the brief says to choose watercolour, pointillism or cel when the accent must show | `styles/charcoal/STYLE.md` (red conté rule) |
| **Paper** | `neutral-2` (light) | Charcoal and sketch `material.paper`; watercolour grounds use the families | Brand neutrals |
| **Text on a plate** | Each family's ground against `neutral-1` (ivory) and `neutral-12` (charcoal) | The polarity that reaches 4.5:1 may carry words. Grounds that fail both carry none. Words go in a fixed-anchor phrase track, measured under the glyph mask | WCAG 2.2 AA (locked floor); `widescreen-and-titles.md` §3 |
| **Font** | `raw.displayFace` (or `textFace`), `raw.brandFace`, `raw.fontLicence` | A licensed brand face is used only if its licence covers rendering into video and images. Otherwise an OFL or Apache face, shipped as woff2 with its licence and a SHA-256. Never guess | hooks.md H-type; `widescreen-and-titles.md` §3 |
| **Where it may appear** | The slot | Films and loops only in marketing, onboarding and celebration; stills anywhere art is allowed | DC-L05-21; DC-L05-20; STD-when-to-animate-11 |
| **Length** | The slot | Hero 24 s, launch 30 s, onboarding 8 s, celebration 4 s, stills 0 s. `lint` flags longer films | [inferred]; STD-easing-duration-09 (illustrative motion only) |
| **In-app playback** | Locked floors | Muted autoplay, a still for `prefers-reduced-motion`, a pause control over 5 s, `aria-hidden` unless it carries meaning | WCAG 2.2.2, reduced-motion floor |
| **Sound** | Slot | Muted in the product; the score is for downloadable films only | [inferred] |
| **Identity** | The engine's scene library | Its "reconstructed" scenes are structure only: repaint each with this product's subject and palette. The three "supplied" ports of unattributed sketches are not included (`THIRD-PARTY.md`) | guardrails.md (references give structure, never identity) |

## Dial profiles behind the style recommendation
The nearest profile wins: root-mean-square distance across the dials each style lists. The top three are shown, each with the dials it is close on.

| Style | Energy | Colorfulness | Warmth | Expression | Roundness | Reads as |
|---|---|---|---|---|---|---|
| watercolour | 35 | 55 | 60 | 50 | | delicate, archival, calm; pale paper under text |
| pointillism | 70 | 85 | 55 | 70 | | luminous, saturated, textured |
| cel | 75 | 75 | 60 | 70 | 80 | flat 2D animation; friendly characters, mechanisms |
| sketch | 25 | 20 | 50 | 30 | | calm graphite or pen notes and diagrams |
| charcoal | 45 | 10 | 35 | 55 | | weight and tension in value plus one accent |
| woodcut | 85 | 30 | 40 | 80 | | force and declaration in ink plus one accent |

These targets are house judgement [inferred], not measurements. If a person disagrees, record their choice (`brief --style`) and say why.

## What the brief cannot decide
- **The message.** If the person gives none, ask in one line. The product's "memorable thing" (`context.memorable`) is only a starting point.
- **Whether a painting suits the audience at all.** One app found its paying audience preferred realistic images to cartoon characters [S-L19-111]. Ask who pays before recommending a playful style for a serious product.
- **A brand font's licence for video.** Ask.
