---
# DESIGN.md front matter (Google's open DESIGN.md format). The DTCG tokens in opendesigner/tokens/ are canonical.
# engine.py design-md renders this file after every confirmed decision. Text inside od:keep blocks survives.
version: alpha
name: "{{name}}"
description: "{{one plain sentence about the product}}"
colors:
  primary: "{{accent}}"
  on-primary: "{{on-accent}}"
  surface: "{{surface}}"
  on-surface: "{{text}}"
typography:
  body-md: { fontFamily: "{{textFace}}", fontSize: {{baseSize}}px, lineHeight: {{lineHeight}}px }
rounded:
  control: {{radius.control}}px
  container: {{radius.container}}px
spacing:
  unit: {{spaceUnit}}px
---

# {{name}} design system

<!-- One section per area. Each section opens with its zoom line. Each decision opens with one plain sentence
and the short "Designers · Code" line; the full designer and engineer notes stay collapsed. -->

## Overview
> Zoom: sketch (0 of 3). Say "zoom into the big picture" to set style, density and principles.
<!-- od:zoom area=overview level=0 -->

{{One plain paragraph: what the product is, who it is for, how it should feel, and the one thing people should remember.}}

**Taste card.** {{Five lines, each with where it comes from: In your words (the person's own picture of the look, or "Not given yet"), Color, Shape, Motion, and Never (their words and taste-poll red lines, or "Nothing yet"). Never invent the picture or the Never list.}}

## Colors
> Zoom: broad (1 of 3). Say "zoom into Colors" to define ramps, roles and contrast.
<!-- od:zoom area=color level=1 -->

**The brand color shows only on buttons and links.** It keeps the screen calm and makes actions easy to find.
Designers: accent used sparingly · Code: `color.bg.action.primary`
<details><summary>More</summary>

- Designer: {{the designer voice for this decision}}
- Engineer: {{token paths, CSS variables, contrast ratios}}
- Decision: {{D-nnnn}}, set by {{chosen | delegated | ...}}, because {{reason}}
</details>

## Typography
> Zoom: sketch (0 of 3). Say "zoom into Text" to set sizes, weights and fonts.
<!-- od:zoom area=type level=0 -->

## Layout
## Elevation & Depth
## Shapes
## Motion
## Components
## Do's and Don'ts
<!-- The engine fills the remaining sections in the same pattern: zoom line, marker, plain decisions, collapsed detail. -->

## Open Items
- Still defaults (zoom 0): {{areas}}
- Assumed answers to confirm: {{question ids}}
- Assets pending: {{hooks with owner}}

<!-- od:keep -->
{{Anything the team writes here by hand is kept when the file is regenerated.}}
<!-- /od:keep -->
