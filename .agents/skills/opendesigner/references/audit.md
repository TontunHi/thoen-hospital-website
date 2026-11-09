# The audit: what is wrong with a built product, and what practice says

This is step 1 of the fast path for a product that is already built (`SKILL.md`, "A built product comes first as an audit"). The person wants it fixed and does not want to learn design words. You go through every button, font, weight, size and colour, say what is wrong in plain words, say what good practice says and where that comes from, and show it on their own page. Nothing changes until they say yes.

The audit only reports. It never edits their code (AGENTS.md: checks report; STD-process-review-taste-14 for motion audits). The fixes are steps 2 and 3 of the fast path.

## 1. How to run it

1. **Read the code first.** Open the stylesheets, the components and any token or theme file. `opendesigner-extract/scripts/css_scan.py <repo>` lists the declared colours, accent, sizes, radii, shadows and motion by role, each with a count. Note the files and lines you will cite.
2. **Measure the pages as they render.** Use `opendesigner-review`: `review.py plan` (at least one phone and one desktop width), run `probe.js` on each page, then `review.py check`. With or without a design system, `check` now counts primary buttons in each view, typefaces, weights and colours against practice. It also checks the accessibility floors: contrast, target size, focus, names and zoom. It writes the findings to `opendesigner/review/findings.measured.json`.
3. **Walk the checklist** in section 3, one element class at a time: buttons, type, colour, spacing, corners, states. Each check names its tool. When a check does not apply, skip it and write one line on why ("no forms on these pages").
4. **Confirm each finding before you write it down.** Re-read the code it points to and cite `file:line` or the selector. Drop anything that is by design. Write exact values: "#9ca3af on #ffffff, 2.5:1", never "low contrast". The house standards ask this of motion findings (STD-process-review-taste-07 and -08); the audit asks it of every finding.
5. **Write the table** (section 2) to `opendesigner/review/AUDIT.md`, ranked by what each fix gives for the work it takes: the most change for the least work comes first. A short list you are sure of beats a long padded one (STD-process-review-taste-09, written for motion audits, applied here to all of them).
6. **Show it on their page.** Run `review.py compare` with a `source` on every mark, so each issue on the page says where its rule comes from (`opendesigner-review` SKILL.md section 7).
7. **Send one short message** (section 5) and stop until they answer.

## 2. One finding, one row

Every finding is one row of one table (STD-process-review-taste-04: one table with Before, After and Why columns, one row per issue).

| # | Where | Before: what is wrong | After: the fix | Why: what practice says (source) |
|---|---|---|---|---|

- **Where** is the element and where to find it: a file and line, a selector, or the measured value, plus how it is known (measured, seen, or read in the code). For example: `src/Hero.tsx:42`, `a.btn-primary`, "3 filled buttons in the first screen at 390 px (measured)".
- **Before** says what the person sees or feels, in plain words. A design word appears only with its plain meaning first (`rules.md`, the glossary).
- **After** is the change, with its value: "'Book a demo' becomes a text link; 'Start free trial' keeps the blue fill." Exact values, never "make it pop".
- **Why** gives the rule in plain words, then its source in brackets. Every row has one.

**Sources a "Why" may cite, strongest first.** When two disagree, the order in `guardrails.md` section 4b decides: accessibility floors, then the person's explicit choice, then project standards, then house standards, then recommended defaults, then research defaults.

| Source | How to cite it | What it means for the fix |
|---|---|---|
| An accessibility floor | the WCAG 2.2 success criterion: "WCAG 2.2 SC 1.4.3" | Locked: always fixed. The person can only raise the bar, never lower it (`guardrails.md` section 4) |
| The person's own rules | their DESIGN.md decision or project standard: "PRJ-02" | Their choice wins over everything except the floors |
| A house standard | its id: "STD-visual-details-36" (`standards/<theme>.md`) | A **must** is fixed unless the person explicitly overrides it. A **should** is the default |
| A preflight check | "preflight 36" (`opendesigner-preflight/references/checklist.md`) | A mistake the owner caught in real work. Recommended |
| A `making.md` row | the section and row: "making.md section 10, Three calls to action of equal weight" | A mistake a builder made, with its fix. Recommended |
| A review case | its id: "MS-16" (`opendesigner-review/references/cases.md`) | How the fault is caught and measured |
| A research default | a Decision Card: "DC-L08-05" (`references/cards/`) | Sourced research, weaker than a standard. Say "most design systems do X" |
| A shipped product | the product and the screen: "Linear, the issue list" | Shows how someone else solved it. It is an example, never a rule |
| Nothing | "my own idea" | Say so. Never present it as a rule |

Never invent a source, an id or a number. When you are not sure an id says what you claim, open it and check.

## 3. The checklist

Each check gives what to look at, how to measure it, what practice says with its source, and the usual fix. The numbers are what good products ship, not taste.

### 3.1 Buttons and calls to action
A call to action is the button that asks the person to do the main thing, such as "Sign up", "Save" or "Send".

| Check | How to measure | Practice says (source) | Usual fix |
|---|---|---|---|
| **Primary actions per view.** How many buttons shout at once | `review.py check`, case MS-16: it counts the filled buttons that stand out 3:1 or more from what is behind them, in the first screen. Also read the button component for a `primary` variant | One primary button per view, for the one action the view exists for. The others are quieter, and nothing the header already offers is repeated as a button (preflight 36; DC-L08-05; making.md section 10, "Three calls to action of equal weight") | Keep the fill on the one action. The second becomes an outline or a text link. The rest move to the header or the end of the page |
| **Two filled buttons side by side** | MS-16 "side by side"; dialogs, forms and table rows | At most one high-emphasis action per group or dialog (DC-L13-18). When two compete, remove the lesser one's fill before you add a style (DC-L19-104) | Make one of them an outline |
| **Opposite actions** (Skip and Done, Decline and Approve) | Look at every pair at phone width | One row: the secondary on the left, the primary on the right, as far apart as the row allows, never stacked (preflight 41; making.md section 10, "Opposite actions side by side, or stacked") | Put them on one row, in that order |
| **One primary style** | MS-16 "different fills for the main button" | Things that look the same behave the same (STD-visual-details-36). One primary style, plus red for an action that destroys something (DC-L08-05) | One fill for the main action, everywhere |
| **Labels say what happens** | Read every button label | Buttons start with a verb that says what happens ("Send invoice"), not a clever label; links say where they go, never "Click here"; a system dialog keeps the platform's own labels, such as OK and Cancel (DC-L06-22; DC-L19-38). Plain and short (STD-visual-details-35). A button that commits the person names the commitment (DC-L19-104) | Rewrite each label as verb plus object |
| **Same place, same label** | Compare the header and page buttons that go to the same place | A header button and a page button that go to the same place share a label (DC-L19-38) | Pick one label |
| **Labels stay on one line** | MS-15 | Button, chip and tag labels never break across lines (preflight 40), and tab labels neither (MS-15) | `white-space: nowrap`, and give the label room |
| **Size and hit area** | MS-06 and IN-04 in `review.py check` | At least 24 by 24 CSS px on the web (WCAG 2.2 SC 2.5.8, a floor). 44 pt on iOS and 48 dp on Android for touch (STD-mobile-touch-09). A minimum is not a size: rows and menu items use the control height (preflight 48). Controls share one height scale, such as 32, 40 and 48 px on the web, with no mixed sizes in one group (DC-L08-07) | Raise `min-height`, or grow the hit area, never the visual |
| **Icon-only buttons** | IN-03 | Every control has a name a screen reader can say (WCAG 2.2 SC 4.1.2). Key actions get text and an icon, not an icon alone (DC-L13-18) | Add a visible label, or `aria-label` for icons everyone knows |
| **Press feedback** | Press it, or read its `:active` style | Pressables scale to 0.97 while pressed, with a 100 to 160 ms ease-out transition on the web (100 to 150 ms in React Native) (STD-mobile-touch-05) | Add the `:active` style |

### 3.2 Type (text)

| Check | How to measure | Practice says (source) | Usual fix |
|---|---|---|---|
| **Typefaces** (font families) | `review.py check` counts the families on the page (icon fonts and the system font's several names are counted once); `css_scan.py` lists the declared ones | One family for the interface plus one mono for code. A second text face only with a named job, such as display headings on a marketing page (DC-L02-03; quality.md Q3, "one or two typefaces"). Start from the system font unless there is a stated reason (STD-visual-details-11) | Move the strays to the main family |
| **Every font loads** | MS-03 | Every family you ask for is the one drawn; no fallback renders (preflight 10) | Fix the `@font-face` path or drop the family |
| **Weights** | `review.py check` lists every weight in use | Three weights at most in a system, and two in any one view, clearly apart, such as 400 and 600 (DC-L19-24). Two neighbouring weights, such as 400 and 500, can read as a mistake rather than a level (DC-L19-24, marked inferred there). Black everywhere reads as shouting (preflight 6; making.md section 11, "Bold everywhere") | Give each weight a job (body, labels, headings) and merge the near ones |
| **Sizes** | MS-02 lists every size | About 8 sizes at most, all from one scale, none within 10% of another (preflight 7) | Map each size to the nearest step |
| **Hierarchy** | Look at each screen, then measure the levels | Weight, size and line height set together, not size alone (STD-visual-details-07). The most important thing is the most obvious (STD-visual-details-29). Emphasis by weight, not italic (STD-visual-details-08) | Rank the text first, then give each level one change |
| **Smallest text** | the probe's smallest size; `preflight.py html` | 12 px on a web page, 11 px only for short labels, 11 pt in a phone app (preflight 9). Inputs at 16 px or more, or iOS zooms in (STD-mobile-touch-11) | Raise it to a text style |
| **Line length** | MS-07 | Body text about 65 characters wide (STD-visual-details-01). Text still reads with WCAG text spacing (WCAG 2.2 SC 1.4.12) | `max-width: 65ch` |
| **Numbers that change** | Look at prices, timers, tables | Tabular figures (STD-visual-details-02) | `font-variant-numeric: tabular-nums` |
| **Underlines** | `engine.py review` | Only links are underlined (STD-visual-details-09) | Use weight or colour for emphasis |

### 3.3 Colour

| Check | How to measure | Practice says (source) | Usual fix |
|---|---|---|---|
| **Colours typed twice** (#333333 here, #343434 there) | `review.py check` groups colours a few steps apart; `css_scan.py` lists the declared ones | One value per colour, named once and reused, never a second set beside the first (STD-visual-details-26). Count the values that do not come from one system (preflight 2) | Keep the most used value of each group. This is the first step towards a palette |
| **Accents** (strong colours) | `review.py check` names the colour families in use (blue, red, green and so on) | Grays, one accent with one job, and status colours (DC-L01-08), with the danger colour only on the part that is going wrong (making.md section 12, "More visual means more information, not more colour"). Four or more pastel hues reads as machine-made (making.md section 11) | Pick the one accent. Turn decorative colour gray |
| **Gray text colours** | `review.py check` counts them | Three: main text, secondary text and hints (DC-L15-02). Secondary text is a solid colour that passes 4.5:1, not a free opacity (DC-L19-46) | Give each gray one of the three jobs |
| **Contrast** | MS-04, measured, never judged by eye | Text 4.5:1, large text 3:1 (WCAG 2.2 SC 1.4.3). Control edges and focus rings 3:1 (SC 1.4.11). On a photo, glass or gradient, measure against the pixels behind the text (preflight 11) | Darken the text or lighten the surface with a pair that passes. Check dark mode too |
| **Meaning carried by colour alone** | Look at status chips, errors, required fields and links | Colour is never the only clue (WCAG 2.2 SC 1.4.1). Each state gets one signal plus text, not border, badge, dot and colour at once (making.md section 11, "Status said three or four ways at once"). Status colours come with an icon (DC-L01-15) | Add the word or the icon |
| **Dark mode** | CV-06: run the same cells in both themes | Each colour role has a light and a dark value (STD-visual-details-24) | Give each colour a dark value |

### 3.4 Spacing

| Check | How to measure | Practice says (source) | Usual fix |
|---|---|---|---|
| **One scale** | MS-01 lists the gaps that are off the 4 px grid, or off the system's steps | All spacing comes from one scale (preflight 12). Every value is a choice you can defend (STD-visual-details-27) | Map each gap to the nearest step |
| **Groups and rows** | `__od.measure(a, b)` between rows and between groups | The gap between groups is several times the gap between rows, so groups read as sections (making.md section 12, "Lists and sidebars breathe"; preflight 48) | Widen the gap between groups |
| **Alignment** | MS-05; measure sibling cards at every width | Sibling cards share a top edge and a height. Stacked rows share one centre line (preflight 35). No misaligned icons or broken rotations (STD-visual-details-28) | Align to one grid |
| **One shell** | Measure the header, sidebar and content width on each page | They measure the same on every page and at every width (preflight 44) | One layout component for all pages |
| **Text-size scaling** | `engine.py review` | Spacing in rem or em, so the layout grows with the person's text size (STD-accessibility-motion-13) | Convert px gaps to rem |

### 3.5 Corners (radius)

| Check | How to measure | Practice says (source) | Usual fix |
|---|---|---|---|
| **How many radii** | MS-09; `css_scan.py` splits control and container radius | A short scale. If you cannot name a component that uses a step, delete the step (DC-L04-01) | Map each radius to a step |
| **Corners nest** | MS-14 with `__od.measure` | A rounded box close inside another takes the outer radius minus the gap, within 2 px (preflight 45; making.md section 12, "Corners nest") | Set the inner radius from the outer one |
| **Same kind, same corner** | Compare buttons with buttons and cards with cards | Things that look the same behave the same (STD-visual-details-36) | One radius per kind of part |

### 3.6 States
A state is how a part looks when you point at it, press it, select it, or cannot use it.

| Check | How to measure | Practice says (source) | Usual fix |
|---|---|---|---|
| **Hover** | ST-01; the probe lists controls with no `:hover` style; hover a few | A hover cue on pointer devices (review case ST-01), with every hover style inside `@media (hover: hover) and (pointer: fine)` (STD-accessibility-motion-15). Nothing works only on hover (making.md section 5, "Test without hover") | Add a hover style inside `@media (hover: hover) and (pointer: fine)` |
| **Focus** | IN-02 with the Tab walk (`__od.focus`) | Visible focus (WCAG 2.2 SC 2.4.7) that a sticky bar never fully hides (SC 2.4.11), with the ring at 3:1 (SC 1.4.11). The house floor is a 2 px ring at a 2 px offset, not colour alone (`guardrails.md` section 4) | Replace `outline: none` with a `:focus-visible` ring |
| **Pressed** | Press it | See "Press feedback" in 3.1 (STD-mobile-touch-05) | |
| **Disabled** | Read the code for disabled submit buttons, then look at each disabled control | Don't disable a submit button: validate when it is pressed and explain. When an action truly cannot run, use `aria-disabled` with visible helper text (DC-L08-10) | Enable the button and show the reason |
| **Error** | ST-03. Type a wrong value on a local or staging copy, with test data, and never submit a real form (`opendesigner-review` hard rules) | Say in text what is wrong and how to fix it (WCAG 2.2 SC 3.3.1 and 3.3.3), next to the field and without blame (DC-L06-22). Check input as it is typed, not only on submit (STD-visual-details-49) | Add a message next to the field |
| **Loading, empty and success** | ST-03 | Every action gets feedback: loading while it works, success when it is done (STD-visual-details-49) | Add the missing state |
| **Selected and current** | Look at tabs, nav and list rows | An indicator plus colour, with colour only on the selected state (DC-L19-106) | Add the indicator |

## 4. What an audit report looks like

An example, for an invented booking app. The opening sentence is the verdict; then the table, most change for the least work first.

> The booking page has three buttons asking for the first click, four typefaces and grey text that is hard to read. Fixing those three changes the most.

| # | Where | Before: what is wrong | After: the fix | Why: what practice says (source) |
|---|---|---|---|---|
| 1 | `src/Hero.tsx:42`, `a.btn-primary` ×3; 3 filled buttons in the first screen at 390 px (measured) | "Book now", "See plans" and "Sign up" are all blue and filled, so nothing reads first | "Book now" keeps the fill. "See plans" becomes a text link, and "Sign up" stays in the header only | One primary button per view (preflight 36; DC-L08-05) |
| 2 | `p.meta` and 14 more; #9ca3af on #ffffff, 2.5:1 (measured) | The dates and prices are hard to read | Use #4b5563 (7.6:1) | Text needs 4.5:1 (WCAG 2.2 SC 1.4.3) |
| 3 | `styles/global.css:3-11`; Inter, Roboto, Poppins, Georgia (measured) | Four typefaces make the page look stitched together | Inter for all of it; the 6 Georgia headings move to Inter at weight 600 | One interface family plus a mono (DC-L02-03) |
| 4 | `button.save` and `button.publish` in `Editor.tsx:88` (measured) | Two filled buttons side by side | "Publish" keeps the fill; "Save draft" becomes an outline | At most one high-emphasis action per group (DC-L13-18) |
| 5 | 300, 400, 500, 600 and 700 in use (measured) | Five weights; 500 and 600 sit next to each other and can read as a mistake | 400 for body, 600 for headings and labels | Two weights per view, clearly apart (DC-L19-24) |

## 5. The message, and what comes after

**The first message** has the verdict in one sentence, the top three findings in plain words, the path to `AUDIT.md` and to `compare.html`, and one question: "Shall I fix these on the booking page first, so you can compare?" Nothing else (`rules.md`: one idea and one question per message).

**After a yes** (fast path step 2):
- Fix them on one page, from tokens. When the code already has tokens, map onto them and extend them, never a second set (DC-L19-189). When it has none, the values the audit kept become the first tokens: the one primary fill, the weights you kept, the three grays. `opendesigner-extract` maps them to dials.
- A token fix (a colour, a size, a corner) is one fix. A fix that changes structure, such as merging two parts or a new layout, is a choice: show two or three small directions on a review copy (`making.md` section 3).
- Every fix or option you show says where it comes from in one line, and ends with "Keep the fix, keep today's, or try another?" (`making.md` section 3).
- Run the same cells again and `review.py check` on the new probe files. It prints what was resolved (`opendesigner-review` SKILL.md section 7).

**Step 3** rolls the kept fixes out to the other pages, only after they say yes.

## 6. Every round: the check order

Run this on every draft before you show it, not only when asked (owner review 2026-11-05 row 6). The checks report; you fix.

1. **Settle.** Load the page and `await __od.settle()`, so nothing is judged mid-reveal (TM-01).
2. **Capture.** `capture.py --url <local url>` at 320, 390, 768, 1024 and 1440 px. Without Playwright, run `probe.js`, `__od.kern()`, `await __od.bars()` and the toggles by hand at the narrowest and widest (`opendesigner-review` SKILL.md section 4).
3. **Check.** `review.py check opendesigner/review`. Fix every error, then every warning in this order:
   - text: tracking and kerning (MS-17), headings over two lines (MS-18), art through text and contrast on pixels (MS-20, MS-04);
   - layout: mixed or off-centre alignment (MS-05), bars covering text (CV-08), boxes that change height (ST-10), controls that change nothing (ST-11);
   - counts: sizes, typefaces, weights, greys (MS-02, MS-08), primary buttons and button styles (MS-16, MS-19), unused fonts (EN-08).
4. **Preflight.** `preflight.py html <page>` and the checklist (`opendesigner-preflight`).
5. **Look.** `review.py sheet --open`, at full size.
6. **Show.** Before and after, with what was checked and what is still open.

