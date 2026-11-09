# Silly mistakes, and how to catch them

Every entry is a mistake that really happened. Most come from the first OpenDesigner explainer video (October 2026). It passed every automated check and still looked cheap. Each entry gives what it looked like, why it happens, and the catch.

## System

**M1. No design system for the artifact.** The video copied the look of one social-preview image and invented every other value as it went. *Why:* a video or deck feels like "not a product", so nobody thinks to run the design-system step. *Catch:* before building anything visual, ask "which system is this built on?" If the answer is "none" or "that screenshot", make one first.

**M2. Values outside the system.** The video had 27 font sizes, random radii and hand-picked easing. *Why:* without tokens, every scene is decided locally. *Catch:* list the values in the source and count the ones that are not tokens or a written mapping of tokens.

**M3. No reference research.** The look was built from memory of "premium", which comes out as the average of everything, and that is AI slop. *Why:* researching feels slower than building. *Catch:* look at 5 to 10 real, shipped references first and write down what the best ones do (for example: real product UI in window chrome, lighter display weights, a lot of empty space, one accent).

## Type

**M4. Clipped descenders.** The "g" and "p" in "OpenDesigner" were cut flat by the mask used for the reveal. *Why:* a word-reveal mask with `overflow: hidden` is sized to the line box, and the line box is shorter than the descender. *Catch:* give masks about 0.24em of bottom padding (with an equal negative margin) and crop the resting frame at 200%.

**M5. Shouting type.** Weight 800 with -0.045em to -0.06em tracking made letters touch and word spaces vanish ("how it" read as "howit"). The system said weight 650 and -0.02em. *Why:* tight black type looks "designed" in a thumbnail. *Catch:* use the system's display weight and tracking, and check word spaces at 200%.

**M6. No type scale.** Sizes like 150, 168, 170, 200, 220 and 230 px were used side by side. *Catch:* pull every computed size. If there are more than about 8, or two sit within 10% of each other, snap them to the scale.

**M7. Widows and broken phrases.** "It lives inside the AI you already" left "use." alone on the next line. Card titles left "drift" alone. *Catch:* `text-wrap: balance` on headings and card titles, then reread every wrapped line.

**M8. Labels too small for the screen they are watched on.** Mono labels at 18 to 26 px became 4 to 6 px on a phone. *Why:* the author looks at a 27-inch monitor. *Catch:* shrink frames to 390 px wide and read them. On a 1920 px wide video frame, meaningful text is at least about 54 px (about 11 pt on the phone); the helper fails anything under 40 px. On screens the floors are 12 px on a web page (11 px only for short labels), 11 pt in a phone app and 12 pt on a watch (Apple HIG; Material's smallest style is 11).

**M9. Fonts that never loaded.** A mono family was named but never declared, so the renderer silently used another face. *Catch:* every `font-family` has an `@font-face` that points to a shipped file, or comes from a font service link such as Google Fonts. The helper lists the ones that don't. In the browser, check that `document.fonts` shows each face as loaded, and for a render, wait for `document.fonts.ready` before the first frame.

## Layout

**M10. A grid nothing aligns to.** A 96 px background grid was drawn, and no content edge sat on it. *Catch:* if you draw a grid, snap to it. If you don't snap, don't draw it.

**M11. Big empty areas.** A scene put four small cards in the middle of the frame and left the rest empty. *Catch:* on every hold, outline the content box. Unplanned empty space over about a quarter of the frame needs a reason.

**M12. Slide-deck grammar.** Five scenes in a row were "headline, then N identical cards". *Catch:* list the scene shapes. Carry one object through the story instead of rebuilding the frame every time.

**M13. Labels that wrap or overflow.** A status pill broke onto two lines. File paths ran past the panel edge. *Catch:* `white-space: nowrap` on pills and chips, measure the longest label, and shorten the text rather than the type size.

## Motion

**M14. Dead holds.** About 42% of the runtime was frozen frames. *Why:* scenes were timed by how long the text takes to read, with nothing moving while it is read. *Catch:* run the helper's freeze measure. Give holds a slow move, or cut them.

**M15. Blank frames and remnants at cuts.** Exits ended before the next entrance began, so a few frames showed only the background. A word swap left the tail of the previous word showing. *Catch:* step through every cut at 0.05 s.

**M16. One entrance for everything.** Every element rose 40 px and faded in. *Catch:* write the motion table, vary it on purpose, and keep one signature move.

**M17. Motion that contradicts the words.** "Zoom in" was animated as a pull back. *Catch:* read the verb on screen, then watch which way things move.

**M18. Layout tweens.** Animating `left`, `top`, `font-size` and `letter-spacing` snaps to whole pixels. *Catch:* move with `x`, `y` and `scale`.

## Truth

**M19. Labels that disagree with the drawing.** A "10-step ramp" was nine greys plus an orange. A "radius 0 to 32" panel animated to 50 px, a circle. *Catch:* count, measure, and compare with the label.

**M20. Fake real output.** A card labelled DTCG showed JSON with no `$value` or `$type`, and with token names the engine never generates. *Catch:* paste the real file, or screenshot the real page. Never type up an imitation.

**M21. Counts that drift after edits.** A label said "11 DTCG files" when the folder held 9 `.tokens.json` files. *Catch:* count with a command (`ls ... | wc -l`) right before the export, not from memory.

**M22. A claim shown next to the wrong thing.** A panel showed "white text 4.64 : 1" (the light-theme button) next to a canvas showing the dark-theme button, which uses dark text. *Catch:* every measured claim names the pair it measures and sits next to that pair.

**M23. Licence shorthand.** "MIT" on the end card, when the research and docs are CC BY 4.0. *Catch:* state what each licence covers, or say "free and open source".

## Sound and words

**M24. The voice read the directions.** A text-to-speech model spoke "Read this as the narrator of a premium product film..." before the line. *Why:* some TTS models treat any prompt text as script. *Catch:* transcribe every generated line and compare it with the script. Fix the prompt or the model, never the transcript.

**M25. An explainer with no voice and no captions.** The brief said "explaining", and the first cut was silent. *Catch:* "explain" means a narrator, captions or both. For phone viewing, captions always.

**M26. Repeated phrases.** "The AI you already use" appeared three times in 15 seconds. *Catch:* read all the on-screen text in order, out loud.

## Process

**M27. Treating "check passed" as "done".** The first video had 0 lint errors and 57/57 contrast passes, and looked cheap. *Catch:* automated checks are the floor. The full-size look and this list are the verdict.

**M28. Reviewing thumbnails.** Contact sheets at 600 px wide hid clipped letters, touching glyphs and overflow. *Catch:* review at 100%, crop type at 200%, and get a second pair of eyes (a fresh reviewer, or a subagent with no stake in the work).

**M29. Ignoring what you already know.** A stored preference said to study the reference's motion first and keep things premium and restrained. It was not applied. *Catch:* reread the person's preferences and the brief's own words before building, and again before export.

## Found by the review of the second video

**M30. Your own change made the film wrong.** The narration said "seven skills". Adding the preflight skill during the same session made it eight. *Catch:* after changing the product, search the artifact for every count and list that change touches.

**M31. Small text hiding in a scaled container.** The canvas was drawn at about half size, so text that was 32 to 50 px in its own coordinates showed as 17 to 27 px. *Catch:* multiply every size by the scale of everything it sits in before comparing it with the floor.

**M32. Highlights out of step with the voice.** Cue times were copied from a transcript of an earlier take, so the last two highlights landed after the words were said. *Catch:* transcribe the final audio and take the times from it. Check that each line's last cue falls inside that line's audio.

**M33. A rule of thumb that contradicts its own premise.** The first version of this skill said "tokens × 2.5 for phone viewing", which gives about 8 pt text on a 390 pt phone. *Catch:* when a rule exists for a reason, work the number through to that reason.

## Found by the owner, listening

**M34. White noise at the end of every voice line.** The text-to-speech API returned a whole WAV file (`audio/wav`): a header, the samples and 6,070 bytes of trailing metadata. The script decoded it as raw PCM, so the metadata played as about 0.13 s of noise after each line, plus a click at the start. Every visual check passed, because none of them listened. *Why:* the script trusted an assumed format instead of the MIME type and the file's first bytes (`RIFF`). *Catch:* decode by the container (`ffprobe` the bytes first), listen to the first and last half second of every clip, and run `preflight.py audio`.

## Found by the showcase builders

**M35. Text over glass, photos and gradients that passed every check.** In the showcase style studies (October 2026), `validate` and this helper passed text that measured 2.47:1 over the scene behind a glass panel, 4.31:1 on a clay highlight, and 1.03:1 for a graph label in a skeuomorphic panel. *Why:* the token check knows only the colors it assigned, and this helper reads CSS. Neither sees the pixels behind the text. *Catch:* hide the text, render again, and compare each line of text with the brightest (or darkest) 5% of pixels in its box. That is how the builder caught them, and all four pieces then passed.

## Found by the owner, reviewing the website (2026-10-15)

**M36. Misaligned where it should line up.** Two cards under a wider one sat 30 px off its centre line between 600 and 900 px, and a code line scrolled inside a small card. Later, three hero cards were staggered on purpose so they "rose" toward the result; the owner read the stagger as misalignment. Why it happens: the page is checked at one desktop width, and a stagger looks deliberate to the person who made it. Catch it by measuring every row's centre, edges, top and height at each width (`site/check_layout.py` does this for the OpenDesigner site), and keep sibling cards on one top edge unless the person asked for a cascade.

**M37. Three calls to action of equal weight in one row.** "Get started", "See how it works" and "View on GitHub" sat side by side as two buttons and a link. The owner called it bad UX: the eye has no first step. Why it happens: every action feels important to the builder. Catch it by naming the one action the view exists for, making only that a primary button, turning the second into a quiet text link, and moving the rest to the header or the end of the page.

**M38. Invented names that were real, or nearly.** Example names on the site and in the showcase turned out to be real products or brands in the same field (a finance tool called Ledger, an embedding tool called Orrery, a team chat called Chorus, a record label called Pomelo, a nurse-call system called Vigil) or one letter from a name already used (Tellwick and Stellwick). Why it happens: a pleasant word feels invented. Catch it with a web search for every name and a check against the project's name registry before the name is rendered. In this repo, `python3 brand/tools/check_names.py <page or folder>` lists the names on a page that another piece already uses or that sit one or two letters from one, and the new names to search; it never searches the web for you.

**M39. A copy button floating above the code.** Every code block on the site reserved a 48 px band at its top for the Copy button, so the button floated in empty space, out of line with the code. The owner said it "feels out of place". Why it happens: room was made for the control instead of lining the control up with the content. Catch it by measuring the control's centre against the first line's centre, and its top inset against its side inset (`site/check_layout.py`, check 8).

**M40. One word alone on the last line.** The closing card's lede ended with "it." by itself, and a docs heading broke at a hyphen ("design- / system teams"). Why it happens: a fixed max-width with centred text, and no rule for how lines wrap. Catch it with `text-wrap: balance` on headings and short centred lines, `pretty` on paragraphs, non-breaking hyphens in headings, and the widow check (`site/check_layout.py`, check 9).

**M41. Phone widths broke what desktop hid.** On the owner's phone, a long command scrolled under the Copy button, a "Default" chip broke into "Defaul / t", a status tag squeezed into three lines and inline code paths split oddly in a list. Why it happens: the phone review covered the landing page while the internal pages went unchecked, and one figure's fix (chips that may wrap anywhere) broke another. Catch it by checking every page at 320, 375, 390 and 430 px with a phone profile, and with checks 11 and 12 (`site/check_layout.py`).

**M42. Opposite actions stacked, and close together.** On a phone, "Skip today" wrapped above "Mark today done". The owner's rule: the secondary sits on the left and the primary on the right, as far apart as the row allows, so the wrong one is hard to hit. Catch it with check 13 (`site/check_layout.py`).

**M43. The same mark twice.** The "works in" row showed Claude's mark for Claude Code and again for the Claude app, and OpenAI's for ChatGPT and again for Codex. Show each company once and let its products share the label.

## Found by the owner, in a demo trial (2026-10-21)

**M44. Correct, and still a template.** In a demo trial, OpenDesigner redesigned a messy freight console. The run built a token system, rewrote all three pages, passed `engine.py review` and every width check, and reported done. The owner, playing the client, called it "an admin template": a muted colour, plain number boxes, no charts, a placeholder "B" logo, dark mode for an industry that works in light, and he had to ask to see it. Why it happens: the checks an agent can run measure consistency, so a clean result feels finished; the comparison with shipped work was a rule in a reference file but not in the step the agent runs at the end; and an existing product was rebuilt without auditing it first. Catch it with the "correct is not finished" step in the `opendesigner` skill: open the result for the person, compare it blind with three shipped products (`making.md` section 5), and report the score.

**M45. The layout jumps between pages.** In the same trial, the dashboard and settings pages shared one layout, but on the shipments page "everything changes": its wide table widened the content and moved the sections. The owner: "Please do not do mistakes like these." Why it happens: each page is checked on its own, never one after another. Catch it by measuring the shell (sidebar, header, content column) on every page at each width and comparing the boxes. Put wide content in its own scroll container.

**M46. Corners that don't nest.** On the OpenDesigner site and in the component library, photo stages, phone frames and screens each had their own radius, so the inner curve bulged against the outer one or left a thick, uneven ring. The owner sent crops of several and said "this issue is everywhere, fix it everywhere". Why it happens: each box takes a radius token on its own, with no thought for the box around it. Catch it by computing inner radius = outer radius - gap for every rounded box inside another (closer than the outer radius), at each width. In this repo `site/check_layout.py` check 14 (`nested-radius`) measures it.

**M47. The preview and the detail disagree.** Library cards showed each component at desktop size, but opening one showed it at phone size. The owner: "this is not fair, it should show the same inside that it shows outside". Why it happens: the card and the detail page are built separately, each with its own default. Catch it by opening every preview and comparing the view it lands on with the one it showed.

**M48. A small thing in a big frame, and two frame styles.** A narrow component sat small in the middle of a wide stage ("why is the container so wide even when the component is so small"), and cards used a frosted-glass bezel while detail pages used a black device bezel ("outside it is glassmorphism, inside it is black"). Catch it by sizing every frame to its content's natural width, up to the frame's view, and by using one frame style throughout.

## Found by the owner, from a reference he shared (2026-10-23)

**M49. Built at the minimum.** The component library's sidebar measured 24 px rows (the accessibility floor) with a 6 px gap between icon and label. The owner shared a before-and-after (Michael Filipiuk, "Cleaning up a slop sidebar", X, 2026-10-22) that fixed the same kind of sidebar with six changes: softer container corners, rows inset 8 px from the edge, icons smaller than their labels, a 10 px icon-to-label gap, 32 px rows and 20 px between groups. Why it happens: the floors are the numbers an agent can check, so they become the numbers it builds to. Catch it by measuring row height, icon-to-label gap and group spacing on every list, and comparing each with the control-height and spacing tokens, not with the floor. In this repo, `library.py check` flags rows sized only to `--ds-size-target-min`; the library's sidebar now uses the control height (32 px dense) and an 8 px gap.

## Found measuring 73 reels for Instagram (2026-10-26)

**M50. Flashing that no single frame shows.** When 73 design reels were measured against WCAG 2.2's general flash threshold, 8 were over it. The causes were a generated clay character shaking (one shot measured 175% of the limit), a paragraph re-wrapping on every frame, fast crossfades, a halftone drawing sliding past, cut-out characters sliding in stop-motion steps, and a 940 px slide of a page of text. Every frame looked fine at full size. *Why:* reviews look at frames, and a flash lives between them. Generated clips jitter. Text that changes every frame (re-wrapping, counters, rotating words), and high-contrast text or line art that moves fast, flip thousands of pixels between light and dark several times a second. *Catch:* run `preflight.py video` on the final file, and add `--flash-where worst.png` to see what flashes. Fixes that worked: blending each frame with its neighbours only during a shake (175% down to 86%), slow even fades instead of quick ones, a short drift and a crossfade instead of a fast slide, and smaller changing text (a card whose rule text changes every frame went from 100% to 68% when that text went from 60 px to 50 px).

## Found by the owner, on a private B2B landing page (2026-11-05)

The project hand-wrote eleven check scripts for what the review missed, over about 25 drafts.

**M51. Tight capitals and lost kerning.** Uppercase labels were tracked at -0.03em, 21 letter-spacing values were in use, and a heading reveal split every letter into its own span, so pairs like "To" lost their kerning and the letters jumped when the plain text came back. Asked to "please check kerning", the agent answered without measuring. *Catch:* MS-17: `review.py check` reads tracking per size from the probe, `__od.kern()` measures split letters against the same text unsplit.

**M52. Line art through the text.** "I see overlapping text with line art." Box overlap said nothing: the drawing's box covered the whole hero either way. *Catch:* hide the text, screenshot, and look for art pixels inside each line box (`capture.py`, MS-20).

**M53. A floating bar over pinned text.** A bottom bar covered a caption inside a pinned scene, and the last line of the page. *Catch:* `__od.bars()` scrolls and lists only text that can never get out from under a bar (CV-08).

**M54. Centre and left in one section.** "CENTRE ALIGN ALL", nine times: centred headings over left-aligned ledes, lists and buttons, a heading a few pixels off centre, and a hero title on four lines at phone width. *Catch:* MS-05 and MS-18 from the probe, at every width.

**M55. Boxes that jump, and controls that do nothing.** Cards grew when a toggle switched, and some Options rows changed no pixel. *Catch:* click every option, measure heights, compare the section before and after (ST-10, ST-11).

**M56. Too many of everything.** About 50 font sizes, five loaded font families, "too many shades of grey" three times, and three filled calls to action in the first screen with a 13 px label. *Catch:* the counts in `review.py check` (MS-02, MS-08, MS-16, MS-19, EN-08).

**M57. Judged mid-animation.** Screenshots from a background browser pane caught reveals half done and looked broken. *Catch:* `await __od.settle()` before every probe and screenshot; `capture.py` waits on every load and scroll step (TM-01).

## Kerning and tracking, in every project (2026-11-02)

**M58. Kerning lost, tracking copied.** The same few type faults came back across the website, the videos and client pages. The owner asked for "iOS kerning everywhere" on the site; a headline animation split into letters dropped the font's kerning until each pair was measured and given back (`site/static/site.js`); a video tracked heavy display type so tight that "how it" read "howit" (M5). *Why it happens:* tracking is copied from a mock as a literal (Figma's -2% written as `-2%` or `-2px`), set once for every size, set on capitals the same as on lowercase, or broken by a letter-splitting animation, a missing weight, a fallback face or a subset font. None of it shows in a thumbnail. *Catch:* `preflight.py html` flags kerning switched off, px and % tracking, values of 0.5em or more on mixed case, capitals at 0 or less, and letters split into spans without kerning restored. Then read `references/kerning.md` and crop the type at 200%.

## House colour rules (owner, 2026-11-02)

**M59. Pure white beside pure black, and meanings in the wrong colour.** On a client landing page, a red brand button sat beside a red "rejected" state and Teams appeared in orange, and the owner asked for known colours "across whatever projects we are working". He then set a rule for every project: a product that uses pure white never also uses pure black, and the reverse. *Why it happens:* #fff and #000 are the defaults every tool reaches for, and an accent gets reused wherever a colour is needed. *Catch:* `preflight.py html` warns when one page uses both; `engine.py validate` fails a theme whose role colours use both, and `engine.py review` reports code that does.

## Found reviewing opendesigner.dev with the review skill (2026-11-05)

**M60. A consent card over the footer and the focus.** The site's consent card sat over the last footer line on every page, and Tab moved focus to links fully under it, on a visitor's first visit until they chose. The card was a quiet corner card, so nobody looked under it. *Catch:* `__od.bars()` (CV-08) and the Tab walk (IN-01); while the card shows, give the page its height as `padding-bottom` and `scroll-padding-bottom`.

**M61. A label that turned into body text.** On the booking page, `.book-card > p` (16 px, -0.02em) also matched the card's `p.kicker`, so "Free · 20 minutes · Google Meet" rendered as 16 px capitals with negative tracking; the tour page's `.tr-trace p` did the same to its kicker. Each rule was right for the paragraphs it was written for. *Catch:* MS-17 in `review.py check`; scope paragraph rules away from labels.

**M62. Quieted with opacity.** The device-width numbers on every component page ("Desktop 1280") were set at `opacity: .7`; on the selected tab's tint the number fell to 3.95:1 at 12 px, while the token pair underneath passed at 7.44:1. *Catch:* MS-04 measures the composited colour; use the muted ink instead.

**M63. Links as tall as their text.** On phones the logo and nav links were 22 px tall and the breadcrumb links 18 px, in a 60 px header with room to spare. *Catch:* IN-04 on a phone profile.
