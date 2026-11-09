# The style lab: find, mix and invent visual styles

The style catalogue (`references/style-catalog.md`, 133 named styles) is a map, not a fence. A person may want a look that has a name, a look that mixes two names, or a look nobody has named yet. This file is how you help them reach any of the three, and how the engine builds it. Read it when no named style fits, when the person asks for something new or experimental, or when they ask "what else is there?".

The floors never move, whatever the style: text contrast 4.5:1, control edges 3:1, 24 px targets, a visible focus ring, a still version under reduced motion, and a solid version under reduced transparency and more contrast.

## Every style is a choice on 15 axes

Named, mixed or new, a style takes one value on each axis. The axes come in two layers:
- **Bones** are what people read in the first half second: layout, density, type, scale, shape and theme. Experiments keep them close to what people expect.
- **Skin** is where a new look spends its novelty: surface, edge, depth, color, contrast, texture, imagery, ornament and motion.

The full list of values, with plain words for each, is at the end of `references/style-catalog.md`.

| Axis | Layer | What it decides | Some values |
|---|---|---|---|
| shape | bones | corners and shape language | sharp, subtle, rounded, pill, blob, geometric, pixel |
| type | bones | the letters that carry the look | neo-grotesque, serif, mono, condensed, display, handwritten |
| scale | bones | the size jump between headlines and body | even, moderate, dramatic |
| layout | bones | how the page is arranged | grid, bento, editorial, asymmetric, collage, full-bleed |
| density | bones | how much fits on a screen | airy, balanced, dense |
| theme | bones | which theme is designed first (both are always built) | light-first, dark-first |
| surface | skin | what a panel is made of | solid, translucent, gradient, metallic, glossy, luminous |
| edge | skin | how an edge is drawn | none, hairline, outline, thick-outline, beveled, rough |
| depth | skin | how things lift off the page | flat, ring, tonal, soft-shadow, hard-offset, extruded, inner, glass, glow |
| color | skin | how much color, and which kind | monochrome, muted, vivid, neon, pastel, earthy, spot-inks |
| contrast | skin | how far apart lights and darks sit in the decoration (never in text) | low, normal, high |
| texture | skin | a layer over flat color, kept off body text | none, grain, halftone, scanlines, paper, dither, glitch |
| imagery | skin | what kind of pictures carry the look | none, photo, illustration, 3d, icon-led, type-only |
| ornament | skin | what decorates the page | none, geometric shapes, squiggles, stickers, ascii, ornamental |
| motion | skin | the character of movement | still, subtle, springy, bouncy, stepped, glitchy |

**Motion techniques are flags, not a look,** because each carries its own rule: parallax and scroll-linked motion turn off under reduced motion; moving type is shown still; a loop that plays by itself for more than 5 seconds needs a pause control (WCAG 2.2.2); and nothing flashes more than three times in any second (WCAG 2.3.1).

Everyday words map onto single traits ("shiny" is a glossy surface, "wobbly" is a blob shape, "dots" is halftone, "huge headlines" is a dramatic scale). So a look with no name can still be found: `engine.py feel shiny` says which traits the word describes and which named styles are closest.

## With a person, step by step

1. **Frame it first.** Know four things before you show any style: the kind of product, who uses it, which screens are product screens and which are marketing, and whether money, health or safety is at stake. They set how far a style may push (step 5).
2. **Collect words, not names.** Ask for two or three feel words, one thing they dislike, and one pair that pulls two ways ("calm but loud", "luxury but eco"). The pair is where interesting directions come from. Never ask a person to name a style.
3. **Search.** `engine.py style search <their words>` ranks the catalogue by their words, the style names and the traits the words describe.
4. **If a named style fits, show it.** Show two or three side by side, plain words first, then the name ("frosted see-through panels; designers call it glassmorphism"). Record a pick with `engine.py pick Q-dir-01 <style id>`.
5. **If nothing fits, or they want something new, explore.** `engine.py style explore <their words> --fit core-ui` (or `--fit marketing`) offers about four directions. Each one says what it looks like, which named style it is closest to, how many traits are new and how many of those are bones, what the engine builds and what is a drawn asset.
6. **Show three or four directions as tiles, at real size.** A tile is a few real components (a button, a card, a field, a headline), not a full page. `engine.py style tiles <ids> --open` builds named styles for real from their own state; add `--tiles` to `explore`, `mix` or `mutate` to see new directions before anyone saves one. Both write `opendesigner/preview/style-tiles.html`, with a light and dark switch and a "Copy my choice" line. Label the directions safe, recommended and bold; the page puts the middle one forward as the recommendation.
7. **Ask about traits, not tiles.** For each tile, ask keep, change or drop about its loudest traits ("keep the glow, drop the dots"). Fold the answers into the next round:
   - "Like Swiss, but glowing": `engine.py style mutate swiss depth=glow`.
   - "The structure of a magazine with the feel of a comic": `engine.py style mix editorial comic`. A mix keeps the first style's bones and dresses them in the second style's skin.
   - "Same, but darker and with dots": add traits to any command, for example `theme=dark-first texture=halftone`.
   - "Show me others": `--seed 2` draws different directions; `--wild` allows looks further from anything named.
8. **Save it, and let them name it.** `--save <number> --name "<their name>" --use` keeps a direction as their own style (`x-<name>`, recorded in `decisions.md`) and picks it at Q-dir-01. To start from a style and set traits directly: `engine.py style define --name "Night market" terminal color=neon depth=glow --use`. A name made here is marked as coined: it is theirs, not a known style. Then `engine.py build`, and show the overview.
9. **Check it as rendered.** Experimental looks fail in ways a token check cannot see: text over glass, glow, gradients, texture and photos. Look at it at full size in light and dark, measure text against the worst pixels behind it (`making.md` section 5; the opendesigner-review skill), and keep visual complexity low to medium.
10. **Show a bold choice again before locking it.** Unusual designs are under-rated at first sight and grow on people. If they chose anything past the safe tile, show it again at the start of the next session before you lock it.

## How exploring works

- **Blend.** Pairs of the closest named styles are crossed both ways: one style's bones, the other's skin. This is how "magazine bones, comic skin" becomes a direction.
- **Mutate.** Each close style also takes one skin trait from a style far away from it. Most new looks start this way: something known with one thing changed.
- **New, but recognizable.** A direction is kept only inside a novelty budget, counted in traits that differ from the nearest named style:

  | Where it goes | Traits that differ | Of them in the bones |
  |---|---|---|
  | product screens (`--fit core-ui`) | 2 to 5 | at most 1 |
  | no fit given | 3 to 7 | at most 2 |
  | marketing and launch pages (`--fit marketing`) | 4 to 7 | at most 2 |
  | `--wild`, or a designer or entertainment audience | 3 to 10 | any |

  The numbers are our estimate [inferred]; the research below supports the direction.
- **Different from each other.** Directions are picked farthest-first, so the four you show are not four versions of one idea.
- **The person's words win.** Any trait they named holds in every direction.
- **Repeatable.** The same words and `--seed` always give the same directions.

## What the lab repairs

Some combinations look exciting and ship badly. The lab repairs them and says so in a note, rather than refusing:

| Combination | Repair | Why |
|---|---|---|
| Two surface effects at once (glass and glow, gradient and extrusion) | keeps one | one effect per surface (DC-L19-67) |
| More than 3 loud traits (4 on marketing pages), counting motion techniques | quiets motion, then ornament, imagery, texture, color, edge | piled-up effects read cluttered and cost first impressions (S-L19-045) |
| Texture on a dense data screen | no texture | texture lowers text contrast where people read most |
| Glass on a dense reading screen | density becomes balanced | glass is for bars and controls, never reading surfaces (DC-L04-15) |
| Clear glass over photos or 3D | a note: add the 35% dimming layer and check text at the worst spot | S-L15-073 |
| Neon color on a light theme | designed dark first | neon reads on dark; text still meets 4.5:1 |
| Low contrast | decoration only | text keeps 4.5:1 and edges 3:1 |
| Pixel shapes with smooth letters | a note: pixel or monospace headlines | they read as one look |
| Pixel, script, blackletter, handwritten or display letters | headlines only | body text stays a readable face |
| Bouncy or glitchy motion, and every motion technique | a still version, a pause control, the flash limit | WCAG 2.2.2, 2.3.1 and STD-accessibility-motion-02 |

`prefers-reduced-transparency` is not yet supported by every browser, so a glass style must pass contrast without it. The engine checks text and icons on glass over the worst content behind it and makes the glass just opaque enough to pass.

## What the engine builds, and what is an asset

| Trait | Built as tokens and CSS | An asset someone draws or chooses |
|---|---|---|
| depth hard-offset, extruded, inner, glow, glass | `offset`, `extruded`, `clay`, `glow` or `materials` elevation models, with `elevation.pressed` | long shadows, layered 3D scenes |
| edge thick-outline, outline | `border.width.default` 3 or 2 | rough, hand-drawn edges |
| shape, color, motion, density, ornament and imagery amount | the Roundness, Colorfulness, Energy, Density and Expression dials | illustrations, stickers, 3D objects, patterns, photos |
| scale | the type ratio: 1.2, 1.25 or 1.333 (a Q-dir-03 answer wins) | |
| texture grain, paper, halftone, scanlines | `texture.<kind>.opacity` and a `.ds-<kind>` CSS class, static and off under more contrast | dither, glitch and repeating patterns |
| surface gradient, luminous | `gradient.brand` (and `gradient.mesh` for the mesh style), blended in OKLab | metal, chrome, gloss and holographic foil |
| type | a suggestion for Q-type-03 (the font is the person's choice and licence) | pixel, script and display faces |
| theme | a suggestion for Q-theme-01; light and dark are always both built | |

`engine.py style show <id>` says what a style builds and what it leaves to assets.

## Discovering styles that are not in the catalogue

New looks keep appearing, and they often get their names years after the work was made. When a person brings one:

1. **Learn it from several references, never one.** With opendesigner-extract, measure examples from unrelated makers, then describe the shared look on the 15 axes. References give structure, never identity: no logo, brand name, exact brand color, proprietary typeface, photography or copy (`guardrails.md` section 1). One maker's signature look is never a style.
2. **Find its neighbours.** `engine.py style search` with the traits as words (`glow neon sharp`) shows what it is close to.
3. **Build it for them now.** `engine.py style define` makes it their own style in their project, today.
4. **Grow the catalogue later.** A look belongs in `synthesis/styles.json` when at least two independent sources use its name, and it differs from every catalogue entry on at least 3 axes. Record the date it was first seen; review trend styles after about 18 months, because decorative sub-trends have lasted about two years. Record the gap with `engine.py feedback "..." --kind gap` and follow `improve.md`.
5. **Push back on sameness.** Web layouts have grown more alike, and AI site builders may push further that way. When a direction sits close to the generic default, say so and offer one that changes at least one skin axis.

## Why it works this way

- **Novelty pays only while the design still looks typical.** Typicality and novelty predict preference together, each holding the other back ([Hekkert, Snelders and van Wieringen 2003](https://pubmed.ncbi.nlm.nih.gov/12648393/); Loewy's "most advanced yet acceptable").
- **First impressions are fast and favour simple, typical pages.** Visual complexity and prototypicality affected ratings of websites shown for 17 ms; low complexity with high prototypicality looked best ([Tuch et al. 2012](https://research.google.com/pubs/archive/38315.pdf)). Ratings after 50 ms matched ratings after 500 ms ([Lindgaard et al. 2006, reported by Nature](https://www.nature.com/news/2006/060109/full/news060109-13.html)).
- **High complexity costs the most appeal; color is a matter of audience.** Perceived complexity and colorfulness explained about half the variance in appeal, and the preferred amount of color shifted by group ([Reinecke et al. 2013](https://kgajos.seas.harvard.edu/papers/reinecke13aesthetics.pdf); [Reinecke and Gajos 2014](https://iis.seas.harvard.edu/papers/reinecke14visual.pdf)).
- **Unusual designs grow on people; weak signifiers get worse.** Atypical designs gained with exposure ([Landwehr, Wentzel and Herrmann 2013](https://doi.org/10.1509/jm.11.0286)), while long exposure to weak clickability cues made people slower and more cautious ([NN/g 2015](https://www.nngroup.com/articles/flat-design-long-exposure/); [NN/g 2017](https://www.nngroup.com/articles/flat-ui-less-attention-cause-uncertainty/)). So the skin may be unusual, and the controls may not.
- **Experiments fail on legibility and novelty for its own sake.** Translucent controls over busy content and constant animation cost usability ([NN/g on Liquid Glass, 2025](https://www.nngroup.com/articles/liquid-glass/)); deliberately disorienting interfaces work against users outside designer and entertainment audiences ([NN/g on brutalism, 2017](https://www.nngroup.com/articles/brutalism-antidesign/)).
- **The generator is a morphological box with blending.** Every combination of axis values is a candidate, filtered by consistency ([Ritchey, General Morphological Analysis](https://www.swemorph.com/ma.html)); a blend keeps a shared structure and lets new properties emerge ([Fauconnier and Turner 1998](https://doi.org/10.1207/s15516709cog2202_1)).
- **Directions are shown as tiles, with tensions and a middle option.** Style tiles and element collages show a look without a full page ([Warren 2012](https://alistapart.com/article/style-tiles-and-how-they-work/); [Mall 2012](https://v3.danmall.com/articles/rif-element-collages)); mood boards frame and use paradoxes ([Lucero 2012](https://users.aalto.fi/~luceroa1/publications/2012/lucero12_moodboards.pdf)); a middle option draws choices toward it ([Simonson 1989](https://academic.oup.com/jcr/article-abstract/16/2/158/1795321)).
- **Sameness is a real risk.** Web layouts became measurably more alike after 2007 ([Goree et al. 2021](https://doi.org/10.1145/3411764.3445156)), and AI-made sites may strengthen it ([Shin et al. 2026](https://arxiv.org/abs/2603.13036)).
- **Motion rules.** [WCAG 2.3.1 flashes](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html), [WCAG 2.2.2 pause, stop, hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html), and [designing with reduced motion](https://www.smashingmagazine.com/2020/09/design-reduced-motion-sensitivities/).

## Where the catalogue comes from

`synthesis/styles.json` holds every named style: the first 28 from `references/styles.md` (tuned in the `brand/showcase/styles` studies), and 105 researched in five families: art and graphic design movements, computing eras and platform languages, internet aesthetics, current web and brand trends, and material and craft techniques. Each researched style carries at least two sources that were opened, and a second agent opened every source again: 56 of the 108 checked entries needed a correction and 2 were dropped (one name no source used, one trend named by a single source). Dial values are placements on the axes [inferred], and no style sets warmth above 45, because a high warmth turns the neutral greys beige. The research notes and source trace are in `research/U9-style-catalogue.md` and `traces/U9-trace.md`.
