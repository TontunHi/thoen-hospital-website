# Kerning and letter spacing: what goes wrong, and how to stop it

Read this before you set `letter-spacing`, animate text letter by letter, ship a font file, or move type between Figma, CSS, Swift and Compose. It applies to every project: pages, apps, videos, decks and images. `preflight.py html` catches the rule-shaped cases automatically (checklist item 57, mistake M58). The rest needs a look at 200%.

Two words, kept apart:
- **Kerning** is the font's own spacing for each pair of letters ("AV", "To", "r."). It lives inside the font file (the `kern` feature) and the browser or OS applies it. You rarely change it; you mostly stop things from breaking it.
- **Tracking** (`letter-spacing` in CSS, `letterSpacing` in DTCG, Figma and Compose, `tracking` in SwiftUI) adds the same amount after every letter. It belongs to the design system, per text style.

## 1. Kerning that silently switches off

| What breaks it | Why | Do this |
|---|---|---|
| Splitting a word into one element per letter, for an animation | Each letter is shaped on its own, so the pair kerning and ligatures between letters are lost. Measuring before the web font loads makes it worse. Many screen readers then read letter by letter (Roselli tested 8 browser and reader pairs; 6 failed). | Animate whole lines or words with transform and opacity. If letters must move: wait for `document.fonts.ready`, measure each letter's position in the real text, give each pair its kerning back as a margin, and put the original markup back when the animation ends, so the last frame equals plain text. Keep one accessible copy of the text. The OpenDesigner site's headline does this (`site/static/site.js`, `gather`). |
| `font-kerning: none`, `font-feature-settings: "kern" 0` | Turns the font's pair spacing off for that element and its children. | Never ship either. Use `font-kerning: normal` on headings and display text. |
| `font-kerning: auto` (the default) at small sizes | Some browsers drop kerning on small text. | Leave body text on `auto`; set `normal` on display sizes and anywhere a logo-like word is set in type. |
| `text-rendering: optimizeSpeed` | Asks the browser to skip kerning and ligatures. | Remove it. `optimizeLegibility` is not needed for kerning in current browsers and is slow on long text. |
| `font-feature-settings` used for anything else | It replaces the whole list of features set on the element, so a later rule that sets `"ss01"` can drop another rule's `"tnum"`. | Use the `font-variant-*` properties (`font-variant-numeric: tabular-nums`, `font-variant-ligatures`). Keep `font-feature-settings` for features with no property, in one place. |
| A subset font file | `pyftsubset` keeps `kern`, `liga` and `calt` by default (fontTools 4.55, `_layout_features_groups`), but drops `tnum`, `case`, stylistic sets and other features unless you name them. A subsetter called with `--layout-features=''` drops kerning too. | Subset with `--layout-features+=tnum,case,...` for every feature the system uses. After subsetting, render "AV To Wa r. 1111" and compare with the full font. |
| A fallback font, or a faux weight | Tracking tuned for one face is wrong on the fallback, and a synthesized bold or italic is a smeared copy of the regular with no spacing of its own. | Load every weight and style you use (preflight item 10). Set `font-synthesis: none` once the real files load. Match the fallback's metrics with `size-adjust` and `ascent-override` in an `@font-face` for it. |

## 2. Tracking that goes wrong

| Mistake | Why | Do this |
|---|---|---|
| One tracking value for every size | Letters read too far apart as type grows, and small text needs a little room (STD-visual-details-05). | Tracking is a property of each text style, written in **em** so it scales: tight on display sizes, near 0 on body, slightly positive on small text. The engine writes it per style (`--<prefix>-text-<style>-tracking`); use the style, never a literal. |
| Tracking in px | `letter-spacing: -1px` is right at one size and wrong at every other, and does not follow text zoom. | Use em. A px value is a sign the number was copied from a mock. |
| Display type tracked too tight, often with a heavy weight | Letters touch, and word spaces vanish: "how it" reads "howit" (M5). | No tighter than about -0.02em unless the font's own display cut or optical size is designed for it. At 200%, no two glyphs touch and every word space is clearly wider than the widest letter gap. |
| Capitals and small caps at 0 or negative tracking | Capitals were drawn to sit next to lowercase; side by side they crowd (STD-visual-details-04). | Uppercase labels get +0.04em to +0.1em (the engine's caps labels use 0.05em). |
| Figma's percent read as px or as CSS percent | Figma shows tracking as a percent of the font size: -2% is `-0.02em`. In CSS, a `%` letter-spacing is a share of the **space** width, a much smaller unit, and `-2px` is a different number again. | Divide Figma's percent by 100 and write em. In code, any tracking beyond about ±0.15em on mixed-case text is almost always a unit mistake. |
| Tracking on scripts that join or have no case | Arabic letters join; spacing breaks the joins. CJK and Indic scripts are set solid by design. | 0 for those scripts (`levers.json`, `zeroScripts`; the engine writes it per script). Never track a language you can't read without checking with a native reader. |
| Tracking on code, numbers in tables, and monospace | Mono glyphs are spaced to line up in columns; tracking breaks the grid. | `letter-spacing: 0` on code, `pre`, and tabular figures. |
| Centred or right-aligned tracked text | Browsers add the spacing after the last letter too (CSS Text has long discussed dropping it at line ends; engines still differ), so a centred, tracked caps label sits off-centre by one tracking unit. | On a short, centred, tracked label, add `padding-inline-start` equal to the tracking, or a negative `margin-inline-end`. Check it at 200%. |
| Animating `letter-spacing` | It changes layout every frame and snaps to whole pixels (M18). | Animate `transform` (scale, or move words), or fade between two settings. |
| Tracking that can't take a user's spacing | WCAG 2.2 SC 1.4.12 (AA): with letter spacing raised to 0.12em, word spacing 0.16em and line height 1.5, nothing may clip or overlap. | No fixed heights or `overflow: hidden` on text boxes; let labels grow. Test with a text-spacing bookmarklet. |

## 3. Across tools

| From | To | Rule |
|---|---|---|
| Design token (em) | CSS | `letter-spacing: <em>em` (the CSS export does it) |
| Design token | Figma | percent = em x 100 (the Figma export writes `PERCENT`) |
| Design token | DTCG | a dimension in px or rem, `size x em` (DTCG has no em); keep the em in `$extensions` |
| Design token | SwiftUI | The Swift export uses Dynamic Type system styles, and the system font applies Apple's tracking itself. For a custom face, add `.tracking(size x em)` in points |
| Design token | Compose | `letterSpacing = <em>.em` (Android's `android:letterSpacing` is also em) |
| Apple's SF Pro | anything | Apple publishes a tracking value for each point size in the HIG typography page. The engine's `size-table` option (Q-type-13) uses it. On Apple platforms the system font applies it for you; don't add it twice. |
| Canvas and video | frames | `ctx.letterSpacing` and the renderer's font must be the real face. Wait for `document.fonts.ready` before the first frame (preflight item 10). |

## 4. The check, in order
1. Every tracking value comes from a text style token, in em. No px, no CSS `%`.
2. Display sizes are no tighter than the system's value. Capitals are positive. Code, numbers in tables and joining or caseless scripts are 0.
3. Nothing turns kerning off, and no element is split into letters without kerning restored and the markup put back.
4. Every face and weight is loaded, `font-synthesis: none` is set, and a subset keeps every feature the system uses.
5. At 200%, on the real render: no two glyphs touch, word spaces are clearly wider than letter gaps, and centred tracked labels are centred.
6. With WCAG 1.4.12 spacing applied, nothing clips.

## Sources
- MDN, `letter-spacing` (non-zero spacing turns off optional ligatures; no single value suits every font; some scripts take none): https://developer.mozilla.org/en-US/docs/Web/CSS/letter-spacing
- MDN, `font-kerning` (`auto` may turn kerning off on small text) and `font-synthesis`: https://developer.mozilla.org/en-US/docs/Web/CSS/font-kerning, https://developer.mozilla.org/en-US/docs/Web/CSS/font-synthesis
- W3C, Understanding SC 1.4.12 Text Spacing (letter spacing 0.12em, word spacing 0.16em, line height 1.5, paragraph spacing 2em): https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html
- Adrian Roselli, "You Know What? Just Don't Split Words into Letters" (2026-02; screen reader results for split text): https://adrianroselli.com/2026/02/you-know-what-just-dont-split-words-into-letters.html
- Griffo docs (splitting loses pair kerning; measure first, then restore it with margins): https://www.mintlify.com/dimicx/griffo
- Typekit, "Kerning on the web" (2014; `optimizeLegibility` turns on kerning and ligatures; dated browser table): https://blog.typekit.com/2014/02/05/kerning-on-the-web/
- fontTools 4.55 `subset/__init__.py`, `_layout_features_groups` (the features `pyftsubset` keeps by default), read 2026-11-02
- CSS Working Group issue #1518, "letter-spacing should not apply to the end edge of a line": https://github.com/w3c/csswg-drafts/issues/1518
- Figma forum, "Percentage based letter spacing should convert to em value in dev mode": https://forum.figma.com/suggest-a-feature-11/percentage-based-letter-spacing-should-convert-to-em-value-in-dev-mode-41443
- House standards STD-visual-details-04 and -05 (`skills/opendesigner/references/standards/visual-details.md`), and the OpenDesigner site's headline fix (`_coordination/OWNER-FEEDBACK.md`, lesson 9 of the 2026-10 website review)
