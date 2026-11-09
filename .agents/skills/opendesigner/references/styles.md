# Visual styles: names, looks and settings

Most people have no word for the look they want. They say "frosty", "like a comic" or "soft buttons". This file turns those words into named styles, shows real products that use each one, and gives the dial settings that build it. Read it when a person describes a look, when you build the style screen (Q-dir-01), and when someone asks "what is this style called?".

Sources: the style table and DC-L15-01 in `research/L15-visual-design-principles.md` (S-L15-xxx ids below), the presets and recipes in `references/levers.json`, the house standards in `references/standards.json`, and Mobbin screens and sections checked in October 2026 (each "Seen in" link). Unless a source is named in brackets, the numbers under "What defines it" and every "Dials" range are starting points from common practice [inferred]. Dial bands come from `levers.json`: roundness 0-12 is 0 px, 13-25 is 2 px, 26-37 is 4 px, 38-47 is 6 px, 48-60 is 8 px, 61-80 is 12 px, 81-92 is 16 px, 93-100 is pill; depth 0-15 is borders only, 16-35 a ring with a faint shadow, 36-55 tonal layers, 56-80 a shadow ladder, 81-100 glass materials; colorfulness 0-10 is monochrome, 11-35 neutral, 36-62 tonal, 63-87 expressive, 88-100 vivid.

## How to use it in the interview

1. **Listen for look words.** When a person describes a look in their own words, map the words to one to three named styles with the table below. Never ask them to name a style.
2. **Show, then name.** Show the styles as options side by side with `assets/templates/option-gallery.html` (recommended option first, the person's own colors and fonts where you have them). The gallery can show colors, type, corners and any `box-shadow` (offset, paired and inset shadows work). It cannot show backdrop blur, borders thicker than 1 px, gradients or textures yet. For those styles, say so in one line and give the "Seen in" links so the person can look at real products. Without a visual surface, use text options with those links. `engine.py style tiles <id> <id> <id> --open` renders the styles as built tiles in that gallery.
3. **Plain words first, then the name, then the code.** For example: "Frosted see-through panels; designers call it glassmorphism; in code: `backdrop-filter`." This follows the first-mention rule in `rules.md` section 2. After that, use the name only.
4. **Record the pick.** `engine.py pick Q-dir-01 <style id> --why "<their words>"` (ids such as glassmorphism, neo-brutalism, claymorphism, mesh-gradient; the full list is in `references/style-catalog.md`, or run `engine.py style list` or `engine.py style search <their words>`). It selects the preset, records `state.style` (DESIGN.md and the overview then say, for example, "Style: glassmorphism (frosted see-through panels)") and applies the style's own dials. Feel words no longer move a style's dials. Then set only what the person asks for beyond the style, and run `engine.py build`. For a look between named styles, or one of the person's own, use the style lab (`engine.py style mix|mutate|explore|define`, described in `references/style-lab.md`); a saved experimental style is picked with `pick Q-dir-01 x-<name>`.
5. **A style is a direction for a whole surface, never decoration sprinkled on top.** One glass card on a flat page, or one comic burst on a calm dashboard, reads as a mistake. Apply the style to every instance of the same kind (`making.md` section 2), spend boldness in one signature place (`rules.md` section 10), and keep one base style per surface. A product can use two: a durable one for the app and a louder one for marketing pages (DC-L15-01). In practice, give a surface style one layer or one kind of object and keep the rest plain: glass on the floating layers only, as iOS does; the soft extruded look on the one control people touch, not on every card; pixel art in the data, not around it. The independent audit of the showcase's style studies marked down every piece that spread its style over every surface.
6. **Check the floors before you recommend.** The accessibility floors stay locked: WCAG 2.2 AA text contrast 4.5:1, 3:1 for control edges and icons, 24 px targets, visible focus, reduced motion and reduced transparency (`guardrails.md`; STD-accessibility-motion-11). When a style breaks a house standard (thick solid borders against STD-visual-details-14, for example), say so once and follow `rules.md` section 6.
7. **References give structure, never identity.** The "Seen in" products show what the style is. Never copy their logo, colors, typeface, illustrations or hardware (`guardrails.md` section 1).
8. **Where Mobbin had no example,** the section says so and describes the style from first principles. Never invent an example.

### Their words, and the styles to show

| They say | Show these |
|---|---|
| frosty, see-through, glassy, blurry, icy, "like my iPhone" | Glassmorphism; Frutiger Aero; Dark luxe |
| soft buttons, pillowy, pressed in, cushion, "like a remote" | Neumorphism; Claymorphism; Playful and toy-like |
| puffy, squishy, 3D, cute, "made of clay", "like toys" | Claymorphism; Playful and toy-like; Y2K |
| real, "like a real object", knobs, dials, leather, wood, "like an old iPod" | Skeuomorphism |
| simple, clean, flat, "no shadows" | Flat design; Minimal monochrome; Swiss |
| "like Android", "like Google", floating cards, "round plus button" | Material elevation |
| bold, loud, chunky outlines, indie, punk, "black borders" | Neo-brutalism; Comic and pop art; Brutalism |
| raw, ugly on purpose, unstyled, anti-design, "like an old website" | Brutalism; Terminal |
| grid, poster, Helvetica, orderly, "sharp and serious" | Swiss / International |
| magazine, newspaper, bookish, "long reads" | Editorial |
| black and white, gallery, quiet, "no color" | Minimal monochrome; Dark luxe |
| boxes, tiles, "like Apple's feature page", dashboard tiles | Bento grid (layout, pairs with another style) |
| dreamy colors, northern lights, rainbow blur, "gradient background" | Mesh and aurora gradients |
| grainy, film, paper, analog, textured | Grain and noise; Risograph |
| two-color photos, "colored photos like a poster" | Duotone |
| comic, cartoon, dots, speech bubbles, pop art | Comic and pop art |
| 80s, squiggles, confetti shapes, zigzags | Memphis |
| zine, printed, ink, screen print | Risograph; Grain and noise |
| primary colors, "circles, squares and triangles", art school | Bauhaus |
| Gatsby, gold, 1920s, grand hotel, theatre | Art Deco |
| 2000s, chrome, holographic, bubbly | Y2K and retro-futurism |
| Windows Vista, aqua, bubbles, sky and grass, glossy | Frutiger Aero |
| hacker, code, command line, "like a terminal" | Terminal and ASCII |
| 8-bit, retro games, pixels | Pixel art |
| sleek dark, "premium SaaS", "like Linear" | Dark luxe |
| for kids, chunky, "like Duolingo" | Playful and toy-like |
| natural, earthy, eco, plants, calm and warm | Organic and natural |
| 3D diagram, little city, stacked layers | Isometric (drawings; pairs with another style) |

---

## Surfaces and depth

### 1. Glassmorphism
- **Plain words:** Panels look like frosted glass: you see a blurred version of what is behind them.
- **People say:** frosty, see-through, glassy, blurry, icy, "like my iPhone", "like Windows 11".
- **Designers call it:** glassmorphism, frosted glass, backdrop blur; Apple calls its version Liquid Glass, Microsoft calls its versions Acrylic and Mica (S-L15-073, S-L15-005).
- **What defines it:**
  1. A translucent fill: white at 55 to 75% opacity in light mode (STD-visual-details-16 example: `rgba(255,255,255,0.6)`; the engine's `color.surface.glass` is 72%).
  2. A background blur of 16 to 30 px, often with extra saturation (STD-visual-details-16 example: `blur(20px) saturate(180%)`; the engine's `material.glass.blur` is 24 px). Bigger surfaces get a stronger blur than small chips (STD-visual-details-19).
  3. A 1 px light edge, white at about 40% (STD-visual-details-16 example).
  4. Something rich behind it: a photo, a map or colored content. Over a flat color the blur shows nothing.
  5. Used on the layer that floats: bars, toolbars, sheets, menus. Never on reading surfaces (S-L15-073; DC-L04-15).
- **In code:** `background: rgb(255 255 255 / .6); backdrop-filter: blur(20px) saturate(180%); border: 1px solid rgb(255 255 255 / .4);` plus `@media (prefers-reduced-transparency: reduce) { background: var(--surface-solid); backdrop-filter: none; }`. iOS: `glassEffect`. Windows: Mica and Acrylic.
- **Dials:** expression 45-60 · brandPresence 20-45 · density 25-50 · energy 30-45 · roundness 61-92 (12-16 px) · depth 81-95 (glass materials) · colorfulness 30-50 · warmth any. Start from `pick Q-dir-01 glass` and `pick Q-depth-04 control-layer`. Depth above 80 is what turns glass on. The glass preset sets depth 90; without the preset, set depth by hand, because a depth that only comes from the other dials is capped at 80 unless expression is above 60 on an Apple or Windows platform. Low colorfulness, because the color comes from the content behind the glass. Apple's recipe in `levers.json` sits at depth 95, roundness 75, brandPresence 20.
- **Fits:** apps for Apple platforms, where glass is the system look; media, maps, music and photo apps with rich content to show through; the navigation layer of B2B tools (a frosted top bar over a dense table works). Not for card grids or forms.
- **Goes wrong when:** glass sits on reading surfaces or every card; colored blobs are painted behind the glass only so the blur has something to show (the top tell in `making.md` section 11: glow and gradient blobs with no job, 19 of 54 audited pieces); glass sits on a flat background and turns into plain gray.
- **Accessibility:** text contrast changes with whatever scrolls behind, so check the worst case, not the average (S-L15-078). Use higher-contrast text, a slightly heavier weight and a little extra letter spacing over glass (STD-visual-details-13). Add a 35% dark dimming layer under clear glass over bright content (S-L15-073). Honor reduced transparency and increased contrast with a solid twin (`color.surface.glass-fallback`; STD-accessibility-motion-11). Animate blur radius and scale together, not opacity alone, when glass enters (STD-enter-exit-origin-31).
- **Seen in:** [CLEAR](https://mobbin.com/screens/3c9f89d5-8e16-4f77-8cdd-1fe3f9f07907) (frosted card over a deep blue background with soft light) · [Moonlitt](https://mobbin.com/screens/15a8a99e-2d36-4716-ae39-787f88cf8e97) (a frosted menu and card over violet) · [TIDE](https://mobbin.com/screens/3a6e3571-22fe-4659-80ac-7249374e4947) (glass tab bar and chips over a photo) · [Linear](https://mobbin.com/sites/sections/b3626c90-279d-4b7c-9de0-06309c5002cc) (a translucent dialog over a dark glow).

### 2. Neumorphism (soft UI)
- **Plain words:** Buttons and cards look pushed up out of the page, or pressed into it, as if everything were molded from one soft material.
- **People say:** soft buttons, pillowy, pressed in, cushiony, "like a remote control", "like plastic".
- **Designers call it:** neumorphism, soft UI, new skeuomorphism (S-L15-060).
- **What defines it:**
  1. The element is the same color as the page: a light, low-chroma gray or tint (OKLCH lightness about 0.90 to 0.95, chroma under 0.02).
  2. Two soft shadows on opposite sides: a light one up and left (white at 70-90%) and a dark one down and right (black at 12-25%), each offset 6 to 10 px with a blur of 12 to 20 px.
  3. A pressed state that swaps both shadows to `inset`.
  4. Rounded corners, 12 to 24 px, and a muted palette with at most one accent (S-L15-060).
  5. No borders and no outlines: the shadows draw every edge.
- **In code:** `background: #e6e9ef; box-shadow: -8px -8px 16px rgb(255 255 255 / .8), 8px 8px 16px rgb(0 0 0 / .18);` pressed: the same two shadows with `inset`.
- **Dials:** expression 35-50 · brandPresence 40-60 · density 15-40 · energy 20-35 · roundness 61-92 · depth 56-80 · colorfulness 10-25 · warmth 22-45. `pick Q-dir-01 neumorphism` (built on the soft preset). The engine builds the paired light-and-dark shadows (the "extruded" depth model) and an inset `elevation.pressed` for the pressed state. It still warns that this style fails 3:1 edge contrast by design: add a rim or a darker text tone to controls whose shape is their only cue, as the showcase's building panel (`brand/showcase/styles/02-neumorphism`) did. Keep warmth at 45 or below, or the greys turn beige.
- **Fits:** small, physical-feeling control panels with few controls: a smart-home remote, a timer, a music player. Rarely right for B2B or anything with forms and tables.
- **Goes wrong when:** everything is soft, so nothing reads as clickable; pastel gray on pastel gray; the paired shadows are copied onto text fields, tables and tabs. It turns every control into a "one bubbly radius on every element" tell (`rules.md` section 10).
- **Accessibility:** it fails 3:1 non-text contrast by design: control edges and states are hard to see (S-L15-060; DC-L15-01). Add a visible border or a darker fill to every interactive part, which undoes much of the look. Pressed and selected states need a second signal besides the inset shadow.
- **Seen in:** Mobbin had no full neumorphic screen in our searches. The nearest: [Lovi](https://mobbin.com/screens/d944dd8b-a7ca-42ec-93a7-096b1101a5ef) (soft raised icon tiles on white cards) · [Antimetal](https://mobbin.com/sites/sections/d9d6ead2-a0b8-4806-b283-0e4d6dd06d3e) (a light gray control card with a soft raised slider knob) · [Grok](https://mobbin.com/screens/d35c526d-bf72-4319-82b9-d467080316d3) (soft raised segment tiles on a light gray page).

### 3. Claymorphism
- **Plain words:** Shapes and pictures look puffy and soft, like they are made of modeling clay or plastic toys.
- **People say:** puffy, squishy, chubby, 3D, cute, "made of clay", "like toys", "like gummies".
- **Designers call it:** claymorphism, clay 3D, soft 3D, inflated 3D.
- **What defines it:**
  1. Big corner radius, 24 to 40 px, or full circles.
  2. A soft outer shadow plus two inner shadows: a light one up and left and a darker one down and right, so the shape bulges.
  3. Pastel or candy colors, often with a slight gradient on each shape.
  4. Usually carried by 3D clay illustrations or icons, not by the controls alone.
- **In code:** `border-radius: 32px; box-shadow: 0 16px 32px rgb(0 0 0 / .12), inset -6px -6px 12px rgb(0 0 0 / .12), inset 6px 6px 12px rgb(255 255 255 / .7);` The 3D art itself is an asset (Q-img-06 `3d`).
- **Dials:** `pick Q-dir-01 claymorphism` applies what worked in the showcase's clay study (`brand/showcase/styles/03-claymorphism`, scored 4): expression 70 · brandPresence 50 · roundness 96 · depth 80 · colorfulness 55 · warmth 30. The engine builds the inner shadows (the "clay" depth model), and the neumorphic warning no longer fires for clay. Keep warmth at 45 or below: higher warmth turns the neutral greys beige. The clay objects themselves are drawn assets (Q-img-06 `3d`).
- **Fits:** consumer onboarding, kids and learning, wellness, health insurance and banking apps that want to feel kind; B2B marketing illustrations. Keep the product UI itself calmer.
- **Goes wrong when:** a clay icon decorates every card or list row (texture or art standing in for a real asset, and decoration with no data: `making.md` section 11, 13 and 12 of 54 pieces); the same bubbly radius goes on every element; clay art is generated with no link to the product's subject.
- **Accessibility:** pastel fills with white text fail 4.5:1; keep text dark on pastel. Inner shadows do not count as an edge, so controls still need 3:1 against the page. Give every 3D picture alt text or mark it decorative.
- **Seen in:** [Liven](https://mobbin.com/screens/b83fe218-17d9-4401-8375-477ab6f28441) (clay-style 3D icons beside each test) · [ABY Journal](https://mobbin.com/screens/7bad8800-13bf-466f-a622-68d911f4249a) (one puffy cloud shape in a pink-to-cyan gradient) · [(Not Boring) Weather](https://mobbin.com/screens/76f2618f-498a-451e-a864-46b0b2be8ed3) (glossy 3D spheres and blocky 3D numerals) · [Alan](https://mobbin.com/screens/e11fcc45-b238-43f6-ad35-1dc6040d153a) (a soft 3D mascot on a cushion).

### 4. Skeuomorphism
- **Plain words:** The screen imitates real objects and materials: a tape deck, a record player, wood, leather or metal.
- **People say:** realistic, "like a real object", knobs, dials, retro gadget, wood, leather, "like an old iPod".
- **Designers call it:** skeuomorphism, realism, physical metaphor (S-L15-008).
- **What defines it:**
  1. Controls shaped like physical ones: knobs, wheels, switches, sliders with a grip.
  2. Lighting drawn in: gradients from light to dark, a 1 px highlight on top edges, soft shadows underneath.
  3. Material textures: brushed metal, wood grain, paper, leather.
  4. Objects drawn at real proportions and moved the way the real thing moves.
- **In code:** layered `linear-gradient` and `radial-gradient` for lighting, several `box-shadow` layers (an inset top highlight plus outer shadows), texture images or SVG filters. Most of the look lives in assets, not tokens.
- **Dials:** what worked in the showcase's console study (`brand/showcase/styles/04-skeuomorphism`, scored 5): expression 85 · brandPresence 30 · density 85 · energy 35 · roundness 15 · depth 100 · colorfulness 30 · warmth 15 (metal and glass; warm materials such as leather or wood go higher, but stop before the greys turn beige). Low brand presence, because the materials carry the look. No preset; custom controls: `pick Q-plat-06 custom`. Knobs, faders and meters are drawn assets; record textures with the H-motif hook (Q-img-07). Give every knob and fader a keyboard alternative.
- **Fits:** music and audio tools, cameras, creative apps, hardware companions, games, and one-off "special" screens. In B2B, keep it to a metaphor (a folder, a trash can) rather than the whole surface. As a learning aid the metaphor "has never been truly dead"; as full realism it led to cluttered screens and slow loading (S-L15-008).
- **Goes wrong when:** fake materials cover screens that are really forms and lists; the drawn device copies a real brand's hardware (`making.md` section 11: device frames that copy a real brand's hardware); textures stand in for content.
- **Accessibility:** textures lower text contrast and add drawing cost (S-L15-008). Keep text on plain fills. Physical gestures (turning a knob) need a simple alternative such as buttons or a field (WCAG 2.5.7 dragging movements). Keep targets at 24 px or more even when the object is small.
- **Seen in:** [Brink](https://mobbin.com/screens/950daf53-8198-4460-a7a2-0402fe048e8e) (a click-wheel music player drawn as hardware) · [Once](https://mobbin.com/screens/a512d806-9250-4afa-8774-e1f187d15676) (a cassette tape as the recording) · [MD Vinyl](https://mobbin.com/screens/52bcdd10-fd0d-4294-ad26-f4097264950c) (a turntable with a tone arm) · [Poly](https://mobbin.com/sites/sections/de7b069a-e53b-43f4-b3a4-7fefb86de2df) (a wooden desk with film strips and paper).

### 5. Flat design
- **Plain words:** Everything is drawn with solid colors and no shadows, shine or texture.
- **People say:** simple, clean, flat, "no shadows", modern, minimal.
- **Designers call it:** flat design; "flat 2.0" or semi-flat when subtle shadows come back (S-L15-009).
- **What defines it:**
  1. Solid fills; no gradients, textures or bevels (S-L15-009).
  2. Hierarchy from color, size and weight, not depth.
  3. Simple glyph icons and flat vector drawings.
  4. Separation by space, color blocks or 1 px lines.
  5. Flat 2.0 keeps strong signs of what to click: filled primary buttons, underlined links.
- **In code:** `box-shadow: none; background: var(--color-bg-accent);` borders at 1 px; SVG icons with one stroke weight.
- **Dials:** expression 30-50 · brandPresence 40-70 · density any · energy 20-40 · roundness 26-60 (4-8 px) · depth 0-15 (borders) for pure flat, 16-35 for flat 2.0 · colorfulness 45-80 · warmth any. Start from `pick Q-dir-01 flat2` (the default preset: depth 30) and `pick Q-depth-01 borders` for pure flat. Colorfulness sits higher than you might expect, because color blocks carry the hierarchy that depth used to. GOV.UK's recipe sits at depth 0, roundness 0.
- **Fits:** almost everything, from student projects to enterprise dashboards. Flat 2.0 is the mainstream of Carbon, Primer, Polaris and Fluent (DC-L15-01).
- **Goes wrong when:** buttons look like labels and links look like text (weak signifiers); the three-column feature grid with an icon in a circle (`rules.md` section 10); generic flat clip art that says nothing about the product.
- **Accessibility:** weak signifiers cost 22% more time and 25% more eye fixations to find targets (S-L15-004). Keep filled primary actions, underlined links, and 3:1 edges on inputs and controls (WCAG 1.4.11).
- **Seen in:** [Figma](https://mobbin.com/sites/sections/c7cf7938-427c-4a0b-8d61-7fbc6011e76c) (flat color-block drawings with one stroke weight) · [Figma](https://mobbin.com/sites/sections/5eed885b-ccc5-4340-8ed4-c1251f652e0a) (solid yellow, purple and lilac tiles, no shadows) · [Intercom](https://mobbin.com/sites/sections/a97cca39-d727-424a-947b-bb0012b743be) (flat line drawings on light gray tiles).

### 6. Material elevation
- **Plain words:** Cards and buttons float above the page at set heights, and the higher they float, the bigger their shadow.
- **People say:** "like Android", "like Google", floating cards, "the round plus button", "cards with shadows".
- **Designers call it:** Material Design elevation; a shadow ladder; the floating action button (FAB). Material 2 used shadows; Material 3 mostly uses tonal color steps instead (S-L15 style table; DC-L04-10).
- **What defines it:**
  1. A fixed set of heights, usually 5 or 6 levels (Material 3 and Fluent use 6; Q-depth-02).
  2. Each height is a pair of shadows: a sharp key shadow and a soft ambient one. The engine's ladder is ambient `0 0 2px` plus key `0 n/2px n px` (Fluent formula).
  3. A round or squircle floating action button for the main action, low on the right.
  4. A dim scrim behind menus and sheets.
  5. Material 3 swaps most shadows for surface color steps and keeps shadows for things that float.
- **In code:** `box-shadow: var(--elevation-shadow-1);` to `--elevation-shadow-5`; Android: `elevation` or Compose `tonalElevation`.
- **Dials:** expression 40-60 · brandPresence 10-30 · density 34-60 · energy 50-80 · roundness 26-47 for the older look, 93-100 for Material 3 · depth 56-80 (shadow ladder) or 36-55 (tonal) · colorfulness 40-75 · warmth 50. Start from `pick Q-depth-01 shadow` for the shadow look, or `pick Q-dir-01 tonal` for Material 3 (the tonal preset: roundness 95, depth 45). Low brandPresence, because this style defers to Android; the Material 3 Expressive recipe sits at brandPresence 10, energy 80.
- **Fits:** Android apps, Google Workspace-style B2B tools, admin panels, anything that ships on Android first.
- **Goes wrong when:** every card has a big shadow, so nothing stands out; a floating action button lands on a desktop web page (a platform slip, `making.md` section 11); glowing shadows with no offset (`rules.md` section 10).
- **Accessibility:** a shadow alone is not an edge: cards that hold inputs still need 3:1 boundaries. Vivid Material schemes can fail text contrast (S-L15 style table). Springs need a reduced-motion version.
- **Seen in:** [Weverse](https://mobbin.com/screens/ec87d6ce-03e1-4b91-bb14-43c1c9772a64) (raised cards with soft shadows and a red floating plus button) · [Airwallex](https://mobbin.com/screens/0713aaea-bea9-4810-8bdb-849772fd0246) (a floating action button that opens into labelled actions) · [Pangea](https://mobbin.com/screens/ad29ee8d-4b30-430b-9842-53d9e345bacd) (a floating button menu over a dimmed screen).

---

## Bold and graphic

### 7. Neo-brutalism
- **Plain words:** Bold, flat colors with thick black outlines and hard black shadows, like stickers or cut paper.
- **People say:** bold, loud, chunky, "black borders", indie, punk, "like Gumroad", "like a sticker".
- **Designers call it:** neo-brutalism, neubrutalism, anti-design (S-L15-006, S-L15-050).
- **What defines it:**
  1. Black outlines of 2 to 4 px on cards, buttons and inputs.
  2. A solid offset shadow with no blur, about 4 px down and right in black (S-L15-006).
  3. Two or three saturated colors, plus black and white (S-L15-006).
  4. Small or no corner radius, and roomy padding of 24 to 32 px (S-L15-006).
  5. An oversized or quirky display face, with a neutral face for body text (S-L15-006).
  6. Hover and press states that move the element into its shadow.
- **In code:** `border: 3px solid #111; box-shadow: 4px 4px 0 #111;` on hover `transform: translate(2px, 2px); box-shadow: 2px 2px 0 #111;`.
- **Dials:** expression 65-85 · brandPresence 70-90 · density 20-45 · energy 50-70 · roundness 0-37 (0-4 px) · depth 0-15 · colorfulness 63-95 · warmth 40-45. `pick Q-dir-01 neo-brutalism`: the preset builds 3 px borders and a solid 4 px offset shadow. A hex color inside a shadow override now builds too.
- **Fits:** creator tools, indie SaaS, developer tools with a strong brand voice, marketing pages, events. Research keeps it to marketing or indie products (DC-L15-01). In B2B, use it on the marketing site and keep the app on a durable base.
- **Goes wrong when:** every element gets a border and a shadow, so nothing leads; four or more clashing colors; the quirky display face is used for body text; a state is said four ways at once with border, badge, dot and color (`making.md` section 11).
- **Accessibility:** bright pairs such as yellow and cyan fail text contrast (S-L15-006). Black text on saturated fills usually passes; white text on yellow never does. Thick borders help 3:1 non-text contrast. Keep focus rings visibly different from the normal black border.
- **Seen in:** [Gumroad](https://mobbin.com/sites/sections/dd90cfb3-7857-40f3-987a-3c961e106b87) (tiles and browser windows with hard black offset shadows) · [Gumroad](https://mobbin.com/sites/sections/f2dc37b1-13b8-4026-b38d-23ce8e4196ed) (saturated category cards with thin black outlines and pill tags) · [Gumroad](https://mobbin.com/sites/sections/24361c35-958a-4066-8a82-f84728ef6108) (outlined cards with flat color shapes behind portraits) · [Slush](https://mobbin.com/sites/sections/bef161b2-213e-47d0-98e1-7769e041eb86) (heavy italic type in color blocks with sticker art).

### 8. Brutalism
- **Plain words:** The page looks raw and unpolished on purpose: default fonts, plain links, visible structure, giant type.
- **People say:** raw, ugly on purpose, unstyled, "like an old website", anti-design, honest.
- **Designers call it:** brutalism, web brutalism, raw HTML; anti-design for its wilder versions.
- **What defines it:**
  1. System or default fonts (Times, Arial, a monospace), often only one.
  2. Default-looking links: blue or black, underlined.
  3. Square corners and no shadows.
  4. Structure left visible: rules, borders, tables, plain lists.
  5. Either very small type everywhere or one block of oversized type that fills the screen.
  6. Black, white and at most one plain color.
- **In code:** `font-family: Times, serif;` or `ui-monospace`; `border-radius: 0; box-shadow: none;` `a { color: #00e; text-decoration: underline; }` and very little else.
- **Dials:** expression 60-90 for poster type, 10-30 for the raw-HTML look · brandPresence 0-25 (system fonts) · density 50-80 · energy 0-25 · roundness 0-12 · depth 0-15 · colorfulness 0-35 · warmth 30-50. No preset; `pick Q-dir-01 flat2`, then set roundness, depth and colorfulness. Pick `Q-dir-04 lines` for visible rules.
- **Fits:** portfolios, studios and agencies, art and culture sites, editorial experiments, changelogs and release notes with a sense of humor. Rarely for an everyday product UI.
- **Goes wrong when:** "unfinished" becomes an excuse for broken focus, unreadable text or no states; decoration pretends to be raw (crop marks and big sheet numbers, `making.md` section 11); it is chaos with no grid underneath.
- **Accessibility:** default blue links on white pass; small dense type may not reach a comfortable size. Keep visible focus, 24 px targets and real headings. Huge type must still reflow at 320 px width (WCAG 1.4.10).
- **Seen in:** [Shopify Editions](https://mobbin.com/sites/sections/4f083f05-d90a-4ec2-a47a-ec73ed07cf4f) ("The Boring Edition": serif and mono text, underlined links, a beveled print button) · [Studio Freight](https://mobbin.com/sites/sections/37214c10-d891-48bc-a46e-6050033671b4) (a typewriter-style serif set huge across the page) · [Raw Materials](https://mobbin.com/sites/sections/f8f4b266-6f1c-4821-a57f-610a525137f5) (giant numbers, outlined boxes and flat color blocks).

### 9. Comic and pop art
- **Plain words:** It looks like a comic book: thick ink outlines, few flat colors, dot shading and speech bubbles.
- **People say:** comic, cartoon, "like a comic book", dots, speech bubbles, pop art, "POW".
- **Designers call it:** comic style, pop art, halftone, speech balloons, onomatopoeia bursts.
- **What defines it:**
  1. Black ink outlines of 2 to 4 px around shapes and drawings.
  2. Few inks. Black and white plus one or two flat colors reads as premium; red, yellow and blue together reads as a kids' page. In the showcase's incident postmortem (`brand/showcase/styles/05-comic`), red appears only where something is broken.
  3. Halftone dots for shading: a grid of dots that grow in the dark areas.
  4. Speech balloons with tails, and burst shapes for exclamations.
  5. Hand-lettered or comic-style capitals for short labels only.
- **In code:** halftone: `background-image: radial-gradient(#111 1.5px, transparent 1.6px); background-size: 8px 8px;` balloons: an SVG path or a box with a CSS triangle tail; outlines: `border: 3px solid #111`. Comic drawings are assets (H-illus).
- **Dials:** `pick Q-dir-01 comic` keeps thick outlines with no offset shadow, colorfulness 75 and warmth 45. Go lower for premium work: the showcase's incident postmortem (`brand/showcase/styles/05-comic`, scored 4) used a two-ink noir at colorfulness 18. Halftone and drawings are assets: pick an illustration style with Q-img-04 and hand off to opendesigner-illustrate.
- **Fits:** learning and kids, onboarding stories, games, community and fan products, campaign pages. For B2B, one comic-strip explainer on a marketing page can work; the product UI stays calm.
- **Goes wrong when:** speech balloons carry no words or empty jokes; halftone dots decorate every surface (decoration with no data, `making.md` section 11); emoji stand in for drawings (`rules.md` section 10).
- **Accessibility:** keep hand-lettered capitals to a few words; body text stays in a readable face. Halftone behind text lowers contrast. Halftone shimmers when it moves by part of a pixel: move it by whole pixels or keep it still (`making.md` section 7). Burst animations must not flash more than 3 times a second (WCAG 2.3.1).
- **Seen in:** [Figma (Shortcut)](https://mobbin.com/sites/sections/d89d3841-aea4-4bc6-a310-075eb53e19db) (an inked illustration with flat red, yellow and green and dot patterns) · [Duolingo ABC](https://mobbin.com/screens/4f83679d-78e6-48f4-a6a5-c65b7815907d) (a speech balloon with "Listen up!" over a cartoon character) · [Universe](https://mobbin.com/screens/4c75eeef-f37d-4f34-af74-e7c33e3a9e2f) (hand-lettered titles in a spiky burst) · [Butter](https://mobbin.com/sites/sections/ff6aa608-216b-469d-8be0-d74a3f2cc258) (a halftone text effect tile). No Mobbin example showed a full comic-book interface with halftone shading.

### 10. Memphis
- **Plain words:** Playful 1980s patterns: squiggles, zigzags, dots and confetti triangles in clashing bright colors.
- **People say:** 80s, squiggles, confetti, zigzags, "like a 90s TV show", funky.
- **Designers call it:** Memphis style, after the Memphis Group of designers in Milan in the 1980s.
- **What defines it:**
  1. Small repeated shapes: squiggles, zigzags, dots, triangles, half circles.
  2. Clashing colors: pastels next to primaries, with black and white patterns.
  3. Terrazzo-like confetti fills.
  4. A few large shapes set at angles beside the content. Premium Memphis gives each shape a job: in the showcase's ticketing page (`brand/showcase/styles/06-memphis`) the four shapes are the four ticket types, drawn to scale by tickets sold. Shapes scattered with no meaning are the slop version.
- **In code:** SVG pattern tiles as `background-image`; shapes as absolutely positioned SVGs kept out of the reading order (`aria-hidden="true"`).
- **Dials:** expression 85-100 · brandPresence 75-95 · density 15-35 · energy 70-90 · roundness 61-100 · depth 0-15 · colorfulness 88-100 · warmth 60-80. Start from `pick Q-dir-01 maximal` (marketing only). The patterns are brand motifs: `pick Q-img-07 expressive-only` and record the H-motif hook.
- **Fits:** events, youth brands, music and fashion campaigns, party and celebration moments. Not for product UI.
- **Goes wrong when:** confetti and sparkles fill empty space (`making.md` section 11, decoration with no data); four or more pastel hues with no lead color; shapes sit behind text.
- **Accessibility:** busy patterns behind text break contrast; keep text on plain fills. Moving patterns need a pause control when they run longer than 5 seconds (WCAG 2.2.2).
- **Seen in:** Mobbin had no Memphis example in our searches. Described from first principles.

### 11. Bauhaus
- **Plain words:** Big simple shapes (circles, half circles, squares, triangles) in red, yellow, blue and black, with plain bold type.
- **People say:** primary colors, "circles, squares and triangles", art school, geometric, modernist.
- **Designers call it:** Bauhaus, after the German design school (1919 to 1933); geometric modernism.
- **What defines it:**
  1. Basic geometric shapes as the main graphics, often cut and overlapped.
  2. Primary colors plus black, off-white and sometimes orange.
  3. A geometric sans-serif, often in bold or capitals.
  4. Asymmetric layouts on a clear grid.
- **In code:** shapes as CSS (`border-radius: 50%`, `clip-path: polygon(...)`) or SVG; CSS grid for the layout.
- **Dials:** expression 65-85 · brandPresence 65-85 · density 25-50 · energy 30-50 · roundness 0-25 for containers (the circles are graphics, not corners) · depth 0-15 · colorfulness 63-90 · warmth 40-60. `pick Q-type-03 geometric`; record the shapes as brand motifs (Q-img-07, H-motif).
- **Fits:** design tools, education, museums and culture, architecture, community pages. In B2B it works for a brand system whose shapes carry meaning.
- **Goes wrong when:** shapes are scattered with no job; the primary colors collide with status colors (a red shape next to a red error).
- **Accessibility:** white text on yellow and on bright orange fails; check every text-on-shape pair. Keep shapes out of the reading order.
- **Seen in:** [Friends of Figma](https://mobbin.com/sites/sections/d07a48ba-b906-4fac-a94c-4506459d69d1) (half circles, a triangle and squares in orange, blue, yellow and black behind a bold headline) · [Figma](https://mobbin.com/sites/sections/9cb511d3-6877-41db-ae13-07ac364164e7) (concentric color rings around a black circle).

---

## Type and grid

### 12. Swiss / International
- **Plain words:** A strict, tidy grid, plain bold sans-serif type lined up on the left, and lots of empty space.
- **People say:** grid, poster, Helvetica, orderly, "sharp and serious", corporate, Scandinavian.
- **Designers call it:** Swiss style, International Typographic Style, grid systems.
- **What defines it:**
  1. A visible or felt column grid (often 12 columns), with everything snapped to it.
  2. A neo-grotesque sans-serif (the Helvetica family and its relatives).
  3. Text set flush left with a ragged right edge, never centered.
  4. Big jumps in size between headline and text, and asymmetric layouts.
  5. Neutral colors and one strong accent, classically red.
  6. Plain, factual photography.
- **In code:** `display: grid; grid-template-columns: repeat(12, 1fr);` `text-align: start;` a neo-grotesque or system sans; `hyphens: auto` on long text.
- **Dials:** expression 50-70 · brandPresence 50-75 · density 40-60 · energy 15-35 · roundness 0-25 · depth 0-15 or 36-55 · colorfulness 11-45 · warmth 30-50. Start from `pick Q-dir-01 flat2`, `pick Q-type-03 neo-grotesque`, `pick Q-dir-05 start`. Carbon's recipe (roundness 5, colorfulness 25, density 70) shows the enterprise version.
- **Fits:** enterprise and B2B tools, finance, transport and wayfinding, government, documentation, architecture studios. One of the safest styles for a serious product.
- **Goes wrong when:** the look is copied without a grid; tiny tracked monospace labels everywhere (the "newspaper hairlines with tiny tracked mono" default direction, `rules.md` section 10); crop marks and sheet numbers as decoration (`making.md` section 11).
- **Accessibility:** usually strong. Check light gray secondary text against 4.5:1, and keep the grid reflowing to one column at 320 px.
- **Seen in:** [MOUTHWASH Studio](https://mobbin.com/sites/sections/18b9940f-7494-4680-9013-07b8fbe47943) (a tight bold grotesque headline flush left beside one photo) · [Stripe](https://mobbin.com/sites/sections/2d92ea06-bafd-4c12-8254-62c038e72c9d) (a newsroom page with faint column guides and left-aligned type) · [KOBU](https://mobbin.com/sites/sections/92720ac4-a34f-4460-854c-ba4c969c697e) (a giant grotesque wordmark across the page).

### 13. Editorial (magazine)
- **Plain words:** It reads like a good magazine: big serif headlines, calm columns of text and large photos.
- **People say:** magazine, newspaper, bookish, "long reads", literary, elegant.
- **Designers call it:** editorial design, magazine layout, long-form.
- **What defines it:**
  1. A serif display face for headlines, often with italics; a readable text face for body.
  2. Dramatic size jumps: type ratio 1.333 or more (Q-dir-03 `dramatic`; DC-L15-02).
  3. Lines of 60 to 75 characters, generous line height.
  4. Large photos, pull quotes, bylines, dates and section labels.
  5. Thin rules to separate sections (Q-dir-04 `lines`).
- **In code:** `max-width: 65ch;` `font-family: <serif display>` for headings; `initial-letter` for drop caps where supported; `text-wrap: pretty`.
- **Dials:** expression 67-85 · brandPresence 60-85 · density 15-45 · energy 10-30 · roundness 0-25 · depth 0-15 · colorfulness 11-40 · warmth 50-70. `pick Q-type-03 serif`, `pick Q-dir-03 dramatic`, `pick Q-dir-04 lines`.
- **Fits:** publications, blogs, content products, reports, case studies, and the content side of B2B sites (research, annual reports).
- **Goes wrong when:** it lands on one of the three default AI directions: a cream background with a serif and a terracotta accent, or newspaper hairlines with an italic serif and tiny tracked mono (`rules.md` section 10); the content is filler set in a nice serif.
- **Accessibility:** thin serif strokes at small sizes and light weights read poorly; keep body text 16 px or larger. Text over photos needs a scrim checked on the worst spot (Q-img-02).
- **Seen in:** [The New Yorker](https://mobbin.com/sites/sections/03ca30cc-a924-4eb8-baa8-977472e22098) (a capitals display headline and serif deck over a full-bleed image) · [Assembly Coffee](https://mobbin.com/sites/sections/2218a2ac-844a-42bc-b957-64ac22214a79) (an italic serif journal title and story over a photo) · [Faire](https://mobbin.com/sites/sections/9e425155-32e3-4302-b2b3-b2781d4ec576) (a centered serif article headline, tag and date) · [Frontify](https://mobbin.com/sites/sections/9dc7cb3d-08cc-4c17-bb89-4373060676f2) (a large serif headline set flush left).

### 14. Minimal monochrome
- **Plain words:** Black, white and grays only, with lots of empty space and small, quiet type.
- **People say:** black and white, "no color", gallery, quiet, understated, "quiet luxury".
- **Designers call it:** monochrome, minimalism, grayscale palette.
- **What defines it:**
  1. Chroma at or near zero for every color, except status colors.
  2. Separation by space and 1 px hairlines, not fills.
  3. One typeface, often small, with weight doing the emphasis.
  4. Product photos or artwork carry all the color.
- **In code:** a single neutral ramp; `--color-accent` set to the darkest neutral; status colors kept.
- **Dials:** expression 20-40 · brandPresence 40-60 · density 0-35 · energy 10-30 · roundness 0-47 · depth 0-35 · colorfulness 0-10 · warmth 40-50. Start from `pick Q-dir-01 flat2` and `pick Q-color-03 monochrome`. When the person has a brand color, the engine keeps colorfulness at 36 or more unless they set it themselves (`levers.json` brandFloor), so set `dials.colorfulness` explicitly. The Vercel Geist recipe sits at colorfulness 5.
- **Fits:** fashion and premium retail, galleries and portfolios, developer tools, writing tools. Works in B2B as a calm base.
- **Goes wrong when:** so minimal there are no signs of what to click; gray text on gray backgrounds; near-black with one neon accent (a default AI direction, `rules.md` section 10).
- **Accessibility:** light gray text is the main risk: keep secondary text at 4.5:1. Status must use color plus text or an icon, since nothing else has color to contrast with.
- **Seen in:** [Becane](https://mobbin.com/sites/sections/abe97d09-83af-4e81-aefd-7b3a45449219) (a gray page with tiny black type and nothing else) · [Waka Waka](https://mobbin.com/sites/sections/f9a42da3-c557-4ea2-9c80-79ba9b497a0d) (a warm gray field with one line of small text) · [Aave](https://mobbin.com/sites/sections/194a20c4-7e03-4839-86b3-30981d8db06e) (type specimens in grays on light tiles).

### 15. Bento grid
- **Plain words:** Content sits in neat boxes of different sizes, like a bento lunch box.
- **People say:** boxes, tiles, "like Apple's features page", "dashboard tiles", grid of cards.
- **Designers call it:** bento grid, bento box layout, modular grid (S-L15-065).
- **What defines it:**
  1. Tiles of two or three sizes in one tight grid with one gap (12 to 24 px) (S-L15 style table).
  2. One idea per tile; the hero tile is the largest.
  3. Rounded tiles (12 to 24 px) with the same padding.
  4. Each tile shows something real: a number, a screenshot, a short line.
- **In code:** `display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;` with `grid-column: span 2` and `grid-row: span 2` on larger tiles.
- **Dials:** a layout pattern, so it takes its look from another style. Typical: expression 50-70 · density 30-55 · roundness 61-92 · depth 16-55 · colorfulness any. `pick Q-dir-04 containers`. Pair it with flat, dark luxe or glass.
- **Fits:** SaaS feature pages, product launches, dashboards with widgets, portfolios. Works well in B2B for "what you get" sections.
- **Goes wrong when:** every tile has the same weight, so nothing leads (S-L15 style table); tiles hold invented proof, gradient glows or floating tilted screens (`making.md` section 11).
- **Accessibility:** the visual order can differ from the reading order (WCAG 1.3.2): keep the DOM order the order you want read. Reflow to one column on narrow screens.
- **Seen in:** [Retool](https://mobbin.com/sites/sections/0daad8f7-cdde-4ef2-a454-2a26d2bbe0a5) (feature tiles of mixed widths in white and purple) · [Kalstore](https://mobbin.com/sites/sections/f16d29e3-af11-403b-8b03-c79b8279c432) (a text tile, a photo tile and a wide photo tile) · [Spline](https://mobbin.com/sites/sections/98cdbe2e-c4f6-4121-a31c-a2438be62713) (one large tile beside four small ones). Origin: popular accounts credit Apple's keynote and product pages; that story is Tier C only (S-L15-062).

---

## Color and texture

### 16. Mesh and aurora gradients
- **Plain words:** Soft clouds of several colors blend into each other, like the northern lights.
- **People say:** dreamy colors, northern lights, rainbow blur, "gradient background", glow, iridescent.
- **Designers call it:** mesh gradient, aurora gradient, gradient blur, glow.
- **What defines it:**
  1. Three to five colors that blend smoothly in many directions, not along one line.
  2. Large blurred shapes or layered radial gradients.
  3. Often slow movement.
  4. Kept behind headlines on marketing surfaces, not on buttons and forms (`found.color.expressive`; DC-L01-25).
- **In code:** several `radial-gradient(...)` layers on one background, or blurred SVG circles (`filter: blur(80px)`); a mesh exported as an image. Interpolate in OKLab (`linear-gradient(in oklab, ...)`) so colors do not turn muddy (glossary `found.color.expressive`).
- **Dials:** expression 70-90 · brandPresence 60-85 · density 0-30 · energy 40-70 · roundness any · depth any · colorfulness 63-95 · warmth 45 or below. `pick Q-dir-01 mesh-gradient` (or `pick Q-color-25 brand-only`) builds `gradient.brand` and `gradient.mesh.1` to `.3` as DTCG gradients interpolated in OKLab. Make the gradient carry something: in the showcase's eval hero (`brand/showcase/styles/10-mesh-gradient`) it is drawn from the run's own cases and labelled like a chart. Measure text on it as rendered (`making.md` section 5).
- **Fits:** marketing heroes, AI and music products, event pages, wellness and sleep apps. In B2B, one hero or one key moment, never the dashboard.
- **Goes wrong when:** purple or blue-to-purple, the most common AI tell (`rules.md` section 10); blobs with no job, the top tell across 54 audited pieces (`making.md` section 11: 19 of 54); it fills space the product should fill.
- **Accessibility:** text over the brightest point must reach 4.5:1; check the worst spot. Moving gradients longer than 5 seconds need a pause (WCAG 2.2.2) and stop under reduced motion.
- **Seen in:** [OFF+BRAND](https://mobbin.com/sites/sections/5bc9ede6-eb6d-41c3-95f5-509e61755ef2) (blue, green, yellow and pink blended across an image) · [Cosmos](https://mobbin.com/sites/sections/eab202a7-4893-4cf9-a2ef-024d9bf504fc) (a soft mauve fade behind a few words) · [Stardust](https://mobbin.com/screens/f18edf39-7477-4098-a71e-419da4dbff6b) (blurred pink, yellow and violet rings behind text) · [Mixpanel](https://mobbin.com/sites/sections/39838783-732b-43d7-9ee5-bab78282a0dd) (a violet glow under a product screenshot).

### 17. Grain and noise
- **Plain words:** A fine speckle over colors and gradients, like film or printed paper.
- **People say:** grainy, film, analog, textured, paper, "less digital", "vintage".
- **Designers call it:** grain, noise texture, film grain, paper texture.
- **What defines it:**
  1. Fine noise at 3 to 8% opacity over a fill or gradient.
  2. Usually blended with `overlay` or `soft-light`.
  3. It also hides banding in smooth gradients.
  4. Kept still; animated grain is a separate, heavier choice.
- **In code:** an inline SVG with `<feTurbulence type="fractalNoise" baseFrequency="0.8"/>` used as a `background-image` on a pseudo-element with `opacity: .06; mix-blend-mode: overlay; pointer-events: none;`.
- **Dials:** a texture layer that pairs with another style. `engine.py set raw.texture '"grain"' --why "<their words>"` adds `texture.grain.opacity` (0.06) and a `.ds-grain` class to the CSS export. The noise image itself stays an asset (DC-L19-12). Keep warmth at 45 or below; grain over warm neutrals reads as old paper.
- **Fits:** brand and marketing surfaces, music and creative tools, wellness, food. In B2B, one hero or a report cover.
- **Goes wrong when:** texture stands in for a real picture or real content (`making.md` section 11, 13 of 54 pieces); grain sits over body text; grain covers the whole app.
- **Accessibility:** grain lowers text contrast slightly; check contrast with it on. Turn it off under increased contrast (`prefers-contrast: more`). Moving grain shimmers: keep it still (`making.md` section 7).
- **Seen in:** [Suno](https://mobbin.com/screens/3f47480b-8e3c-4c10-936f-eddced3eb63b) (a grainy purple and orange gradient behind a serif welcome) · [Cosmos](https://mobbin.com/screens/cdcfe54f-9e8d-46a3-8136-a500984bc410) (a grainy pink gradient disc) · [Cash App](https://mobbin.com/screens/84fd223f-3016-4f5f-a1ec-4ea7d6f02fd5) (a speckled purple gradient behind bold type) · [Behance](https://mobbin.com/screens/c3b37d64-0c27-43fe-b134-b413711564c0) (a paper-texture card behind text).

### 18. Duotone
- **Plain words:** Photos are recolored in just two colors, one for the dark parts and one for the light parts.
- **People say:** two-color photos, "colored photos like a poster", tinted photos.
- **Designers call it:** duotone, gradient map.
- **What defines it:**
  1. Every photo mapped to the same two colors: a dark one for shadows, a light one for highlights.
  2. The two colors come from the brand palette.
  3. Used on a whole set of images, so they read as one series.
- **In code:** SVG `<feColorMatrix type="saturate" values="0"/>` then `<feComponentTransfer>` with two table values per channel; or `filter: grayscale(1)` under a color layer with `mix-blend-mode: multiply` and `screen`.
- **Dials:** an image treatment that pairs with another style. Typical: expression 60-80 · colorfulness 63-87. `pick Q-color-04 contrasting` gives a natural second color. Image treatment is not a token yet.
- **Fits:** editorial and campaign imagery, conference and event sites, B2B case studies and team pages that need mixed photos to match.
- **Goes wrong when:** it is applied to product screenshots, which hides the product; faces end up in unflattering colors; the two colors fight the brand.
- **Accessibility:** text over duotone photos still needs 4.5:1 at the worst spot. Do not let color be the only cue that something is selected or active.
- **Seen in:** [The New Yorker](https://mobbin.com/sites/sections/29df74de-a58b-43c5-aec5-3367dfb88e47) (a portrait in red and blue beside a serif headline). Our searches found no second clear example.

### 19. Risograph
- **Plain words:** It looks like a cheap, colorful print: two or three bright inks that overlap a little off, with grain.
- **People say:** zine, printed, "like a poster from a print shop", ink, screen print, indie.
- **Designers call it:** risograph or riso print, named after the Riso stencil duplicator; spot color, overprint, misregistration.
- **What defines it:**
  1. Two or three spot inks, often fluorescent pink, blue and yellow.
  2. Overprint: where inks overlap they mix (`multiply`).
  3. Layers shifted 1 to 3 px out of line.
  4. Grain and uneven ink fill.
- **In code:** each color layer as its own element with `mix-blend-mode: multiply` and a small `transform: translate(2px, 1px)`; a grain overlay (style 17).
- **Dials:** expression 65-85 · brandPresence 70-90 · density 20-45 · energy 20-40 · roundness 0-37 · depth 0-15 · colorfulness 63-87 · warmth 25-45 (warmer paper turns cream, and cream with warm inks drifts toward the brown, orange and cream palette that reads as AI default). `pick Q-color-04 three` for three inks. `raw.texture` grain is included. Spot-ink limits and misregistration are not tokens yet.
- **Fits:** indie publishing, cultural events, cafes and small shops, music, creative education. Marketing only.
- **Goes wrong when:** fake misregistration is applied to interface text; texture stands in for a real asset (`making.md` section 11).
- **Accessibility:** never shift body text or controls out of line. Fluorescent pink and yellow fail text contrast on white; use the darkest ink for text.
- **Seen in:** Mobbin had no risograph example in our searches. Described from first principles.

---

## Eras

### 20. Art Deco
- **Plain words:** 1920s glamour: gold lines on black or deep green, fans and sunbursts, tall elegant capitals.
- **People say:** Gatsby, gold, 1920s, grand hotel, theatre, "old Hollywood", vintage luxury.
- **Designers call it:** Art Deco, named after the 1925 Paris decorative arts exhibition.
- **What defines it:**
  1. Strict symmetry and stepped shapes.
  2. Fans, sunbursts, chevrons and thin parallel lines as ornament.
  3. Gold or brass on black, navy or deep green.
  4. Tall, geometric display capitals with high contrast between strokes.
  5. Ornament kept to frames and dividers.
- **In code:** SVG ornaments; `border-image` for stepped frames; a gold color plus a lighter highlight step.
- **Dials:** expression 70-90 · brandPresence 80-95 · density 20-40 · energy 20-40 · roundness 0-25 · depth 0-35 · colorfulness 20-45 · warmth 60-80. Design dark first and keep a light twin (`pick Q-theme-01 light-dark-toggle`); `dark-only` breaks STD-visual-details-24, so use it only when the person explicitly asks (`engine.py standard override`). Its display type is not one of the Q-type-03 classes yet.
- **Fits:** hospitality, restaurants and bars, events, theatre, jewelry, heritage finance and private banking marketing.
- **Goes wrong when:** gold gradient text everywhere; ornament on every card; thin gold lines carry meaning nobody can see.
- **Accessibility:** gold on black often passes for large text but fails for small text; check each size. Thin ornamental lines are decoration and need no 3:1, but any line that marks a control does.
- **Seen in:** Mobbin had no Art Deco interface in our searches. Described from first principles.

### 21. Y2K and retro-futurism
- **Plain words:** The shiny future as people imagined it around 2000: chrome, holographic colors, bubbly shapes and old computer windows.
- **People say:** 2000s, chrome, holographic, bubbly, glossy, MySpace, vaporwave, "like old Windows".
- **Designers call it:** Y2K aesthetic, retro-futurism, vaporwave, chrome type.
- **What defines it:**
  1. Chrome and metallic type or objects with sharp highlights.
  2. Iridescent and holographic gradients (pink, blue, lilac, lime).
  3. Glossy pill buttons and inflated, bubbly lettering.
  4. Retro operating-system windows, wireframe grids and sparkles.
- **In code:** `background: linear-gradient(...)` with `background-clip: text` for chrome type; layered highlights with `box-shadow` and `inset`; 3D chrome is an asset.
- **Dials:** expression 85-100 · brandPresence 80-100 · density 15-40 · energy 70-90 · roundness 81-100 · depth 56-80 · colorfulness 75-100 · warmth 30-50. Start from `pick Q-dir-01 maximal`. Gloss and chrome are not tokens yet.
- **Fits:** youth social apps, music, fashion, creator tools, campaign moments. Not B2B product UI.
- **Goes wrong when:** chrome goes on every heading; glowing shadows with no offset and sparkles fill space (`rules.md` section 10; `making.md` section 11); bubbly type is used for interface labels.
- **Accessibility:** chrome and holographic text has changing contrast along each letter; keep it to large display text with a solid fallback color. Shimmer animations need reduced-motion handling and must not flash.
- **Seen in:** [beehiiv](https://mobbin.com/sites/sections/43abdff4-c48f-4c43-9633-1d1aa4337642) (an old-style OS window over a sunset and wireframe landscape) · [Butter](https://mobbin.com/sites/sections/7d1f4333-5f5a-4758-8bd1-52313dfd3678) (chrome lettering in a dark tile) · [Bump](https://mobbin.com/screens/430dfc3a-65bd-4d88-a80c-aa56d9057190) (glossy yellow pill messages, clouds, a rainbow and sticker labels) · [Contra](https://mobbin.com/sites/sections/91bc6512-fd35-4779-ae4e-327458a13b56) (an iridescent glass star on lime).

### 22. Frutiger Aero
- **Plain words:** The glossy, hopeful look of mid-2000s computers: aqua bubbles, blue skies, green grass and shiny glass buttons.
- **People say:** Windows Vista, aqua, bubbles, "sky and grass", glossy, "early iPhone", nostalgic.
- **Designers call it:** Frutiger Aero (a name fans gave the look later), Web 2.0 gloss, aqua.
- **What defines it:**
  1. Gloss: a bright highlight across the top half of buttons and icons.
  2. Aqua blue and fresh green, with white.
  3. Nature imagery: sky, clouds, grass, water drops, bubbles.
  4. Translucent glass panels with soft reflections.
  5. Rounded, friendly humanist sans-serif type.
- **In code:** `background: linear-gradient(180deg, rgb(255 255 255 / .7) 0 48%, transparent 52%), var(--accent);` for gloss; glass as in style 1.
- **Dials:** expression 60-75 · brandPresence 60-80 · density 25-45 · energy 40-60 · roundness 81-100 · depth 81-100 · colorfulness 63-87 · warmth 30-45. Start from `pick Q-dir-01 glass`; gloss is not a token yet.
- **Fits:** nostalgia brands, weather and outdoor apps, eco-tech, kids' tech, music. Rare in B2B.
- **Goes wrong when:** stock bubbles and grass decorate screens that have nothing to do with nature; every control gets gloss.
- **Accessibility:** white text on light aqua fails; use dark text. Glass needs its solid fallback (style 1).
- **Seen in:** Mobbin had no full Frutiger Aero interface in our searches. The nearest: [XChat](https://mobbin.com/screens/4a90f445-6a78-4390-a2c6-e99432d5e3ff) (glossy bubble-shaped app icons with top highlights) · [Bump](https://mobbin.com/screens/430dfc3a-65bd-4d88-a80c-aa56d9057190) (a sky with clouds and glossy pill bubbles).

### 23. Pixel art and 8-bit
- **Plain words:** Everything is drawn from visible square pixels, like an old video game.
- **People say:** 8-bit, retro games, pixels, arcade, "like Minecraft", blocky.
- **Designers call it:** pixel art, 8-bit, bitmap, dithering.
- **What defines it:**
  1. Square pixels kept sharp, scaled only by whole numbers (2x, 3x, 4x).
  2. A small fixed palette, often 4 to 16 colors.
  3. Bitmap or pixel fonts for headings.
  4. Dithering (checker patterns) instead of smooth gradients.
  5. Stepped movement rather than smooth easing.
- **In code:** `image-rendering: pixelated;` integer `transform: scale(3)`; `animation-timing-function: steps(4)`; pixel fonts loaded only for display sizes.
- **Dials:** expression 70-90 · brandPresence 75-95 · density 30-60 · energy 40-70 · roundness 0-12 · depth 0-15 · colorfulness 63-100 · warmth any. Pixel fonts are a brand face: check the licence (`hooks.md`, H-type). Stepped motion is not a token yet.
- **Fits:** games, developer culture, AI and tech brands with a playful edge, retro products, onboarding moments. In B2B, pixel touches on a marketing site and logo are common.
- **Goes wrong when:** pixel fonts are used for small text; pixels scale by non-whole amounts and go blurry; retro clichés replace real product content.
- **Accessibility:** pixel fonts are hard to read below about 16 px and for long text; keep body text in a normal face. Dither patterns shimmer when moved by part of a pixel (`making.md` section 7).
- **Seen in:** [Wild](https://mobbin.com/sites/sections/b7197fb0-f4c9-4583-8864-d0f5e1c94195) (a headline built from colored pixel blocks) · [InPost UK](https://mobbin.com/screens/c8420f39-6110-4d03-a9ff-ceee61be66e2) (a pixel-art hand tapping a phone) · [Mistral AI](https://mobbin.com/sites/sections/347191b0-2f40-4c51-b2e9-aad518ca2122) (a pixel logo and pixel blocks on a faint grid) · [Threads](https://mobbin.com/sites/sections/a890e6ab-1a0f-4926-b3da-575386445912) (pixel-art portraits on colored cards).

---

## Mood

### 24. Terminal and ASCII
- **Plain words:** It looks like a computer's command line: monospace letters, a prompt, and pictures made of text characters.
- **People say:** hacker, code, "command line", "like a terminal", matrix, nerdy.
- **Designers call it:** terminal UI, TUI, ASCII art, monospace aesthetic.
- **What defines it:**
  1. A monospace face for most or all text, on a character grid.
  2. Light text on near-black, often one phosphor color (green, amber or white).
  3. Prompts (`~ %`, `>`), a cursor, and command-style labels in brackets.
  4. Pictures and boxes made of characters (ASCII art, box-drawing lines).
- **In code:** `font-family: ui-monospace, ...; font-variant-ligatures: none;` sizes in `ch`; `white-space: pre` for ASCII art inside an element with an `aria-label`.
- **Dials:** expression 30-60 · brandPresence 60-80 · density 60-90 · energy 0-25 · roundness 0-12 · depth 0-15 · colorfulness 0-35 · warmth 20-40 (green or white) or 60-80 (amber). Design dark first and keep a light twin (`pick Q-theme-01 light-dark-toggle`; `dark-only` breaks STD-visual-details-24). Set the text face to a monospace face with `engine.py set raw.textFace '"<mono face>"' --why "<their words>"`. Mono as the main interface face is not a Q-type-03 option yet.
- **Fits:** developer tools, CLI products, infrastructure and security B2B, AI agent products, docs.
- **Goes wrong when:** monospace is used for long reading; typing animations delay real content; near-black with one neon accent (a default AI direction, `rules.md` section 10).
- **Accessibility:** dim green on black often fails 4.5:1; check it. A blinking cursor must stop after 5 seconds or have a pause (WCAG 2.2.2). ASCII art needs a text alternative, since screen readers read it character by character.
- **Check the font:** box-drawing characters (`┌ ─ ┐ │ └ ┘ ├ ┼`) are missing from many open monospaced fonts. In the showcase's terminal study (`brand/showcase/styles/11-terminal`), 10 of 24 tested fonts lacked them, including Martian Mono, and several others drew tables that did not close; Lilex and Geist Mono passed. Render a closed box before you pick the font.
- **Seen in:** [Shopify Supply](https://mobbin.com/sites/sections/85479695-55d2-4f92-89bc-1790dda9d9d9) (ASCII-art letters and a command prompt on black) · [The Content Architecture](https://mobbin.com/sites/sections/29bfe158-19c6-48e3-b87a-f4e5e03b0e6f) (a code editor and terminal as the hero, with monospace capitals in the nav) · [Cloudstudio](https://mobbin.com/sites/sections/681234c7-3cdc-4509-bf5f-e6303ef87379) (monospace labels and a boxed diagram on dark).

### 25. Dark luxe
- **Plain words:** A near-black, quiet, expensive-feeling look: soft gray text, thin lines, one light source and real product screens.
- **People say:** sleek dark, "premium SaaS", "like Linear", moody, high-end, "Apple keynote dark".
- **Designers call it:** dark mode first, dark UI, "Linear-style"; there is no single agreed name.
- **What defines it:**
  1. A near-black background (not pure black), with surfaces 2 to 4% lighter for each layer.
  2. 1 px borders in white at 6 to 10% opacity.
  3. White headlines and mid-gray secondary text.
  4. One soft light source: a faint radial glow near the top.
  5. One accent, used rarely; product screenshots do the showing.
  6. A neo-grotesque sans with tight tracking on large sizes; sometimes a serif for contrast.
- **In code:** `background: #0b0b0d;` surfaces `#121214`, `#18181b`; `border: 1px solid rgb(255 255 255 / .08);` a `radial-gradient(ellipse at top, rgb(255 255 255 / .06), transparent 60%)`.
- **Dials:** expression 35-55 · brandPresence 60-80 · density 45-88 · energy 25-45 · roundness 38-60 (6-8 px) · depth 16-55 · colorfulness 5-30 · warmth 20-60. Design dark first and keep a light twin (`pick Q-theme-01 light-dark-toggle`); `dark-only` breaks STD-visual-details-24, so use it only when the person explicitly asks. The Linear recipe in `levers.json` sits at expression 20, density 88, roundness 45, depth 45, colorfulness 20; Vercel Geist at roundness 42, depth 25, colorfulness 5.
- **Fits:** B2B SaaS, developer tools, pro creative tools, AI products, finance tools for experts.
- **Goes wrong when:** near-black with one neon accent and glowing shadows with no offset (both default AI tells, `rules.md` section 10); a purple glow behind everything; gray text drops below 4.5:1.
- **Accessibility:** mid-gray on near-black is the main risk; check every text tier. Dark mode needs its own focus color that passes 3:1. Offer a light theme where people work long hours, or respect the system setting.
- **Seen in:** [Linear](https://mobbin.com/sites/sections/0e464c7e-94e9-43b1-a7a3-8f33bd04a16f) (a near-black hero with gray text and a product screenshot with hairline borders) · [Linear](https://mobbin.com/sites/sections/66f59864-ae93-419b-89c9-e53fbb46a3f3) (a serif headline on black with thin line circles) · [Grok](https://mobbin.com/sites/sections/92706881-cc9a-40f8-a3d4-c491bd0c364b) (dark page with one warm radial light and monospace labels).

### 26. Playful and toy-like
- **Plain words:** Chunky, bright and bouncy, like a toy: big rounded buttons with a thick bottom edge, candy colors and a friendly character.
- **People say:** fun, for kids, chunky, bouncy, cute, "like Duolingo", "like a game".
- **Designers call it:** playful UI, gamified UI, toy-like, chunky buttons.
- **What defines it:**
  1. Buttons with a darker bottom ledge, 3 to 5 px, that disappears when pressed.
  2. Large radius or full pills.
  3. Bright, saturated candy colors.
  4. A rounded, heavy display face.
  5. A mascot or characters in key moments, and bouncy springs.
- **In code:** `box-shadow: 0 4px 0 var(--accent-pressed); border-radius: 16px;` pressed: `transform: translateY(4px); box-shadow: none;` springs with a damping ratio of about 0.6 to 0.8.
- **Dials:** expression 65-85 · brandPresence 70-90 · density 10-35 · energy 70-90 · roundness 81-100 · depth 56-80 · colorfulness 75-95 · warmth 60-80. The feel word "fun" adds the playful macro (expression +20, energy +20, roundness +30, colorfulness +25). `pick Q-type-03 rounded`, `pick Q-img-04 mascot`. The ledge shadow is not generated yet.
- **Fits:** kids and learning, habit and health trackers, games, consumer finance for young people. In B2B, onboarding or celebration moments only.
- **Goes wrong when:** emoji as decoration (`rules.md` section 10); the mascot shows up on every screen; every element bounces; confetti fills space (`making.md` section 11).
- **Accessibility:** bouncy springs need a reduced-motion version. White text on bright green, yellow or orange often fails; check each pair. Keep the ledge as decoration: the button's edge still needs 3:1.
- **Seen in:** [Duolingo](https://mobbin.com/screens/28505b1e-64a4-4607-aee8-4983e90ee49b) (a chunky "Tap to speak" button with a darker bottom edge under a cartoon character) · [Duolingo ABC](https://mobbin.com/screens/6186431a-817e-4071-a8c8-1a44a0e73596) (letters in bubbles and a mascot) · [Finch](https://mobbin.com/screens/b81477a0-dcc8-4751-ac87-9c093a02fc1e) (a cartoon pet, a speech balloon and rounded cards) · [Spotify Kids](https://mobbin.com/screens/95aab4ab-0526-4d26-bfcb-2b19cb08c607) (a character picker with bold rounded type).

### 27. Organic and natural
- **Plain words:** Earthy colors, soft irregular shapes and natural photos: calm, warm and made by hand.
- **People say:** natural, earthy, eco, plants, "calm and warm", handmade, sustainable.
- **Designers call it:** organic design, natural aesthetic, earthy palette, biophilic.
- **What defines it:**
  1. Earthy colors: olive, moss, sand, clay, warm white.
  2. Irregular, hand-drawn or leaf-like shapes instead of perfect geometry.
  3. Natural photography: plants, food, materials, people outdoors.
  4. A serif or warm humanist sans.
  5. Warm neutrals tinted toward yellow or red.
- **In code:** warm neutral ramps; organic shapes as SVG paths or `border-radius` with eight values (`60% 40% 55% 45% / 50% 60% 40% 50%`).
- **Dials:** expression 40-60 · brandPresence 55-75 · density 15-40 · energy 20-40 · roundness 61-92 · depth 16-55 · colorfulness 36-62 · warmth 70-90. The feel word "friendly" adds warmth +30 and roundness +15; `pick Q-color-09 warm`, `pick Q-type-03 humanist` or `serif`.
- **Fits:** food, wellness, agriculture (including B2B agritech), sustainability reports, outdoor brands, cafes.
- **Goes wrong when:** cream with a serif display and a terracotta accent (a default AI direction, `rules.md` section 10); warm cream with orange and brown (`making.md` section 11); decorative blobs and wavy dividers (`rules.md` section 10).
- **Accessibility:** olive and sand pairs are low in contrast; check text and control edges. Text on organic shapes and photos needs a checked scrim.
- **Seen in:** [Farm Minerals](https://mobbin.com/sites/sections/dc8c3b42-7eee-439f-9bdb-6b0a83a3277d) (olive green on sand with a leaf-shaped photo cut-out) · [Savor](https://mobbin.com/sites/sections/8691b8cf-86d0-4134-b528-d806561b518b) (a serif headline on warm cream beside candid photos) · [KÖPPEN](https://mobbin.com/sites/sections/540eb76e-09ed-4538-9caf-3201ee806bdb) (a sunlit portrait beside a close-up of a liquid organic shape).

---

## Drawing

### 28. Isometric
- **Plain words:** Things are drawn in 3D from above at a fixed angle, with no vanishing point, so parallel lines stay parallel.
- **People say:** 3D diagram, little city, stacked layers, blocks, "like SimCity".
- **Designers call it:** isometric illustration, axonometric drawing, exploded view.
- **What defines it:**
  1. Three axes, two at 30 degrees from horizontal (pixel isometric uses a 2:1 slope, about 26.6 degrees).
  2. No perspective: far objects are the same size as near ones.
  3. One light direction for all faces: top lightest, one side mid, one side darkest.
  4. Often stacked or exploded layers to explain how a system fits together.
- **In code:** SVG drawings; CSS can fake it with `transform: rotateX(55deg) rotateZ(45deg)` but drawings are better as assets.
- **Dials:** a drawing style that pairs with a page style. The page usually stays flat: depth 0-35, so the drawing carries the depth. Choose and source drawings with opendesigner-illustrate; Q-img-04 has no isometric option yet.
- **Fits:** infrastructure, fintech and B2B products explaining layers or architecture; data and security; games.
- **Goes wrong when:** isometric clip art has nothing to do with the product; floating tilted UI fragments overlap the copy (`making.md` section 11); the drawing invents parts the words never mention (`making.md` section 8).
- **Accessibility:** diagrams need a text description of what they show. Thin gray lines on dark fail 3:1 when they carry meaning.
- **Seen in:** [Mercury](https://mobbin.com/sites/sections/3a483a4e-ab5c-494e-9db9-c6d41660be22) (an exploded stack of four labelled layers) · [illoca](https://mobbin.com/sites/sections/a67bb39c-e43c-4fac-abbf-7032b9bcde3c) (a detailed isometric factory floor) · [Rox](https://mobbin.com/sites/sections/f81fe9bd-84ae-40e5-8ddd-6a406a3442fc) (stacked isometric plates on a dark page).

---

## Gradients and surfaces: a short glossary

Same pattern as everywhere: plain words first, then what designers say, then the code.

### Gradient kinds
| Term | Plain words | Designers call it | In code | Seen in |
|---|---|---|---|---|
| Linear gradient | One color fades into another along a straight line. | linear gradient | `linear-gradient(180deg in oklab, A, B)` | [Inkwell](https://mobbin.com/sites/sections/409f023a-42b3-41f6-953f-7cdec40b00a5) (blue to peach, top to bottom) · [KODE Immersive](https://mobbin.com/sites/sections/9e9698c5-fa1a-4103-afd4-dd4bb1fbf82a) (red to orange) |
| Radial gradient | Color spreads out from a point, like light from a lamp. | radial gradient, glow, spotlight | `radial-gradient(circle at 80% 40%, A, transparent 60%)` | [Grok](https://mobbin.com/sites/sections/92706881-cc9a-40f8-a3d4-c491bd0c364b) (a warm light from the right edge) · [Shopify Editions](https://mobbin.com/sites/sections/acd4095e-9138-43bb-85e9-125ef2340713) (a violet glow at the top) |
| Conic gradient | Colors turn around a center point, like a color wheel or a pie. | conic or angular gradient, sweep | `conic-gradient(from 0deg, A, B, A)` | Nearest: [Wizz](https://mobbin.com/sites/sections/0713e9b4-a462-478e-b2b1-0bb9dde4deb2) (a pink and green swirl; a swirl is a twisted conic) |
| Mesh gradient | Several colors blend in many directions at once. | mesh gradient, freeform gradient | several stacked `radial-gradient` layers, or an image | [OFF+BRAND](https://mobbin.com/sites/sections/5bc9ede6-eb6d-41c3-95f5-509e61755ef2) |
| Aurora gradient | A soft, blurry, glowing mesh, like the northern lights, often moving slowly. | aurora, gradient blur | blurred shapes (`filter: blur(80px)`) behind content | [Stardust](https://mobbin.com/screens/f18edf39-7477-4098-a71e-419da4dbff6b) |
| Gradient border | The outline itself fades from one color to another. | gradient stroke, gradient border | `border: 1px solid transparent; background: linear-gradient(var(--bg), var(--bg)) padding-box, linear-gradient(90deg, A, B) border-box;` | none found |
| Gradient text | The letters fade from one color to another. | gradient text, gradient fill | `background: linear-gradient(...); -webkit-background-clip: text; background-clip: text; color: transparent;` | [Grok](https://mobbin.com/sites/sections/92706881-cc9a-40f8-a3d4-c491bd0c364b) (the headline fades from gray to white) |

Gradients belong on marketing and illustration surfaces, never on buttons or forms; a gradient that means data uses a sequential palette (glossary `found.color.expressive`, DC-L01-25). Text on any gradient is checked at its lightest and darkest point.

### Surface terms
| Term | Plain words | Designers call it | In code | Seen in |
|---|---|---|---|---|
| Frosted glass | A see-through panel that blurs what is behind it. | glass, backdrop blur, material | `backdrop-filter: blur(20px)` over a translucent fill | [CLEAR](https://mobbin.com/screens/3c9f89d5-8e16-4f77-8cdd-1fe3f9f07907) |
| Drop shadow | A soft shadow under something, so it looks lifted. | drop shadow, elevation | `box-shadow: 0 4px 12px rgb(0 0 0 / .12)` | [Weverse](https://mobbin.com/screens/ec87d6ce-03e1-4b91-bb14-43c1c9772a64) |
| Inner shadow | A shadow inside the edge, so something looks pressed in. | inner shadow, inset | `box-shadow: inset 0 2px 4px rgb(0 0 0 / .15)` | none found clearly |
| Hard (offset) shadow | A sharp, solid shadow shifted to one side, with no blur. | hard shadow, offset shadow | `box-shadow: 4px 4px 0 #111` | [Gumroad](https://mobbin.com/sites/sections/dd90cfb3-7857-40f3-987a-3c961e106b87) |
| Long shadow | A shadow that stretches far out at 45 degrees, flat-style. | long shadow | many stacked `text-shadow` or `box-shadow` steps, or an SVG shape | none found; S-L15-009 calls it flat 2.0 "gone wrong" |
| Hairline | The thinnest possible line, 1 px or less. | hairline, rule, divider | `border-top: 1px solid var(--color-border)`; 0.5 px on high-density screens | [Linear](https://mobbin.com/sites/sections/0e464c7e-94e9-43b1-a7a3-8f33bd04a16f) |
| Sticker / die-cut | A shape with a white outline, as if cut out and stuck on. | sticker, die-cut | SVG with a thick white stroke under the art, plus a small shadow | [Bump](https://mobbin.com/screens/430dfc3a-65bd-4d88-a80c-aa56d9057190) (a tilted name sticker) · [Slush](https://mobbin.com/sites/sections/bef161b2-213e-47d0-98e1-7769e041eb86) (sticker art over type) |
| Halftone | Shading made of dots that grow larger in darker parts. | halftone, dot screen, Ben-Day dots | `radial-gradient(#111 1.5px, transparent 1.6px) 0 0 / 8px 8px` | [Butter](https://mobbin.com/sites/sections/ff6aa608-216b-469d-8be0-d74a3f2cc258) (a halftone tile) |
| Grain / noise | A fine speckle, like film or paper. | grain, noise | SVG `feTurbulence` overlay at about 6% opacity | [Suno](https://mobbin.com/screens/3f47480b-8e3c-4c10-936f-eddced3eb63b) |
| Scanlines | Thin horizontal stripes, like an old TV screen. | scanlines, CRT effect | `repeating-linear-gradient(0deg, rgb(0 0 0 / .15) 0 1px, transparent 1px 3px)` | none found |
| Bevel | Edges cut at an angle, lighter on top and darker below, so something looks raised. | bevel | `border` with light top-left and dark bottom-right colors, or two inset shadows | [Shopify Editions](https://mobbin.com/sites/sections/4f083f05-d90a-4ec2-a47a-ec73ed07cf4f) (an old-style beveled print button) |
| Emboss | A shape or text pressed into or raised out of the surface, the same color as it. | emboss, deboss, letterpress | `text-shadow: 0 1px 0 rgb(255 255 255 / .6), 0 -1px 0 rgb(0 0 0 / .2)` | none found |

Accessibility for every surface effect: an effect is never the only sign of a state or an edge. Inner shadows, bevels and embossing do not count toward the 3:1 non-text contrast an edge needs, and text set with an emboss or over halftone, grain or scanlines is checked with the effect on.
