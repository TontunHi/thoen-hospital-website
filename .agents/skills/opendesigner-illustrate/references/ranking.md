# Judging illustration candidates

`illustrate.py rank` scores titles, tags, licence, format and (after fetch) style metrics. It cannot see the picture. Look at the top 8-12 candidates yourself, then judge each one on the questions below, in this order. Drop a candidate at the first hard "no".

| # | Question | Hard no when | Source |
|---|---|---|---|
| 1 | **Licence.** Commercial use and changes allowed, terms read on the item's own page? | NC, ND, no stated licence, or a manual source reached by script | `sources.json`; `hooks.md` rules 5-6 |
| 2 | **Message.** Would someone who sees only the drawing guess the slot's message ("nothing here yet", "you're lost", "it worked")? | It says something else, or needs its caption to make sense | [inferred] |
| 3 | **Not another brand's identity.** Is it from an open library, not lifted from a product or site? | It comes from a brand's own pages | `guardrails.md`; DC-L05-14 (IBM: reject what "any other organization" could have made) |
| 4 | **Style fit.** Does line weight match the icon stroke, corner softness match the Roundness dial, and busyness match Expression? | A thin-line doodle beside a bold filled UI, or the reverse | DC-L05-19 |
| 5 | **One style.** Same library or set as the art already applied (the style lock)? | A second library when the first one has a fitting piece | DC-L05-19; "one library per project" (https://muz.li/blog/best-free-illustration-libraries-for-designers-2026/) |
| 6 | **Recolors cleanly.** Four hues or fewer, flat fills, few gradients, no embedded bitmaps? | Photos or bitmaps inside the SVG | `style_metrics` in `illustrate.py` |
| 7 | **Reads at size.** Clear at the slot's size (`purposes.json`), without tiny detail turning to noise? | Detail that turns to mush at 160 px | [inferred] |
| 8 | **People.** If it shows people, could this product's audience see themselves in it? Varied skin tones, ages and bodies; no stereotypes | A cast that excludes the product's audience | Moonly's result [S-L19-111]; NN/g on stereotypes in AI images (hooks.json H-photo) |
| 9 | **No words inside.** Any `<text>`, signage or UI copy drawn in? | Text in a language the product ships in | `illustrate.py check` |
| 10 | **Weight.** Under about 150 KB after cleanup? | Over 500 KB for a spot | [inferred] |

## Vibe
Style sets the tone: blobs and bright colors read playful, doodles sit in the middle, realistic art reads professional [S-L19-063]. The flat "Corporate Memphis" look that unDraw and Humaaans helped spread is now common enough that some reviewers call it a sign of the free option (pixels.market review, Aug 2026, written by a seller of a competing set; https://en.wikipedia.org/wiki/Corporate_Memphis). Say so when you recommend it, and offer a less common set or a commission when brand recognition matters.

## How to present
Show 3 or 4 candidates, not 12. Give each one a line: what it shows, why it fits, its licence in plain words ("free, no credit needed" or "free if you credit the artist"). Recommend one. Then ask which one, or whether to search again with different words.

## Clutter limit
Stop before the next drawing tips a screen into clutter [S-L19-063]. Heavy illustration raises cognitive load, and in routine product screens it can feel childish (DC-L05-20). One piece per screen is the usual ceiling; feature rows are the exception, with one small spot per tile in a single style.
