# The taste poll

The person rates real screens from shipped products. Each screen sits at a known point on the eight dials, so every rating moves a profile. The result recommends dial values, and the person confirms them in the sketch. The poll exists because people react to real work much more reliably than they describe their taste in words, and because rating screens an AI made would only measure taste inside the AI look OpenDesigner tries to avoid.

## When to offer it
- The person can't put their taste into words, or says "I'll know it when I see it" or "show me".
- Before level 1, as an optional step: "Want to rate some real screens so I get your taste right? About 5 minutes."
- Whenever they ask for it. Never make it a gate; the sketch works without it.

## Run it
1. Build the page: `python3 <skill>/scripts/taste.py build --project "<name>" --open`. It writes `opendesigner/preview/taste-poll/index.html` with the images beside it. In Claude Code you may publish that folder as an artifact instead (the page plus its `img/` files).
2. Tell them how it works in two lines: rate each screen with one of the six ratings; after 20 the page offers to finish, and it stops at 30.
3. At the end the page shows a results card. Ask them to **take a screenshot of the card and keep it with the project**, then paste the line from "Copy for the chat".
4. Record it: `python3 <skill>/scripts/taste.py import -` with the pasted line on stdin. It records `taste.poll` in state, builds the taste index (below) into `opendesigner/taste-profile.json`, and prints what to do with each dial.
5. Offer the sure dials as "confirm this?" and ask the unsure ones directly (below, "Using it").

## The six ratings
| Rating | Weight | What it teaches |
|---|---|---|
| Cracked | +3 | Exceptionally good. The strongest pull toward this screen's dial values; sets the everyday boldness level |
| Best | +2 | Really good. A pull toward its values |
| Crazy af | +1 | Wild, and they love the energy. A light pull, and it raises the ceiling for big moments (launch, empty states), not every screen |
| Okay okay | +0.25 | Acceptable, not wanted |
| Generic | −1 | A soft push away, and it raises generic allergy: avoid middle-of-the-road defaults |
| I hate it | −3 | A strong push away. Its most extreme dials become red lines |

## How the next screen is picked
- The first 6 screens spread out: each is the farthest from everything shown so far.
- After that, most screens test the dial the profile is least sure about. Every third screen sits close to something they loved, to find out what exactly they love about it.
- Screens close to one they hated are shown much less: that direction is ruled out.
- The kind of screen rotates, so they don't judge one layout over and over.

## The library
- `assets/taste/library.json` lists every screen: id, app, kind, platform, source link, eight dial positions and style tags. It holds no images.
- The dial positions were estimated by looking at each screenshot against shared anchors. They are estimates; improve them when a designer checks them.
- **Images stay local.** Most screens come from Mobbin, whose terms do not allow re-hosting their content. The maintainers keep the images in the repo's git-ignored `taste-screens/` folder; people with their own Mobbin access cache theirs in `~/.opendesigner/taste-screens/`. Never commit or publish Mobbin images.
- If the person has Mobbin connected and the poll runs thin in the direction they are heading (`taste.py coverage` names thin dial ends), fetch more screens on the spot: search Mobbin, look at each result, tag it with the anchors in the library, and add it with `taste.py add entries.json`.
- Without any images on the machine, the poll can't run. Say so plainly and continue with the sketch questions.

## The taste index
The poll is one signal. The taste index merges every taste signal in this project into one profile: `opendesigner/taste-profile.json`, beside `state.json`. It stays in the project: it is never copied to another project or to the person's home folder (`preferences.py` keeps taste a project fact).

Build it with `python3 <skill>/scripts/taste.py index` (`--json` prints the whole index). `import` builds it too. The engine's option gallery and `engine.py review` compute it fresh each time, so they never read a stale file. Rerun `index` after an inspiration is accepted, a style is picked or a dial is decided, when you want the printed advice again.

For each of the eight dials it records a value, a confidence (0 to 0.9) and its evidence: source, id, value and weight, strongest first. It also keeps the poll's generic allergy, boldness levels and traits, and its red lines.

| Signal | Weight | Notes |
|---|---|---|
| The person overriding a recommendation | 8 | They chose a value unlike the one we recorded as `assumed`, `auto_default` or `delegated`. A style picked over our recommended style counts on every dial that style sets |
| The person choosing a dial with no recommendation in the way | 5 | |
| Poll: Cracked / I hate it | +3 / −3 | One item per dial per screen, at that screen's dial position |
| Poll: Best, Crazy af, Okay okay, Generic | +2, +1, +0.25, −1 | As on the poll page |
| An inspiration (opendesigner-extract) | 2.5 × its confidence (high 1, medium 0.8, low 0.5) | Their own product pulls at half that. A competitor never pulls: weight 0. A Taste Index counts the same way, as source `taste-index` |
| Confirming a recommendation | 1.5 | Choosing the value we recommended, or `confirmed_default` |
| A style pick | 1.5 | The dials the style and its preset set |
| Feel words | 1 | The feel settings they chose, as offsets from the middle |

- **Our own guesses never count.** Values set as `assumed`, `auto_default` or `delegated` are not evidence, so the index can never echo its own recommendations back.
- **A dial the person decided is pinned.** If they chose or confirmed a value, the index takes that value at 0.95. Nothing is asked, and a red line that value crosses is dropped: they chose past it.
- **The poll alone gives the results card.** The index uses the poll page's own model, so with only a poll it shows the same values, confidence and red lines as the card the person saved.
- **Red lines** come from screens they hated. A hated screen draws one when its dial value is 30 or more from both their taste and the middle. An option is past the line when it sits within 15 of that screen's value, or further out.

## Using it
- **Sure dials (confidence 0.45 or more): "confirm this?"** Record the value as assumed (`taste.py index` prints the command), then ask in one line, for example "Your taste points to flat surfaces, almost no shadow. Keep that?". On yes, record it as `chosen`. On a different answer, record their value as `chosen`: that is an override, the strongest signal there is.
- **Unsure dials:** ask directly, as usual. The index value can still be the recommended option.
- **Decided dials:** don't ask again.
- **Options:** leave out an option past a red line, in a question card, in AskUserQuestion or in a gallery. Order options by fit, best first. `engine.py show option-gallery` and `engine.py style tiles` already do both: they leave such directions out and say so, and they recommend the best fit unless the person already has an answer. A recommendation is never an option that was left out. For options you build yourself, run `python3 <skill>/scripts/taste.py fit options.json` (a list of options with `dials`, or a gallery payload) and show what it returns. An index that is sure of no open dial (feel words alone, for example) leaves the order as it is. Red lines still apply.
  - **A red line only judges the dials the options differ on.** A dial that every option sets to the same value is the same whichever they pick, so it never hides an option. If the system is past a line on that dial, `engine.py review` flags it as drift.
  - **If every option is past a line, show them all with a warning.** Never show an empty set. The gallery adds the warning to its subtitle and to `warning`, naming each option's line ("Every direction crosses a line you drew, so none is left out: Glass (too deep)"). `taste.py fit` returns the same `warning`. Tell the person before they pick.
- **Drift:** `engine.py review` lists dials that moved 20 or more from a value the index is sure of, and any dial past a red line. Show the person the difference and ask. If they want their taste back, set the taste value. If they keep the new one, record it as `chosen`, and the index follows. Drift is a note, not a failure: `--strict` ignores it, because taste is theirs to change.
- **Accessibility floors stay locked.** Taste moves dials. It never moves a floor or a standard: the engine refuses those values whatever their source.

## A Taste Index is something else
The taste index above is a preference model: eight numbers with confidence and red lines, merged from everything the person said and rated. A **Taste Index** (capitals, `opendesigner-extract`, `scripts/taste_index.py`) is a full description of one look, measured from a site or screenshot the person loves: a one-line picture, 5 to 7 principles with their reasons, every colour with its job and area share, type roles with exact font names and free substitutes, component rules, motion, voice as counts, a Never list, a CSS variable for every value and a live specimen. The two meet in two places:
- **Its dials are evidence.** Each Taste Index is registered as a reference, so its fitted dials pull the taste index as an inspiration (source `taste-index`). A project may hold several, one per surface or brand.
- **Following one is the person's choice.** By owner decision (2026-10-23, SPEC 5.4) an index may keep the site's exact colours and font names when first presented, with a notice that what the person keeps is their responsibility. Ask which index the system should follow, or none, and never decide it for them. `taste_index.py use <id> --fonts exact|free` records their choice: the dials, the accent as the brand colour and the fonts (exact names or free substitutes, as they chose), and DESIGN.md then points every agent at the index. Its Never list is the site's, so it does not join the taste card's Never line; the card's line stays the person's own words and ratings.

## The taste card
Five lines at the top of DESIGN.md's Overview (and in overview.html) that sum up how the system looks and feels, so the person, their team and any AI building with it hold the same picture. Each line says where it comes from.

| Line | What it shows | Where it comes from |
|---|---|---|
| In your words | The person's own picture of the look ("a quiet library at night") | `sketch --brief`, or `engine.py set taste.brief "<their words>" --why "their words"` |
| Color | Each color's job, plus the soft guide that the accent covers about 15% of a screen at most | The Colors section's first sentence; DC-L15-03 (the card doesn't use 60-30-10: its evidence is weak, LEVERS D2) |
| Shape | Corners and how surfaces separate | The Shapes and Elevation sections' first sentences |
| Motion | How it feels to move, then the rule | The Energy dial's own words and the Motion section's first sentence |
| Never | What it should never look like | Their words (`engine.py set taste.never '["gradients", "emoji in buttons"]' --why "their words"`), red lines from screens they rated "I hate it", and a high generic allergy from the poll |

Rules that keep it theirs:
- **The picture and the Never list are never invented.** Ask for a picture inside the feel question (`references/zoom.md`, sketch question 4). Record a "never" whenever they say one, for example "no gradients" while looking at the overview. If you write either for them, record it with `--set-by delegated`. The card then says "picked for you".
- **Color, shape and motion are not new claims.** They repeat the sentences that open those sections, so the card cannot disagree with the tokens. To change a line, change the decision, not the card.
- **Never is taste, not a rule.** It is repeated in Do's and Don'ts. `engine.py review` flags red lines, and nothing on the list fails a build. Floors and standards are not on it: they are locked anyway.
- **References give structure, never identity.** A site the person loves can move their dials through `opendesigner-extract`, but the card never carries its brand name, exact colors, typefaces or copy. A Taste Index the person chose to follow is the one exception (below).
- **It stays in the project,** like the taste index.
