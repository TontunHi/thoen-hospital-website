# The quality bar

Nothing OpenDesigner makes is shown as finished below this bar. Use it on any visual result: a page, a screen, a component, a hero, an image for a post. Run it before you say "done", and before preflight.

Two kinds of check, kept apart (`docs/HOW-IT-WORKS.md` section 7 in the repo):
- **Floors** are rules a tool can check. They pass or fail.
- **The scorecard** is judgment. A floor that passes never makes the work good ("Correct is not finished", `making.md` section 5).

## 1. Floors (must all pass)
| Floor | How to check |
|---|---|
| Every value comes from the tokens | `engine.py review` reports no hard-coded colour, size, radius, shadow or duration |
| The system is valid | `engine.py validate`: contrast pairs in every mode, 24 px targets, focus, reduced motion |
| It holds at every size and theme | opendesigner-review: 375, 768 and 1440 px at least, light and dark, keyboard, hover |
| Siblings line up | Cards and panels side by side share a top edge and a height; stacked rows share one centre line (preflight 35) |
| One shell across pages | Sidebar, header, content width and padding measure the same on every page (preflight 44) |
| Every owner-corrected rule | The post-change audit (`post-change-audit.md`), after every implementation |
| No known mistake | opendesigner-preflight checklist (and `preflight.py` for type and fonts) |

## 2. The scorecard (judged, 1 to 5 each)
5 passes as a respected company's shipped work. 4 is good enough to post. 3 is competent but forgettable. 1 is slop.

Score each line against three shipped products that solve the same thing, compared blind at the same size (`making.md` section 5). Ask a reviewer that did not build it (a fresh agent), and give the person the last word.

| # | Line | What a 5 looks like |
|---|---|---|
| Q1 | **Fits the job** | Built for who uses it and what they must do: density, theme and tone match the work (a dispatch board is dense and light, a launch page is quiet) |
| Q2 | **Real content** | Real names, numbers with units, real product shots. No lorem, no placeholder logo, no invented proof |
| Q3 | **One system** | One accent with one job, one or two typefaces, every spacing and radius from the scale |
| Q4 | **Clear first read** | One thing reads first; one primary action per view; headlines say something specific |
| Q5 | **Craft** | Aligned at every width; numbers in tabular figures; every state designed (empty, loading, error, long text); rows at the control height, not the 24 px minimum, with room between icon and label (`making.md` section 12, "Lists and sidebars breathe") |
| Q6 | **Data shown as data** | For tools: a number that has a trend gets a small chart; status has one signal plus text |
| Q7 | **Restraint** | None of the tells in `making.md` section 11 (glow, blobs, emoji icons, decoration with no data) |
| Q8 | **Motion with a job** | Moves only to explain or confirm; respects reduced motion |
| Q9 | **Shown well** | Presented flat, at native size, one idea per image; for a post, over a real, credited photo |

**It passes when every line scores 4 or more and the blind comparison does not lose clearly to any reference.** Q6 and Q9 may be "not applicable"; say why.

**Your own score can only rule work out.** An agent that built or reviewed the work scores it kindly. A 3 means fix it. A 4 means "show it and ask", never "it passed". In a demo trial, a reviewing agent scored a dashboard about 4, and the owner called it "absolutely terrible". The person's verdict outranks every score.

## 3. Below 4: fix it now, or ask for the input it needs
Never show a line that scored below 4 as finished. For each one, either fix it before the person sees it, or tell them exactly what you need from them. Each line has a fix prompt: run it on yourself, or give it to the person to paste.

| Line | Fix prompt | If it needs the person |
|---|---|---|
| Q1 | "Write one line: who uses this, for how long, doing what. Change density, theme and tone to fit that line, then show the page again." | Ask who uses it and where (office, phone, outdoors) |
| Q2 | "Replace every placeholder with real-looking content in this product's own units. Remove any claim we can't back." | Ask for the logo, real screenshots, real numbers or customer names (`hooks.md`) |
| Q3 | "List every colour, font and spacing value on the page that isn't a token. Remove the extras or record them as decisions." | Ask which accent is the brand's, if two compete |
| Q4 | "Name the one thing this view is for. Make that the only primary action. Rewrite the headline to say what's specific about this product." | Ask what makes the product different (never invent it) |
| Q5 | "Measure alignment at 375, 768 and 1440 px, set tabular figures for numbers, and design the empty, loading and error states." | Usually none |
| Q6 | "For each number with a trend, add the smallest chart that shows it. Give each status one signal plus text." | Ask which numbers people act on |
| Q7 | "Remove every decoration that carries no information. Replace art stand-ins with a real asset or nothing." | Ask for real photos or illustrations, or offer opendesigner-illustrate |
| Q8 | "Remove motion that doesn't explain or confirm. Add a reduced-motion version for what stays." | Usually none |
| Q9 | "Show it flat at native size, one idea per image, with no captions inside the image." | Ask for a background photo they have the rights to, or use a credited free-licence one |

## 4. Report it
Put the scorecard in your report, every time:

```
Quality: Q1 4 · Q2 3 · Q3 5 · Q4 4 · Q5 4 · Q6 3 · Q7 5 · Q8 n/a · Q9 4
Compared blind with: <shipped product A>, <B>, <C> (same size). Lost to none / lost to B by 2.
Below 4: Q2 (placeholder logo) needs your logo; Q6 fixed next (adding sparklines to the KPI cards).
```

If you could not compare (no browser, no references), say so in those words. Never leave the scorecard out.
