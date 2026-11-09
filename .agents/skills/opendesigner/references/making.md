# Making and reviewing pages with the system

How to build a page, a screen or a section once the design system exists, and how to go round after round with the person who decides. Read it before you build anything a person will look at, and again each time they give feedback on what you built.

Sources: `research/L22-making-and-review.md` (one marketing-site build; reference material, one project's evidence), the house standards in `standards/process-review-taste.md`, and the cards named in each section. Nothing here sets a token value or changes a default.

## 1. Before you build
- **Know the job.** Write one line: who the page is for, and what they should do or believe when they reach the end. Judge every option against that line, not against looks alone.
- **Lock what exists.** Copy the person's existing words exactly, with where each came from and the date. Mark new text as new. Never mix invented text into a record of what exists (`guardrails.md` section 5).
- **Use their real assets,** or ask for them (`hooks.md`). A stand-in is never shown as finished.
- **Look at shipped work before you invent.** First name the analogous product, the one that already solved this interface problem in any market (`practices.md` section 3), and start from how it works. Then, for each part of the page, find how shipped products solve it, starting from the person's own references. List the pages you want to open and get a yes first (`guardrails.md` section 2). DC-L19-178 asks for this before a flow with domain rules; for a page section it is a habit that paid off in the source project. Take structure and quality, never identity (`guardrails.md` section 1). In the source project, whole rounds of the builder's own options were removed, and the pages the owner kept working on were built on rebuilds of shipped sections (DC-L22-01).
- **Samples first, then a pick, then the build** (owner, asked three times in one project, 2026-11-03: "Why are you not using Mobbin to benchmark other websites ... and then build?"). Before any new direction, and before any figure or interaction you would otherwise invent, show the person a board of shipped samples: about 10 to 60 screens or sections from Mobbin when it is connected, or from the web, grouped into possible directions, each linked to its source with an "I like this" tick and a copyable list of picks. Build only from what they tick. Read the ticks, and what they left out, as taste evidence (`taste.md`). In that project the owner ticked 24 samples across all four directions, which a "pick one direction" question would have hidden.
- **Measure a reference live, never from a thumbnail** (owner, 2026-11-03: "why are you not able to grasp and extract the taste index properly?"). Before you build from a reference, open the live page and read its computed styles with opendesigner-extract (`read_page.js`): type sizes, spacing, motion, effects, and any option inside it the person named. Write the values in a research note and build from those. Variants built from Mobbin thumbnails copied layouts and lost what made the references good: real video and canvas motion, very large type, product screens with depth, choreographed reveals.
- **A reference gives principles, never its page** (owner, 2026-11-03: "Why have you copied [the reference] exactly? This is the worst thing you could have done"). When the person points at a site for direction, take its rhythm, its quality bar and how its figures behave. Never take its hero, its section order, its card system or a signature device (edge ruler ticks, bracket indices, a crop style): one of those alone made a whole page read as a copy. Combine at least three references. Inheriting a parent brand's system means its materials (tokens, grid, type, motion components), not its compositions. The only exception is a section the person asks you to rebuild as "our version of this" (section 4), or a Taste Index they chose (`guardrails.md` section 1).
- **Write the content core before the first draft.** List every point the brief or source document makes (the problem, who it is for, what each part does, why it is safe, the proof) in `opendesigner/content-core.md`, and check the page against it before every showing. "Less text" means fewer words in each block, never fewer facts (owner, 2026-11-03: the page lost "the substance that built trust" when the supporting text went).
- **A page that persuades gets a motion plan before the first draft:** the reveal system, one signature moment and one sequence that explains the product. A static draft that passes every check still reads as "dead" and machine-made. Keep it calm: smooth scrolling is a taste call to ask about, never a default, and a call to action never moves on hover (section 11).
- **Audit a built product before you redesign it.** When the product already exists, its problems are the brief. Read the front-end code, then review the rendered pages (opendesigner-review). Show the findings marked on the page, each with what fixing it gives the person (`review.py compare` draws the before, the marked-up audit and the after). Then propose the smallest change that fixes the most, build it on one page, and show it before you rebuild the rest. In a demo trial (2026-10-21), a run that skipped the audit and rebuilt all three pages at once came back clean and correct, and the owner still called it "an admin template".
- **Agree the pace, once.** Some people approve a plan step by step. Others decide by looking at a built draft. Ask which they want. A draft first is fine. Sections 2 to 10 are what keep a draft honest (DC-L22-01).
- **Build the first draft on the tokens.** A draft may come before the deeper questions, never before the token build. Run the sketch (`zoom.md`, level 0), or read their existing product with opendesigner-extract. Then make the draft read its values from that build's export, and never give it a style file of its own. In the source project a sketch build existed from the first day and the draft was never bound to it. Values lived in three separate style kits, and one page ended with seven type families.
- **Keep the tokens in charge.** When `engine.py review` says tokens are not in charge, or the system is behind the code, fix that before the next draft (owner, 2026-11-05).
- **Fix the page's materials before the second section is built** (section 4).

## 2. One round
Follow this order every time the person asks for something on a built page.
1. **Say it back in one line.** Read `opendesigner/RULES.md`, `decisions.md` and the Answered table in `PROTOCOL.md` before you ask anything: it may already be decided.
2. **Find every place it applies** (DC-L22-08). A note on one card, one screen or one section is a note on every one of the same kind, and on nothing of another kind. Say in one line what you will apply it to, and list the places before you edit. When the kind can be counted (bare color markers, a heading style, a corner), count it before and after. A change to something that several pages show goes to all of them in the same round. Before you call the round done, name any page that still shows the old version.
3. **Change only what was asked.** Add no element, and restyle no approved work, as a side effect. An option or a dial never changes what the person has settled: their fonts, their palette, their corners. Open a dial only for something they opened up (owner, 2026-11-03: "I never asked you to change the font. All the font should be same"). A restyle is not a resize. A new color, typeface or corner does not change a size, a gap or a structure. Compare sizes with the version before.
4. **Take every value from the system.** Colors, sizes, corners, shadows and durations come from the tokens. If the round needs a value the system lacks, add it as a decision (opendesigner-extend, section 4) or list it as debt (section 9).
5. **Check it as rendered** (section 5), and run the checks: `engine.py review`, opendesigner-review on each changed page, opendesigner-preflight before any share.
6. **Show it without being asked:** screenshots at desktop and phone (or an artifact), next to what was there before (section 3), with each check and its result. Never only a local URL.
7. **Record the decision in their words,** and the note: `engine.py feedback "<the rule>" --kind note`. Then remove the options it settled.

**Ask, or act?** Act on what follows from the request, and report it. Ask only at a real fork, with your pick and a visible alternative. Keep waiting decisions in one numbered list under Open items in `opendesigner/decisions.md`, and ask one per message, the one that blocks the most (`rules.md` section 1): a question that is only logged never closes.

**What they say, and what they pick.** A stated preference is something to test. Build the smallest real version, keep the version before one switch away, and record the choice only after they have seen it on the page (DC-L22-01).

## 3. Showing options on a built page
The house standards already say how options are built and compared: STD-process-review-taste-37 to -49. They are written for prototypes of one piece of interface. Follow them for any option on a built page:
- Name each option by what it explores (-37). Build three by default and five at most (-38).
- Every option fully works, with realistic, product-shaped content (-40).
- Options live on a review route or page of their own, never in the live product (-41).
- Show one at a time, full size, with the rest of the page around it (-43). A small map or a thumbnail is not enough to decide from.
- Flip through every option yourself first (-47). Say when each is the right choice and what it costs, and don't pick for them (-48).
- When they pick, build only that one into the product (-49).
- **Use the ready-made picker:** `assets/picker.js` is the house picker built to that spec, with its keys, its `?v=` address and its re-mount on every switch. Put each option in a `<template data-od-variant="Name">` inside one `<div data-od-stage>` on the review copy, keep the current version as the first option, and add the script. Add `data-od-motion` to an option with an entrance worth replaying, and `data-od-position="top"` on the stage when an option fills the bottom centre. Never restyle the picker.
- **A fix that changes structure is a choice, not a fix** (owner, 2026-10-21). A wrong color, size or corner can be fixed with the token. Merging two parts that show the same number, reordering a section or a new layout (cards, one chart, a bento grid) can be done several good ways: show two or three small directions of just that part on a review copy, with the current version kept, each named by what it changes, and build only the one they pick. Keep each direction small: only the part that changes, the rest of the page as it is.
- **To show what a fix gives,** use the review skill's before and after: `review.py compare` draws the audit on the page today and puts the fix beside it, each fix with what it makes better (`opendesigner-review` SKILL.md section 7).
- **Say where each option or fix comes from, and ask the same question every time** (owner, 2026-11-02). Every option or fix you show on a built page names its source in one line: a house standard, a WCAG criterion, a preflight check, a row of this file, a review case, the shipped product it follows, or "my own idea". The sources and how strong each is are in `audit.md` section 2. In `review.py compare`, put it in each mark's `source`. Then end with "Keep the fix, keep today's, or try another?"

What one project adds (DC-L22-02):
- **Keep the current version as an option,** with a plain name such as "Today". People judge each new option against it. You test against it too (section 5).
- **One piece at a time is still the rule (-42).** When the person asks to judge several things together, such as type, corners and one section's layout, that is a request to step outside a house standard: say so once and record it first (`guardrails.md` section 4b). Then give each question its own switch with a plain name. Each switch remembers its state and has an address in the URL, so a combination can be shared and tested. Keep the count low: every switch multiplies the combinations you must check.
- **The controls never cover the page.** Keep the picker exactly as its spec gives it (-45). The spec has no way to fold the controls away yet (lane L22, Part D3). If the person asks for one, that is also a request to change a standard: record it first (`guardrails.md` section 4b).
- **Boil down after every decision.** Remove the switch, keep the choice, record it. Ask once, early, whether earlier options should stay reachable; some people want to go back to them.
- **Never remove an option the person has not ruled out.**
- **Directions differ in structure, not palette.** Directions that only swap the accent or the wordmark face read as one design (owner and a fresh-eyes review, 2026-11-03). Each direction changes at least the ground (light or dark), the layout of the lead section, the imagery and its grade, and the motion, while everything the person has settled stays fixed (section 2). When the reference itself offers modes or options, offer those before inventing systems of your own.
- **A section made for a light background is not a dark section with the colors swapped.** Design the dark one as its own option, or keep the section light.

## 4. One page, not several
Sections may differ in layout (DC-L19-50). They may not differ in materials. Decide these once, record them, and hold them in every section (DC-L22-03):
- the type families, and the job of each: headings, text, small labels, with their tracking taken from the text styles in em (`opendesigner-preflight/references/kerning.md`);
- one heading style: size, weight, case, and when a heading is centered;
- which corner rule belongs to which kind of thing;
- how a box is drawn: its edge, its fill and its shadow;
- where content starts and ends on a wide screen;
- one dark text color and one accent;
- how photographs are treated;
- how a section that steps is controlled.

When a reference inspires a section, take its lessons by default. Only when the person asks for their own version of it (opendesigner-extract calls this "our version of this") may you first rebuild its structure closely, with the person's own words and assets, on a review page that never ships, to judge the idea. Take nothing of the reference's identity (`guardrails.md` section 1). Once the person picks it, rebuild it in these materials before anything else is built onto it. In the source project, several rounds each built one section to a strong reference and kept much of that reference's look: its small type, its corners or its boxes. After a few rounds one page held four design languages and seven type families.

**When the person says the page does not hang together,** or calls a section "bland" or "different", don't restyle by eye. Run the cohesion audit first. Copy `assets/output/COHESION-AUDIT.md` to `opendesigner/COHESION-AUDIT.md` and fill it in:
1. Number the sections, and read the numbering back with the person's own words beside each.
2. Ask the same eight questions of every section, measured on the rendered page: background, heading, small type, corners, how a box is drawn, content edges, things to look at, movement.
3. Read down each column. Where the answers change from row to row, write a finding with its proof: counts and values, not adjectives.
4. Match each complaint to its causes. "Bland" is often contrast with a busier neighbor, and only partly a fault inside the section.
5. Offer directions: the least effort (line up the seams only), the most adaptable (one set of materials every section can take), and one or two led by a section they already like. Say what each changes, keeps and costs.
6. Change nothing while you audit. Build the directions they choose as options (section 3).
7. If a measurement shows that something you said earlier was wrong, say so in the report.

## 5. Check it as rendered
`engine.py review` reads values in code. It cannot see the page (DC-L22-05, DC-L19-167). Before you show anything:
- **Look at it.** Take a screenshot of every section you changed and read it, at each size you support. Fix what is broken before the person sees it.
- **Match the person's own window.** Ask once what they review in: which browser, how wide the window is, any zoom. Test at that size in your own test window, as well as at the usual sizes (DC-L19-56).
- **Test between the breakpoints.** A rule written for tablets can squeeze a layout at a width nobody opened.
- **Check symmetry where a row stacks.** When cards in a row wrap into a column, every row should share one centre line and the same outer edges, and nothing inside a card should scroll. Measure it at each width, because a screenshot at one size hides it (review case MS-05).
- **Test without hover.** Anything that changes on hover must also change another way: by itself on a timer, or on a tap (DC-L19-143). Hover styles themselves sit behind a fine-pointer query (STD-accessibility-motion-15).
- **Measure text as rendered** wherever something is scaled down. A screen shown at reduced scale can pass every type check while its text renders at 8 to 10 px.
- **Measure contrast against the pixels behind the text** wherever text sits on glass, a photo, a gradient, a texture or a drawn object. The token check only knows the colors it assigned, so it passes text that fails on screen. Hide the text, render again, and compare each line of text with the brightest (or darkest) 5% of pixels in its box. In the showcase's style studies, the token checks passed 21 such failures, the worst at 2.47:1; this check caught every one.
- **Compare with the version before** for everything you did not mean to change. Compare computed styles or screenshots, section by section.
- **Emulation is not a device** (STD-process-review-taste-33). When the person reports a fault you cannot reproduce, say so, say what you tried, remove every difference your change introduced, and ask them to look again. Never report it as fixed.
- **Wait for reveals before you judge a screenshot.** A tab in the background pauses `IntersectionObserver` and Web Animations, so headings caught mid-reveal look blurred or empty. Check `document.getAnimations()` or the revealed state, in the visible tab, before you call it a bug.
- **Measure every figure and small part with a script at every width,** not by screenshot: overflow, overlapping text, truncation, text under 11 px, targets under 24 px, row heights, and whether labels share one style. Include in-between widths (600, 900). In one project a script at nine widths caught labels colliding at 320 px that screenshots missed.
- **Ask before you record the screen to check motion, and record only your test window.** A recording of a screen region can catch the person's other windows.

Then tell the person what you checked and what you could not (`guardrails.md` section 5).

**Have fresh eyes read it before the person does.** Ask a reviewer that did not build it (a fresh-context agent, or a person) to read the render and the copy, and to check facts that are easy to get wrong: a weekday against its date, totals that should add up, a step that happens before the approval it needs, a column header that overflows. In the showcase rebuilds, a fresh-context check found two wrong weekdays, a logic error and two name collisions that three rounds of self-review had missed. Later independent audits found six more weekdays taken from the wrong year's calendar, sums that did not add up, a queue that could not drain in the time shown, and three invented names that belong to real products. Work out every weekday from its date with a calendar or a script, and re-add every total from the page itself.

**Correct is not finished.** `engine.py review`, `validate` and every width check prove the work is consistent. They say nothing about whether it is good. The comparison below is the step that does, so it is never skipped, and the report says its score or says it was not done. In the same trial, a run passed every code and layout check, reported itself done, and the owner's first notes were that the colour was "very muted", there were "no graphs or visual elements", and he had to ask to see it.

**Compare it with shipped work at the same size.** Before you show a page, a screen or a section, put it next to three shipped products that solve the same thing, at the same width, and score it 1 to 5: 5 passes as a real company's work, 3 is competent but conventional, 1 is slop. Below 4, fix it or rebuild it before anyone sees it, using section 11. Say the score and the three references in your report. A score from an AI reviewer, yours or a fresh one, can only rule work out; it never approves it. In the showcase, independent AI audits scored 4 for two heroes the owner called "very ugly", and he removed four heroes the audits had kept. Show the person, record their verdict in their words, and let it outrank every score.

**Make the comparison blind.** A reviewer who knows which side is yours scores it kindly. Put your render and a shipped screen of the same kind side by side, at the same height, with no labels and the sides in random order, and ask a fresh reviewer which looks like a premium shipped product, by how much (1 to 5), and what makes the weaker one look cheaper. Do this against three references. It is not done while yours loses clearly (by 3 or more) to any of them, or loses to more than one. Keep the reference images out of the repo and delete them after. Name the files neutrally (a judge who reads "mobbin" in a file name knows which side is yours), and tell the judge to weigh craft, not content: many library screenshots show demo accounts or blurred numbers, so a page full of specific data can win on content alone. A blind win is necessary, not sufficient; in round 4, ten pieces won blind and still stalled at 3 with a fresh reviewer. The owner called components and an app screen "rubbish" that AI audits had scored 4 out of 5 (2026-10-15).

## 6. Finished interface inside a page
A product screen on a marketing page, or a live demo in documentation, is a finished design inside another one (DC-L22-04).
- **Keep the two style worlds apart.** A page rule aimed at a bare element or attribute, such as every `svg` or every `[stroke]`, reaches into the embedded interface. Scope page rules so they stop at its edge.
- **Give every class inside the embed its own prefix,** state classes included. A short name such as `on` or `live` will match a page rule with the same name, and nothing reports it.
- **Write the embed's resets so each weighs one element.** Wrap only the scoping part of the selector in `:where(...)`. The reset then weighs the same as a page rule on a bare element, so it wins only when the embed's styles load after the page's. It still loses to the embed's own classes, and to a page rule aimed at an attribute or a class, which is why those are scoped (first point).
- **After any page-wide restyle, compare the embed with the version before.** Count something cheap, such as icon colors per screen or the computed typefaces.
- **Embed the real thing, live** (owner, 2026-10-21). A product demo inside a page is its own HTML, animated in code: never a video, and never a screenshot with marks drawn on it. A declarative shadow root (`<template shadowrootmode="open">`) keeps the two style worlds apart with no prefixes; turn its headings and landmarks into plain boxes and take its controls out of the tab order, since it is a picture of a page. Measure any box you draw on it on the page as drawn. To show someone the motion, send the live page, not a recording.
- **Design it at real size and show it scaled, like a screenshot.** Decide which parts must stay readable (the title, the key figures, the main action) and measure them as rendered.
- **On a small screen, show part of it at a readable size and move the view.** Don't shrink the whole screen.
- **Sample content is realistic** (DC-L19-35). On a public page, use made-up names for companies and people. Spread the examples across the kinds of customer the product serves.
- **One product on several screens shares one data file.** When the same product appears on a phone, a laptop and a mockup, keep its names, amounts and dates in one file that every screen reads, and re-render every screen when it changes. In the showcase, a laptop mockup copied a phone screen's data, and the phone changed twice while the mockup was being built.
- **Load each embed when it is needed,** and paint only the one that shows.

## 7. Sections that hold the page, and movement
A section that stays in place while its steps play spends the reader's scroll (DC-L22-06, DC-L19-84).
- **Add up the scroll.** For each held section, work out its share of the page's whole scroll, and say it in your report. In the source project, two held sections took 61% of the page's scroll, and the owner agreed to shorten both once the share was shown.
- **One control for every section that steps.** Two sections that behave alike and look different read as two products.
- **Decide what moves it on:** scroll, a clock, or either. On a clock, wait while the section is out of view, stop when the person takes over, and show every step without movement when reduced motion is on.
- **Drive movement by time, not by frames.** A step taken once per frame runs faster on a faster screen.
- **Fade the new layer in over the old one, which stays put until the fade ends.** When both fade at once, the page shows through halfway.
- **Move fine patterns by whole device pixels, or keep them still.** Dither, halftone and hairline grids shimmer when they move by part of a pixel.
- **Several moving things in one section share a manner and differ in what they do.** Six drawings that all fill from left to right read as one template. Let each build in the way that explains its own figure.

## 8. Figures drawn as graphics
A drawing beside a number is a claim (DC-L22-07).
- **Draw only what the words state.** No invented axes, series, scales or trends. If the copy says every order is tracked, draw every order tracked, and nothing more.
- **Use the product's own chart language** when the page also shows product screens. A generic infographic beside real screens looks cheaper than either.
- **Put a set of cards on one grid.** Columns start and end on the same lines, even when the cards differ in height.
- **Keep labels at reading size.** A scale nobody can read is decoration.
- **On a small screen, keep two cards in a row while they stay readable.** One very wide card per row makes a long, thin page.
- **Find shipped figures before you draw one** (the samples step in section 1). Charts drawn from default shapes (rounded bars, plain lines, floating tooltips) were called "very, very, very cheap" next to considered infographic work.
- **One figure system for the whole page:** one anatomy (a head with a label and one key value, the figure, a scale or legend, a readout line), fixed rows so every figure is the same height at every width, one container surface, one stroke weight, one accent per figure, and two text roles only (a small label and a data value). A scale is stated ("■ = $80,000"). In one project six figures had four small-label styles and per-card photo backgrounds, which read as "six different products".
- **A readout line beats floating tooltips.** One line under the figure that updates on hover, focus or tap never clips at a screen edge and works the same on touch. Floating tooltips clipped on 8 of 14 marks at 375 px.
- **Size a figure by its frame,** with container queries, not media queries: a tile in a three-column grid at 1024 px is narrower than a phone.

## 9. Debt, and when it is done
- **Keep a debt list as you go:** every value that did not come from the system, every option still switched on, every check you could not run.
- **A page is done when the list is empty or the person has accepted what is left,** and the checks ran and were shown (section 2). Run `engine.py review`, then ask the eight cohesion questions (section 4) one more time.
- **Record what any product would need for OpenDesigner** with `engine.py feedback` (`improve.md`). Write it about the method, never about the person's product. Nothing is posted without the person's OK.

## 10. Mistakes builders make, and what a repeated note means
These are mistakes an AI builder made in the source project (DC-L22-09). Most drew a correction from the owner, and several came back more than once. Check your own work against this list before you show anything.

| The mistake | What it looks like | Do this instead |
|---|---|---|
| Doubling down | The person likes one option and asks for more. You make variations of that one | "More" means new ideas at the same level. Keep the liked one untouched, and show others that work in a different way. Say in one line how you read the request |
| Reaching for what is at hand | Asked for something new, you reuse the same picture, asset or style | New means new material. Say what is new about each option |
| Fixing only where they pointed | The same note comes back for the next card, page or screen | Every instance of the same kind, counted (section 2) |
| Fixing everything that looks alike | A note about one kind of thing changes other kinds (2026-11-03: black-and-white photos asked for as card backgrounds were also put on the hero) | The thing named and its true siblings, and nothing else |
| Taking a word to its extreme | "Lighter" becomes all white. "Sharp" becomes square. "Faster" becomes rushed. "Obvious" becomes a banner | A preference is a direction, not an absolute. Move one step that way and show it |
| Inventing first, or following a reference loosely | You design options from your own idea of the problem, or draw something loosely "after" a reference, even after being told to study shipped work | Study shipped examples first, as a board the person picks from (section 1). Only when the person asks for their own version of one named section, rebuild its structure closely (section 4); a reference named for direction gives principles, never its page. A method the person names holds for the next section too |
| Forgetting what was already said | A rule from an early round is broken on a page built later | Standing rules live in `opendesigner/RULES.md` and the project standards. Read them before each new piece |
| Adding what nobody asked for | A new button, a label, a disclaimer, a tint | Add nothing as a side effect. Offer it in one line instead |
| Staggering what should line up | Cards in a row start at different heights to look dynamic, or stacked cards sit off the centre line at some widths | Sibling cards share a top edge, a height and header rows; stacked rows share one centre line. Measure at every width (preflight 35) |
| Three calls to action of equal weight | Two buttons and a link side by side in the hero | One primary button for the one action the view exists for, one quiet text link, the rest in the header (preflight 36) |
| Selling the mechanism first | The headline names files, tokens or features before what the person gets | Lead with the outcome (a product that looks like it belongs together), then show how |
| Names that only feel invented | A brand name turns out to be a real product in the same field, or one letter from a name already used | Web-search every name and check the project's name registry before it is rendered (preflight 37) |
| Reserving a band for a control | A copy or close button floats in empty padding above the content | Centre it on the content's first line with equal top and side insets, and make room beside the text (preflight 38) |
| Widows and broken labels | A last line with one word; a chip split inside a word; text running under a pinned button on a phone | Balance headings, keep labels on one line, make room beside pinned controls, and check every page at phone widths (preflight 39, 40) |
| Opposite actions side by side, or stacked | Skip above Mark done on a phone, or Decline next to Approve | One row, secondary left, primary right, as far apart as the row allows (preflight 41) |
| Plain names where a mark is expected | Well-known tools listed as text in a "works with" row | Show each tool's own mark beside its name, monochrome; never put real marks on invented brands |
| Changing what was approved or protected | A page-wide pass restyles something they were happy with | Approved work is frozen. Compare it with the version before (section 5) |
| Growing with each pass | Type, cards and detail get bigger or busier every round | A restyle is not a resize. When something is cluttered, take things out |
| A timid fix | The change is so small that the note comes back | Make the change clearly visible, on every instance |
| Asking what follows | You ask whether a rule applies to the next page | Act and report. Ask only at a real fork |
| Showing unseen work | You show something you never looked at as rendered | Section 5 |
| Arguing from analysis | You defend a choice with a measurement while the person is judging by eye | Measure faults and whether rules were kept. For taste, show two versions. An accessibility floor is not taste: keep the version that meets it, say so in one line, and offer the nearest version that passes (`guardrails.md` section 4) |
| Fixing a different fault | You fix something real that is not what they meant, and call it done | Say back what you think they saw, and where. If you cannot see it, say so |
| Bringing a reference's style in with its structure | A rebuilt section arrives with the reference's type and corners | Rebuild it in the page's materials (section 4) |
| Stating what you did not check | You say two things match, or that something does not move, without looking | `guardrails.md` section 5. When you find out you were wrong, say so in the open |
| A corner card left over the page | A consent or chat card covers the last footer line and the control Tab just reached | While it shows, the page gets its height as bottom padding and scroll padding (preflight 52) |
| A broad rule restyling a label | A rule for a card's paragraphs also turns the card's small uppercase label into 16 px body text | Scope paragraph rules away from labels and read the label's computed style (preflight 59) |
| Quieting text with opacity | A count or unit set at 70% opacity passes on white and fails on a tinted, selected state | A muted colour token that passes where it sits (preflight 60) |
| Links only as tall as their text | Header and breadcrumb links 18 to 22 px tall on phones | A 44 px hit area on touch, without moving anything (preflight 61) |

**A repeated note is the strongest signal you get.** When the person says something a second time, or says "again" or "as I said", another small patch is the wrong answer.
1. Stop, and re-read both of their messages word for word.
2. Name what you got wrong the first time: too narrow, too wide, too literal, or the wrong thing.
3. Write the rule behind the note in one line, and say it back.
4. Apply it to every instance, counted (section 2).
5. Record it: `engine.py feedback "<the rule>" --kind note`. Said twice, it is a rule in `RULES.md`. If it fixes a value, also `engine.py standard add`.
6. On a third time, write a small check that finds every case (inside `opendesigner/`, with no new dependency), and run it before every showing. Ask once whether to draft a GitHub issue; send nothing without a yes (`improve.md`).

**Read each reply for what it says about your reading, not only for the fix.** "I only wanted that one changed" means your changes reach too far. The same fix asked for on five cards means they reach too little. "You just did more of the same" means "more" was a request for new ideas. Change how you read the next note, and say what you changed.

## 11. Signs of machine-made work, and what premium work does instead
In October 2026, AI builders made 54 showcase pieces through this process: heroes, components, app and watch screens, footers and mockups. Each was then audited against three to five shipped products on Mobbin. 28 passed, 20 needed polish and 6 were rebuilt; the owner judged most of the rest "AI slop" (`brand/showcase/audit/`, one file per piece). Every typeface rule held. The failures came from the habits below, counted across the 54. Check your own work against them before you show it. How the showcase frames and presents a piece, from how shipped teams do it: `brand/showcase/PRESENTATION.md` in the OpenDesigner repo.

| The tell | Seen in | Do this instead |
|---|---|---|
| Glow, bloom, gradient blobs or a blurred disc with no job | 19 of 54 | Flat fills and hairlines. A gradient or a photo must carry content, such as a real photo with the product on it |
| Texture or "art" standing in for a real asset: contour lines, painted skies, clipart, a CSS device pasted on a photo | 13 | A real asset from the person or an open library, credited (`hooks.md`), or no picture. Draw one object with craft, or none |
| Decoration with no data: rings, background grids, confetti, sparkles, crop marks, big sheet numbers | 12 | Every mark on the page carries information. Take decoration away before you add any |
| The same hero recipe: a "New" pill, a two-line headline with one phrase highlighted, a sub-line, then a filled and an outline button | 9 of 18 heroes and footers | Decide each part. One action is often enough. A highlight block is a choice for one page, not the default It is Linear's 2022 hero, which Linear has since dropped for a left-aligned headline and a product crop. |
| Floating, tilted UI fragments with soft shadows, overlapping the copy | 4 | Show the product flat, whole or cropped through repeating rows and cards (never through the point), at the size it was designed for, inside the page's grid |
| Invented proof: logo rows, star ratings, user counts | 3 | Leave it out until it is real. Specific facts persuade: places, dates, numbers with units |
| Status said three or four ways at once (border, badge, dot and color) | 4 | One signal per state, plus text. Color only where it carries meaning |
| Bold everywhere | 3 | Regular weight carries the page. Highlight one thing by weight, a fill or the second face (`rules.md`) |
| Device frames that copy a real brand's hardware, or hardware that is not lit like the photo under it | 5 | No device unless the device is the point (one task on two sizes, or the place the product is used). Then one generic device, straight on, screen at native pixels, plain stage, no props or hands; in a photo, match its light, shadow and perspective |
| A reference rebuilt too closely: the same labels in the same order, the same ID format, the same filter set | 1 B2B screen matched one product's page tile for tile | Take the structure (a status summary, then filters, then the table) and change everything that identifies the source: the states your product really has, its own labels and order, its own ID format. Compare side by side: if a viewer could name the reference, it is too close (`guardrails.md` section 1) |
| Warm cream with orange and brown, or four or more pastel hues | 4 | Strong tonal contrast and one accent with one job |
| Platform slips: a watch clock in the wrong corner, 42 px rows, desktop habits on a phone | 4 | Rebuild the platform's own chrome from a shipped reference before you style it |
| Reused invented data across pieces ("18:24", the same first name), or an invented name that is a real company | 2 pairs; 8 names in one later draft, and 2 real companies | Write fresh data for every product, in its own units. Search the project for every invented name before you use it (keep a registry of them, as the showcase does in `brand/showcase/NAMES.md`), and search the web for every brand name |
| Several ideas in one frame: three apps side by side, a sheet of components, a cascade of sites, a collage | 4 of 8 mockups | One idea per shot, written first; other states and pieces get their own images |
| Words about the image inside it: captions, sizes ("Tablet, 1180 × 820"), "1:1" badges, numbered leader lines | 7 of 8 mockups | Only the product's own words; the gallery card or the page around the image carries the caption |
| A whole screen shrunk until its type is mush, or a screen too small inside a device or scene | 2 of 8 mockups | Render the real viewport and crop it; check the copy at the size it will be seen (337 px wide in the showcase gallery) |
| Props and stock scenes around a device: a glass, a mug, a calculator, a plant | 2 of 8 mockups | A plain stage, or the one real place the product is used |
| A loud style everywhere at once: stickers, starbursts, stamps, rotated labels, two tickers | 1 hero, removed as "very ugly" | The style lives in one zone; type stays regular weight and the grid strict |
| Pure white and pure black together: white cards with #000 text, or a black page with #fff type (owner, 2026-11-02: "This should be enforced globally") | 1 rule for every project | Pair white with an off-black such as #111111, or black with an off-white. House standard STD-visual-details-66 (and -65 for the known colours below); `engine.py validate` and `review` enforce it |
| A call to action that moves on hover: magnetic, cursor-following, floating or "dancing" buttons (owner, 2026-11-03: "never ever use these sticky CTAs that dance when somebody is hovering over them") | 1 landing page, removed | Strict rule: a CTA never moves, follows the cursor or floats. Hover changes colour or brightness only; press may scale to 0.97 |
| A colour that contradicts what people already know: a red brand button beside red "rejected", Teams in orange, "approved" in the accent colour (owner, 2026-11-03: "keep that consistency … across whatever projects") | 1 landing page | Use the known colour unless the person asks otherwise: approved/attached green, rejected/missing red, pending amber, info blue; Teams purple, email Outlook blue, a call green. Keep the brand accent away from meanings that have a known colour |
| Too much on one screen: every panel with its own legend, meta line, footnote, icon tile or chip row (owner, 2026-10-15: "very cluttered and very unprofessional") | 30 of 71 in the round 4 audit | Show one moment and leave the rest out. Blind judges called ours "much denser than shipped pages", with "everything labelled" |

**What the pieces that passed had in common:**
- Shown flat and filling the frame, at the size the UI was designed for, with no words in the image except the product's own; at gallery size, one thing reads first.
- One object made with care that only this brand could own: a radio, a contour map with its float marker, a bowl.
- One typeface doing the work through size and weight.
- Copy with numbers and places instead of adjectives: "eleven architects", "4,112 instruments at sea", "Unit 4, Canal Yard 41".
- Small true data in the corners, such as coordinates, sunrise time, a page count.
- States shown inside a real page rather than floating.
- A structure taken from a shipped product and rebuilt in the piece's own materials (section 4).
- In a decorative style, the decoration carries data. The style studies (`brand/showcase/styles/`) moved from 3 to 4 or 5 when it did: shapes sized by tickets sold, two inks whose overlap shows felt wait against actual wait, red only where something failed.

## 12. What people had to ask for by hand
Each rule below is a correction a person had to type in a demo trial (`_coordination/TRIAL-LEDGER.md` in the repo). Do these without being asked. After every implementation, check them with the post-change audit (`post-change-audit.md`).

**Every product**
- **One shell for every page.** The sidebar, header, content width and page padding are the same on every page, so nothing jumps when the person moves between pages. Measure the shell's boxes on each page and compare them (preflight 44). In the trial, one page's wide table stretched its layout and "everything changes" when the person opened it.
- **Check after every round, not only at the end.** After each change, look at what you touched at each size, measure sibling heights and edges, and fix what slipped before you report (`quality.md`, floors).
- **The accent is chosen by looking.** Before you build every page on one colour, show two or three accents on the real page and recommend one. A colour picked from a list reads as "muted" or "not likable" once it fills a page.
- **Type and icons come from the category's best.** Look at the typefaces and icon styles that respected products in the same category ship (`practices.md` sections 3 and 4). Pick a typeface pairing and one icon set (`hooks.md`, `H-icons`), never emoji or text characters as icons, and offer one alternative by showing it. Take the class of face and the icon style, never a proprietary typeface or a brand's own icons.
- **Corners nest.** A rounded box set close inside another takes the outer radius minus the gap between their edges, so the two curves run parallel: a screen in a phone frame, a card in a stage, a button in a pill. Check every pair at every width (preflight 45).
- **The preview matches the detail.** A card or thumbnail shows the same view (size, theme, state) as the page it opens, and the click carries it. Switch views with a short crossfade (opacity and a little blur, ease-out, under 300 ms), and switch instantly with reduced motion.
- **Frames fit what they hold.** A stage or device wraps its content when the content is narrower than the frame's view, and every frame uses one style.
- **A gallery is calm.** Every card gets the same backdrop and the same size. Labels and stickers go below the picture, never on top of it. One spacing rhythm runs through every section.
- **Lists and sidebars breathe.** A nav list, menu or sidebar looks cheap when it is built at its minimums. The six changes that turn a cramped sidebar into a clean one, from a before-and-after the owner shared (Michael Filipiuk, "Cleaning up a slop sidebar", X, 2026-10-22):
  1. The container's corners are softer than the rows inside it, and nest with them (preflight 45).
  2. Rows and their selected state sit in from the container's edge (about 8 px), never touching it.
  3. The icon is quieter than its label: smaller, or lighter in colour, than the text beside it.
  4. The gap between icon and label is at least half the icon's size (8 to 10 px for a 16 to 18 px icon). At 4 px they read as one shape.
  5. Rows use the control height (`size-control-md`), not the 24 px accessibility minimum (`size-target-min`). The minimum is a floor, not a size (preflight 48).
  6. The gap between groups is several times the gap between rows, so groups read as sections.
- **"More visual" means more information, not more colour.** Premium work is close to monochrome: neutrals, one accent, and the danger colour only on the part that's going wrong. When someone asks for "more visual" or "show the problems", add charts and detail, and keep the palette quiet. In the trial, red tiles, red lanes and a red heatmap made the owner call the dashboard ugly.
- **Rebuild each screen from one strong reference, and log it.** This is for a screen inside a product (a table, a settings page, a dashboard), never for a landing page or a brand direction: those combine several references (section 1). For each screen, pick the shipped screen that solves it best (`practices.md` section 2) and follow its structure closely: what comes first, the density, the type sizes, how much colour it uses. Keep a log in `opendesigner/references.md` with the reference, what you copied, what you changed and why. Never copy identity: logos, brand names, exact brand colours, copy (`guardrails.md` section 1). When the same pattern holds across projects, record it with `engine.py feedback` so it can reach the learning wiki as a note, never as an image.
- **After one miss on type or colour, stop choosing alone.** Build three full directions (typeface, colours, layout) from shipped references, show them on the same slice of the real page, and let the person pick. In the trial, the agent picked fonts and colours by itself three times and missed each time.
- **Theme from the users' context.** Office work tools default to light, with dark as an option. Never let the computer's own dark setting decide the default; ask when unsure.

**Work tools and dashboards**
- **Fill the first screen with what needs attention.** People who use a tool all day want density: the numbers they act on, what's late or failing, and the next action, without scrolling. Large empty areas read as "very less data".
- **Show the problems, not only the totals.** Beside every healthy number, show the part that's going wrong: delayed, failed, overdue, over budget. Use the danger colour only for that part, for example the delayed slice of a bar.
- **A number with a trend gets a chart.** Use the smallest one that shows it: a sparkline, a bar per day, a meter. One series, one colour; its problem part, the danger colour (`quality.md`, Q6).
- **Offer first-run help once.** A work tool new people join needs a short way in: an onboarding checklist, an empty state that teaches, or a help panel. Offer it once; build it only after a yes.
