# Preflight checklist

Run this on any video, page, deck or image before you call it done. Each line is a yes or no. The numbers in brackets point to `mistakes.md`.

## System

1. A design system exists for this artifact, made for it, not copied from one screenshot. [M1]
2. Every color, size, space, radius, shadow, easing and duration on screen comes from that system or from a written mapping of it (for example "video = tokens x 2.5"). Count the values that don't. [M2]
3. References were studied before building, and you can name what the best of them do. [M3]

## Type

4. **Mask fit.** Crop the lowest descender and the highest ascender of every masked or `overflow: hidden` line at 200%. No glyph ends in a straight cut. [M4]
5. **Tracking.** At 200% no two glyphs touch, and every word space is clearly wider than the widest letter gap. Display tracking is the system's value, usually no tighter than -0.02em. [M5]
6. **Weight.** Headings use the system's heading weight. Black (800 to 900) everywhere reads as shouting. [M5]
7. **Scale.** List every font size from the computed styles. About 8 sizes at most, all from one scale, no two within 10% of each other. [M6]
8. **Rag.** No one-word last lines, and no breaks inside a phrase, a number and its unit, or a code expression. Use `text-wrap: balance` on headings and short labels. [M7]
9. **Legibility.** Text that carries meaning meets the floor for where it is seen, multiplied out through any scaled container it sits in: 12 px on a web page (11 px only for short labels), 11 pt on a phone or tablet app, 12 pt on a watch, and about 54 px in a 1920 px video frame, which is about 11 pt once the frame is shrunk to a 390 pt phone. For video, shrink a frame to 390 px wide and read it. Never abbreviate a label the viewer needs. [M8, M31]
10. **Fonts.** Every `font-family` you use is loaded, from a file you ship or a font service link such as Google Fonts, and no fallback face renders anywhere. In the browser, `document.fonts` shows each face as loaded. For a video or an image render, ship the font file or wait for `document.fonts.ready` before the first frame. [M9]
11. **Contrast as rendered.** Wherever text sits on glass, a photo, a gradient, a texture or a drawn object, measure it against the pixels behind it, not the token colors. Hide the text, render again, and compare each line of text with the brightest (or darkest) 5% of pixels in its box. It meets 4.5:1, or 3:1 for large text. [M35]

## Layout

12. **Grid.** If a grid is visible, every content edge snaps to it. All spacing comes from one scale. [M10]
13. **Balance.** On every hold the content sits in an intended box, and no unplanned empty area is bigger than about a quarter of the frame. [M11]
14. **Variety.** No more than two scenes in a row are "N identical cards". [M12]
15. **Fit.** Nothing wraps or overflows that wasn't meant to: pills, chips, file paths and status labels stay on one line. [M13]

## Motion

16. **Freezes.** Total frozen time is under about 15% (the helper measures it). In a silent piece, no hold lasts over about 1.5 s except the end card. [M14]
17. **Cuts.** Step through every cut 0.05 s at a time. No frame shows only the background, and no remnant of the last scene peeks through. [M15]
18. **Grammar.** List each scene's entrance, main action and exit. If more than a third match, redesign. Carry at least one object across a cut. [M16]
19. **Direction.** The motion matches the words: "zoom in" moves in, "rises" moves up. [M17]
20. **Snapping.** Movement uses transforms. Animating `left`, `top`, `width`, `font-size` or `letter-spacing` snaps to whole pixels and judders. [M18]

## Truth

21. **Labels match drawings.** Count items, steps and swatches, and compare them with the number in the label. A "ramp" holds one hue. Animated values stay inside the stated range. [M19]
22. **Real artifacts.** Code, files and screenshots on screen come from the product's real output. If a format is named, its required keys are there (DTCG: `$value`, `$type`). [M20]
23. **Facts.** Check every number against the source on the day of export, including every "each", "all" and "over N". Count again after each edit. [M21]
24. **One claim, one place.** A fact stated twice is stated the same way. A contrast ratio is shown next to the exact pair it measures. [M22]
25. **Your own change can make a claim stale.** After adding or removing anything in the product (a skill, a page, a feature), search the artifact for counts and lists of that thing. [M30]
26. **Licence and naming.** Licences are stated for what they cover (code versus content), and product names are spelled the way the product spells them. [M23]

## Sound and words

27. **Narration says only the script.** Transcribe every generated voice line and compare it with the script. Text-to-speech models sometimes read the style instructions aloud. [M24]
28. **Clip edges are clean.** Listen to the first and last half second of every audio clip, or run `preflight.py audio`. No click, no burst of noise, no cut-off breath. [M34]
29. **Captions.** A video meant for phones has captions at 56 px or more, timed to the voice, one line where possible, in a band no other content enters in any act. [M25]
30. **Sync.** Every highlight, count or reveal that is tied to a spoken word takes its time from a transcript of the final audio. The last cue of each line falls inside that line's audio. [M32]
31. **Read-through.** Read all on-screen text in order. No phrase longer than three words repeats within 10 s, and parallel items use parallel grammar. [M26]

## Process

32. **The automated check passed, and you still looked.** A clean lint or contrast report is the floor, not the verdict. [M27]
33. **You looked at full size,** not only at thumbnails or contact sheets. [M28]
34. **The person's words were followed.** "Explain" means a voice or captions. "Premium" means restraint. Memory notes and preferences you already have were applied. [M29]

## Found by the owner, reviewing the website (2026-10-15)

35. **Alignment holds at every width.** Rows that wrap into a column share one centre line and the same outer edges. Sibling cards share a top edge and a height, and their header rows match. Nothing scrolls inside a card. Measure it from 320 to 1920 px; one screenshot at one width hides it. [M36]
36. **One primary action.** Each view has one primary button. Secondary actions are visibly quieter (a text link), and places already in the header, such as GitHub or the docs, are not repeated as buttons. [M37]
37. **Real names and marks.** Every invented name was web-searched and is not one letter away from a real or already-used name. A well-known tool the work names shows its own mark beside its name. Shown domains end in `.example`. [M38]
38. **Controls sit on the content.** A button pinned inside a box, such as a copy or close button, is centred on the content's first line, with equal top and side insets. The content makes room beside it, never an empty band above it. [M39]
39. **No widows.** No heading, lede or short centred line ends on a single word, at any width from 320 to 1920 px. [M40]
40. **Labels stay whole.** Chips, tags and button labels never break across lines, and never inside a word; a long file name gets a chip that may wrap on purpose. Nothing scrolls or runs under a pinned control. Check every page at phone widths, not only the landing page. [M41]
41. **Opposite actions apart.** A pair like Skip and Mark done, or Decline and Approve, sits on one row: the secondary on the left, the primary on the right, as far apart as the row allows. Never stacked. [M42]
42. **One mark per company.** In a row of tools, each company's mark appears once, and its products share it ("Claude Code / app", "ChatGPT / Codex"). [M43]

## Found by the owner, in a demo trial (2026-10-21)

43. **Good, not only correct.** It was compared, blind, with three shipped products that solve the same thing, and scored 4 or more out of 5; the report names the three. It doesn't read as a template: real data shown as data (tabular figures, a small chart where a number has a trend), a real mark or none instead of a placeholder letter, and colour that carries meaning. For a built product, the audit of the original came first. The person saw it without having to ask. [M44]
44. **One shell across pages.** The sidebar, header, content width and page padding measure the same on every page, at every width. Moving between pages, nothing but the content changes. A wide table scrolls inside its own container instead of stretching the page. Header and footer match the home page at every width (in this repo, `site/check_chrome.py`). [M45]
45. **Corners nest.** A rounded box set inside another, closer than the outer radius, has radius = outer radius - gap (within 2 px), at every width: a screen in a bezel, a card in a stage, a button in a pill. Resolve the outer value on the outer element. [M46]
46. **The preview matches the detail.** A thumbnail, card or preview shows the same view (size, theme, state) as the page it opens, and the click carries that view across. Switching views is a short crossfade, under 300 ms and ease-out, and an instant change with reduced motion. [M47]
47. **Frames fit what they hold.** A frame, stage or device wraps its content when the content is narrower than the frame's view, so nothing sits small in an empty field. Every frame on the site uses one style (one bezel, one material). [M48]

## Found by the owner, from a reference he shared (2026-10-23)

48. **Floors are not sizes.** No row, menu item or list entry is built at the accessibility minimum (24 px): rows use the control height. An icon's gap to its label is at least half the icon's size, the icon is quieter than the label, selected rows sit in from the container's edge, and the gap between groups is several times the gap between rows. In this repo, `library.py check` flags rows sized only to `--ds-size-target-min`. [M49]

## Found measuring 73 reels for Instagram (2026-10-26)

49. **Flashing.** `preflight.py video` passes the flash measure on the final file (WCAG 2.2 SC 2.3.1): nothing that changes brightness more than three times in a second covers more than 25% of a 10-degree field, and you aimed for 90% of the limit or less. A video that loops, as reels do, is measured played twice in a row (`ffmpeg -stream_loop 1 -i out.mp4 -c copy twice.mp4`). Nothing flashes in saturated red more than three times a second; the helper does not measure red, so check it by eye. [M50]

## Found by the owner, on a private B2B landing page (2026-11-05)

50. **Tracking.** Capitals are tracked open, never below zero, and tracking tightens as text gets bigger, with about four values in all. Letters split into spans for a reveal sit where the font puts them, within 0.5 px, during and after it. `review.py check` (MS-17), `preflight.py html`. [M51]
51. **Nothing drawn through text.** With the text hidden, no line art, chart or picture edge shows inside any line box, at any width. `capture.py` text-pixels pass (MS-20). [M52]
52. **Bars cover nothing for good.** No fixed or floating bar covers text that cannot scroll out from under it: pinned text, the top of the page, the end. A card that stays until the visitor acts (consent, chat, a survey) reserves its own height at the end of the page and in `scroll-padding-bottom` while it shows, so the footer clears it and Tab scrolls a focused control above it. `__od.bars()` (CV-08) and the Tab walk (IN-01). [M53, M60]
53. **One alignment per heading.** A heading and the lede, list and buttons under it share one alignment, and centred means within 2 px of the section's centre. Headings stay within two lines at every width. (MS-05, MS-18) [M54]
54. **States and controls.** No box changes height when a tab, toggle or variant changes, and every control changes something. `capture.py` toggles pass (ST-10, ST-11). [M55]
55. **Counted against caps.** About 8 font sizes in whole pixels, two typefaces, three weights, three grey text colours, three button styles with one corner shape, one filled primary per screen with a label of 15 px or more, and no font loaded that nothing draws. (MS-02, MS-08, MS-16, MS-19, EN-08) [M56]
56. **Judged at rest.** Every measurement and screenshot waits until no animation is running (`await __od.settle()`). [M57]

## Kerning and tracking, in every project (2026-11-02)

57. **Kerning kept, tracking from the system.** Nothing turns the font's kerning off (`font-kerning: none`, `"kern" 0`, `optimizeSpeed`). Every `letter-spacing` comes from a text style in em: no px, no CSS `%`, no Figma percent copied as is. Capitals are tracked positive; code, table numbers and joining or caseless scripts sit at 0. A word split into letters for motion has its kerning measured and restored and its markup put back, so the last frame equals plain text. Every weight you use is loaded and `font-synthesis: none` is set; a subset font keeps every feature the system uses. At 200%, centred tracked labels are centred, and with WCAG 1.4.12 spacing (0.12em letters) nothing clips. `preflight.py html` checks the rule-shaped parts; `references/kerning.md` has the rest. [M58]

## House colour rules (owner, 2026-11-02)

58. **Pure white or pure black, never both.** No page, screen or frame uses opaque #FFFFFF and #000000 together as surface, text, icon or border colours: pair white with an off-black such as #111111, or black with an off-white. Translucent black in shadows, scrims and masks doesn't count. Colours with a known meaning keep it: approved green, rejected red, pending amber, info blue, and a well-known app in its own colour (house standards STD-visual-details-65 and -66). [M59]

## Found reviewing opendesigner.dev with the review skill (2026-11-05)

59. **Labels keep their own style inside cards.** A rule for a card's paragraphs (`.card > p`, `.panel p`) does not also restyle the card's small uppercase label. Scope it (`:not(.kicker)`) and read the label's computed size and tracking at one width. The probe's capitals check (MS-17) flags a label that grew with negative tracking. [M61]
60. **Quiet text with a colour, never opacity.** Secondary text, counts and units use a muted colour token that passes 4.5:1 where they sit, selected states included. `opacity` on text lowers its contrast on every background it meets (DC-L19-46). The probe measures text with its opacity applied (MS-04). [M62]
61. **Touch reaches 44 px.** On touch screens every header, nav and breadcrumb link has a 44 px hit area (STD-mobile-touch-09): padding with an equal negative margin, so nothing moves, or an inset pseudo-element on a bordered button and on a link whose margin another rule sets (there, padding shifted the text; measure the text's position before and after). The probe measures the box (IN-04); confirm a pseudo-element hit area with `document.elementFromPoint` just outside the visible edge. [M63]
