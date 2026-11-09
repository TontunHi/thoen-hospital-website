# Zoom levels

People never pick a mode. Everyone starts with a quick sketch of the whole system. Then they zoom into only the parts they care about. They can stop at any level with something that works (BRIEF requirement 14). Each level's questions are in `pacing.json` → `areas[].levels`. Each question's level is in `questions.json` → `zoom`, and in its stage file.

| Level | Name | What the person gets | Rough size |
|---|---|---|---|
| 0 | sketch | A complete but coarse system: every token exists, every DESIGN.md section is filled from defaults | up to 5 questions, about 3 minutes |
| 1 | broad | One short screen for each foundation: style, density, color use, text, corners, depth, motion, and where the files live | 8 questions, about 8 minutes |
| 2 | defined | One area at a time (for example Color: ramps, roles, contrast) | Up to 12 questions per area |
| 3 | detailed | Blocks, components and patterns, and the fine print of each area (`stages/*.detailed.md`) | the rest |

## Level 0: sketch (a few questions, one per message)
Five answers shape the sketch. Ask only what their words and files don't already tell you.

**A Persuade surface** (a landing page, a marketing site) gets marketing questions, not app ones:
- Question 2: who it's for, in their words (`context.audience`). Record Q-aud-01 as `large`, assumed.
- Question 3: the one action a visitor takes, in every voice. Record it as `context.purpose`; the first result confirms it instead of guessing. It runs on the web (Q-plat-01, assumed).
- The goal's measure, the roles, the proof, how people find the site and its page families wait for the site brief at level 1 (below). Never ask them in the sketch.
- Never ask how often people use it, about a light or dark switch, or for a list of components.

**Read the repo first.** Before the first question, run `engine.py detect`. It only reads files, and writes nothing. It reports:
- the product's name and what it is (`package.json`, the README's first heading and paragraph, the page title);
- where it runs (Expo or React Native: iPhone and Android; Electron or Tauri: desktop; `ios/`, `android/`, `pubspec.yaml` or an Xcode project; a web framework or HTML pages: web);
- a brand colour candidate (the colour their CSS uses most on buttons, links and brand tokens);
- the font (`next/font`, `@font-face`, a font package or a Google Fonts link);
- dark mode (`prefers-color-scheme`, a theme switch);
- the project's phase (below).

A sketch question that a reading answers becomes one confirm line instead of a question: "I read *Budget Buddy, a web app* from your repo; say if that's wrong." Put the readings for several questions in that one line. `init` and `sketch` record each reading as `assumed`, with its file in the reason. An answer they give replaces it, and a confirmation is recorded again with `--set-by confirmed`. Ask the question only if they correct the reading, or if nothing in the folder answers it. A weaker signal, such as a colour on nothing clickable, appears as a `note:`. It is never recorded: mention it as a suggestion if it helps.

1. **What are you making?** Take a free answer and record it in the third person, so DESIGN.md and PRODUCT.md read well to a teammate: "my school coding club" becomes `engine.py set context.product '"a website for a school coding club"'`. Keep their words otherwise. If the product has a name, pass it as `sketch --name`. It replaces the folder name that `init` used.
   - Take each surface's kind (Q-scope-06) from their words. Say it plainly, like "a site that shows off your club". Pass it with `--surfaces`. When you inferred it, record it before the sketch instead (below, "Assumed answers"). Name the kinds (Persuade, Operate, Read, Experience) only when the designer or engineer voice leads.
   - If they name several surfaces (an app and a landing page), confirm Q-scope-01 in one line. The main surface goes first.
2. **Who is it for?** This is Q-aud-01. Ask whether people use it all day (`dense`), regularly (`regular`), or now and then on the go (`large`).
3. **Where does it run?** This is Q-plat-01. The choices are web, iPhone (`ios`), Android and desktop. Web alone is fine.
4. **How should it feel?** Ask: "Describe the feel in 2 or 3 words, like fun, calm, serious or bold. A picture works too, like a quiet library at night." Pass their words to `sketch --feel`.
   - If they give a picture, pass it unchanged as `sketch --brief "<their words>"` and the feel words it suggests as `--feel`. The picture opens the taste card at the top of DESIGN.md (`references/taste.md`). Never write a picture for them; without one, the card says it is not given yet.
   - The engine maps common words to its own (fun to playful, calm to deferential and minimal). `engine.py feel fun calm` shows the mapping, and `engine.py feel` lists every word it knows.
   - If the engine doesn't know a word, it builds with the others and prints one short question. Ask that question with the result.
   - Show six pairs only if they ask for choices, or when the designer voice leads. The pairs are playful or serious · friendly or authoritative · minimal or rich · premium or everyday · modern or heritage · bold or quiet.
   - The words fill in the personality sliders (Q-brand-01), so don't ask for the sliders.
5. **Do you have a brand color or a logo?** This is Q-color-01, asked together with Q-brand-03.
   - A hex color becomes the seed (`--brand`). The engine never replaces a hex they typed. It keeps it exact on main buttons with white or dark text, whichever reads. If neither reads, fills that carry text use a readable shade and the exact color stays for the logo and large areas. It prints one line either way: pass that line on.
   - A color word ("blue"): pick a hex of that color that fits their feel words, and pass it as `--brand`.
   - A logo file (PNG or SVG): run `sketch` with the other answers and `--logo <file>`. It writes nothing yet. It prints up to three colors from the logo, each with its share and a plain note, and the command that confirms one. Show them and let the person pick, or type their own hex. Then run that command: with `--brand` it builds and records the logo (hook H-logo). If you can see images, check the colors against the logo. For a JPEG or PDF, or when it finds no color, ask "What color is your logo mostly?" and pass that as `--brand`. A second strong logo color can become a second accent later (Q-color-04, `raw.secondaryColors`).
   - With neither, suggest 3 seed colors that fit their words, and label them as a starting point.

**Don't re-ask.** Skip a question their words or files already answered ("a website" answers where it runs). Log `step_skipped --step <Q-id> --reason known`, and still pass the answer to `sketch`. Say what you took from their words in one line with the result.

**Plain voice: ask fewer.** When the plain voice leads, ask questions 1, 4 and 5. Take who it's for and where it runs from their words when you can. For example, "a website for my school club" means visitors now and then, mostly on phones (`large`), on the web. Record those as assumed answers (below), and say them in one line with the result. Ask question 2 or 3 only when their words give no clue.

**Assumed answers.** An owner input you took from their words, not from an answer, is `assumed` (`rules.md` section 5). Readings from their files are recorded as `assumed` by `init` and `sketch` on their own; leave out of the `sketch` command each flag a reading answers, so the reading is kept as theirs to correct. Record an assumption from their words before the sketch, and leave its flag out of the `sketch` command too:
```
engine.py pick Q-aud-01 large --set-by assumed --why "a club website: visitors come now and then, on phones"
engine.py pick Q-plat-01 '["web"]' --set-by assumed --why "they said a website"
engine.py pick Q-scope-06 persuade --set-by assumed --why "a site that shows off the club"
```

**People in a hurry.** When they say "just pick", "just do it" or "you choose" about the rest:
- Stop asking. Pick values that fit their words and files. For example, reuse the button color already in their CSS as the seed.
- Pass what you picked with `--delegated`, naming those flags (`--delegated feel,brand`). A bare `--delegated` marks every sketch answer as handed over, so use it only when they answered none themselves. A hex given with `--brand` stays theirs even then: name `brand` only when you picked the hex.
- Log `speed_mode` (`rules.md` section 11). That is delegation. Add a frustration signal only if they sound fed up.
- Ask about who it's for once, and only if nothing points to an answer (`rules.md` section 7). If something does, record it as an assumed answer.
- After the sketch, send the result, the next step and the offer in one short message, with no extra visuals.

Then run one command. It records the answers and builds everything.
```
engine.py sketch --name "<product>" --audience regular --platforms web,ios --feel friendly,minimal [--brand "#167874"] [--surfaces "app:operate,landing page:persuade"] [--delegated feel,brand]
```
Then send the first result (below), and make the offer.

## The first result
Show what they got, not how it was made. Send one message:
1. **One plain line on what they got, in their words.** For example: "Robotics Club now has its colors, text and spacing, in your logo blue, with a fun feel."
   - Then **what I understood you're trying to do**, in one line, from their words and README: the purpose, and the goal it serves. For example: "What I understood you're trying to do: get more students to join the club before the autumn fair." Record it before the build as an assumption, and confirm it once, in this message:
     ```
     engine.py set context.purpose '"get more students to join the club"' --set-by assumed --why "from their words and README"
     engine.py set context.goals '["more sign-ups before the autumn fair"]' --set-by assumed --why "from their words"
     ```
     Record a mission (`context.mission`) or vision (`context.vision`) only when they said one. Never invent one. PRODUCT.md shows each line, or "Not enough information". Every later recommendation is checked against these lines, and the principles are drafted from the goals (Q-brand-07).
2. **The visual,** on the best surface the host has (SKILL.md, visual ladder). Lead with the overview (`engine.py overview --open`): their system on one page, with what is still missing marked as such.
3. **What you guessed,** in one line: answers you took from their words, and anything the engine changed. For example: "I guessed people visit now and then, mostly on phones. Say if that's wrong."
4. **One clear next step,** the single most useful thing to do now:
   - Plain voice: "Look at the overview and tell me anything that feels off."
   - Engineer voice: the exact file and how to wire it in. For Tailwind v4, two lines in the main CSS file: `@import "tailwindcss";` then `@import "<path to>/opendesigner/build/tailwind/theme.css";`. For plain CSS, import `opendesigner/build/css/tokens.css` once. The opendesigner-export skill lists every file.
   - Designer voice: the one or two defaults most worth a look, such as the body text size. Say where DESIGN.md explains them.
5. **The offer** (below).

Never dump settings: no dial numbers, token names, hex lists or file trees unless they ask. Point a plain-voice person to the preview first. If they want to read something, DESIGN.md opens with a short plain summary.

## The project's phase
The phase (Q-scope-07) says where the project is now: an idea, being built, close to launch, or live. It decides what comes first after the sketch. "Stage" already means an interview topic in these files, so this is always called the phase. The phase decides what each step holds; the six steps in `opendesigner/PROTOCOL.md` still run in order. For a built product, step 1 starts with the audit.

`engine.py detect` reads it from the folder, and `init` and `sketch` record it as `assumed`. An empty folder says nothing: then take it from their words, or ask once with the sketch's first question.

| Phase | Read from the repo when | What comes first |
|---|---|---|
| Idea (`idea`) | Files, but no code yet (a README, notes) | The alignment: mission, vision, purpose and goals (above). Then the analogous product, a product from another field that solves the same kind of problem. Then the sketch. Nothing to audit yet |
| Being built (`building`) | Code, but no deploy settings | The sketch, then the areas the screens being built need most |
| Close to launch (`near-launch`) | Code and deploy settings (`vercel.json`, `netlify.toml`, a Dockerfile, `eas.json`, a deploy workflow) | The audit of what exists (`references/audit.md`), then copy and voice (the Words area), then `opendesigner-preflight` before release |
| Live (`live`) | A changelog with released versions, or a version past 1.0.0 (npm's default 1.0.0 does not count) | The audit (`references/audit.md`), mapping onto the tokens the code already has, then governance: who may change the system, and how versions are numbered (Files, tools and team) |

- Put the phase's first step at the top of the offer after the sketch (below). The engine prints it after the sketch as a `Phase:` line.
- PRODUCT.md shows the phase and what comes first, in its own section.
- PRODUCT.md's Market section comes from the user research first: its market topic finds the competitors, what they all do, the gap and an analogous product, with sources (`research.md` sections 3 and 6). What the person tells you, or what you take from their words, is recorded in `context.market` as assumed until they confirm it, and wins over the research. `context.market.analogous` holds the analogous product and `context.market.competitors` the competitors, as a list. `pattern` is what the competitors all do, `gap` is what none of them does well, and `conventions` holds the words and habits the industry's users already know.
- If they correct the phase, record their answer: `engine.py pick Q-scope-07 near-launch --why "<their words>"`.

## Level 1: broad (one screen per foundation)
**The site brief comes first for a site that persuades** (Q-scope-06 `persuade`, or Q-scope-01 `marketing`; `pacing.json` → `site_brief`). It is one screen with five lines, Q-site-01 to Q-site-05: the goal and how it is counted, the roles to convince and what each needs to see, the proof, how people find the site (search, AI answers, languages, the questions it answers), and the page families.
- Draft every line before you ask. The goal comes from `context.purpose`, the roles from the user research, and the languages and page families from `engine.py detect` (`sketch` records them as assumed). The person corrects the draft in one reply.
- Proof is the one line only they can give. Never draft it: take it word for word, with each figure's qualifier (for whom, over what time, compared with what). Until they give it, the confirmed positioning's proof fills the line.
- The phase changes the page families: plan them for an idea, and read them from the routes or the live site for a built or live one, confirmed in one line.
- Plain voice: ask only the goal and the proof, and take the rest from their words and files as assumed.
- Record each answer: `engine.py pick Q-site-03 '[{"kind": "figures", "what": "...", "qualifier": "..."}]' --why "their words"`. PRODUCT.md's Site brief shows each line, or "Not enough information" with its question, and the overview lists what is missing.

After the research and the site brief, open with the competitor table and the confirmed positioning, then the three directions on the direction board (`research.md` sections 8 and 9). The pick is a starting point for these screens. Then go in this order, with the listed templates:
- Q-dir-01, style (`option-gallery`)
- Q-dir-02, how much fits on a screen (`spacing-ruler`)
- Q-color-02, where the brand color shows (`palette`)
- Q-type-01, which font (`type-scale`)
- Q-shape-01, corners (`radius`)
- Q-depth-01, how cards separate (`elevation`)
- Q-motion-01, motion feel (`motion`)
- Q-tool-01, where the master copy lives (text)

Each screen is one message with one question. The person can say "skip", and the default stays. Leave out a screen whose question its stage file marks **Settled by: STD-...**. After the last screen, run `engine.py build`. The engine marks each area it touched as `broad` by itself.

## Levels 2 and 3: one area at a time
There are 14 areas: overview, accessibility, platforms, modes, color, typography, layout, shape, elevation, motion, iconography, content, components and delivery. Their plain names are in `pacing.json`. The ids match the engine's, except `delivery`: the engine does not track its zoom level.
1. Zooming into an area asks its skipped lower-level questions first (for Color after the sketch: Q-color-02 from level 1).
2. Color opens with the competitor table when one exists (`engine.py research market`). Open the area's stage files. Ask its level-2 questions in stage order. Skip any marked **Planned** (not built yet) or **Settled by: STD-...** (a standard already locked the answer), and never recommend an option marked **(breaks STD-...)**. Then run `engine.py build` and show the change.
3. **Plain voice: ask fewer.** When the plain voice leads, ask only three kinds of question: weight `high`, asset hooks, and owner inputs (block class I). Also ask a `medium` question when their words or assets make it matter: a logo with two colors makes Q-color-04 matter. The rest keep their defaults (`auto_default`: nothing to run). Name them in one line of the level summary, like "I also picked the grays and hover colors for you." They can say "ask me everything".
4. Sometimes `pick` says an answer shapes DESIGN.md rules, not tokens. Then say it is saved as a rule, so they don't expect the preview to change.
5. Record the level: `engine.py set zoom.color '"defined"'` (level names: `sketch`, `broad`, `defined`, `detailed`). The engine also infers the level from the decisions made in an area.
6. Level 3 uses `NN-*.detailed.md` in the same way. Pull a level-3 question forward when the product needs it. For example, ask about numbers that line up in columns (Q-type-06) when zooming into Text for a finance or data product.
7. Components live at level 3. Build them from tokens, not from scratch.

## The offer after every level
Keep it short, in plain words:
> That's your first version: everything works, and I picked most of the small choices for you.
> Stop here, or go deeper on one part:
> **Colors** (about 6 min) · **Text** (about 2 min) · **Everything, in 8 quick screens** (about 8 min)

- When a phase is recorded, lead with what that phase needs first ("The project's phase", above). Close to launch, for example, the first choice is the audit, not Colors.
- After the sketch, put the user research first, above the choices, unless it is done or skipped (`research.md` section 1): "Before we go deeper, I can research who your users are and which apps they already use, about 10 minutes, and I do the work. Shall I?" Send its plan in the same message (`research.md` section 4).
- Offer at most 3 choices. Use each area's plain name and its minutes from `pacing.json` (`areas[].levels["<level>"].minutes`). Pick what matters most for this product. First come areas whose choices change the most (`pacing.json` → `top_decisions`). Then come areas their answers made risky, such as a light brand color or a dense product.
- Accessibility is never an option to skip. Its floors (`guardrails.md` section 4) are already set at level 0.
- "Stop" is a good answer. Finish with the Finish steps in SKILL.md, at whatever level they reached.
- If the journey log is on, run `journey.py level-line <level>`. After the sketch, the engine prints this line itself. If there is a line, put it above the choices, for example "You took 9 steps; the shortest path is 5." If there is none, add nothing.
- The sharing question is not part of the offer. It comes once, at the end of the first session (`rules.md` section 11).
- DESIGN.md shows each section's zoom level. A teammate can see what was decided and what is still a default (SKILL.md, "DESIGN.md stays alive"). When someone asks what a section means, point to its zoom line and offer to zoom in.
