# Asking the answer engines

A handful of questions, by hand, logged out, in a browser the person can see. The goal is to see:
- what each engine searched for;
- which pages it read;
- whom it named;
- what it expects to be asked next.

## Allowed, and not
- **Allowed:**
  - typing a question into the engine's own page;
  - reading what that page shows;
  - reading what the page itself loads in the browser, as DevTools' network panel or the browser tool's request list shows it (the conversation stream, the thread data).
- **Not allowed:**
  - calling an engine's endpoints yourself;
  - scripting, repeating or batching queries;
  - signing in, creating an account or solving a CAPTCHA;
  - more than a handful of questions per engine in one sitting.
- Copy no answer text into the person's site. Use what you learn, in their words.

## What to ask (about six questions)
1. **Brand:** "What is <name>?" and "What is <domain>?". Does it know them, and does it mix them up with something of the same name?
2. **Category:** two or three questions a customer asks before they know the brand, in their words. Take them from Q-site-04's questions in PRODUCT.md, or ask the owner once.
3. **How-to:** one question the product answers, phrased the way a person types it.

## What each engine shows (checked 2026-11-07)
| Engine | Logged out? | Shows |
|---|---|---|
| ChatGPT | Yes | The answer and its sources. The conversation stream also carries the entity it resolved (its name, category and a one-line description), any image search it ran, and every source it read. Its typed web searches run on OpenAI's servers and do not reach the browser |
| Perplexity | Yes | The answer, its sources, and the steps it took. The thread data the page loads (`/rest/thread/<id>`) carries the exact searches, every source URL and the follow-up questions it suggests |
| Claude | No: claude.ai needs a sign-in | Skip it. Never sign in for this |
| Google AI Overviews | Shown in Search when Google chooses | The sources linked in the overview. Logged out, in the person's region |

Engines change. When one shows less or more than this table, note it in the report and update this file.

## Record, per question and engine
- the searches it ran, verbatim, or "not shown";
- the sources it read, our pages first;
- whom it named, in order;
- the suggested follow-up questions;
- whether the answer was right about us.

## Worked example: OpenDesigner (2026-11-07)
**Brand questions found us.**
- ChatGPT resolved the entity "OpenDesigner, software, open-source AI-powered design system generator". It read 8 of our pages plus AlternativeTo and GitHub, and also a Thai company with the same name.
- Perplexity read 7 of our pages, the repo, the CHANGELOG and HOW-IT-WORKS.
- Perplexity suggested five follow-ups: install, the files it creates, Tailwind, the setup questions, and how agents use DESIGN.md.

**Category questions mostly missed us.**

| Question | Engine | Searches | Us? | Used instead |
|---|---|---|---|---|
| Open-source tool to create a design system for an app built with Claude Code or Cursor | ChatGPT | not shown | Yes, second | UI UX Pro Max first, plus awesome-lists and directories |
| The same | Perplexity | "open source design system tool Claude Code Cursor design tokens Storybook" and two more | No | A repo, a vendor's "best design tools for Claude Code" roundup, an awesome-list, Figma's generator pages |
| How do I make my vibe-coded app look professional? | Perplexity | the question verbatim | No | Guides whose URL and title repeat the question |
| How do I write a DESIGN.md so Claude Code or Cursor follows it? | Perplexity | "Claude Code CLAUDE.md design system documentation official" and three more on Cursor rules | No | Only the official Claude Code and Cursor docs |

### A second run: five questions in one person's own ChatGPT (2026-11-07)
The owner asked five questions in their own, signed-in ChatGPT and exported the chat; the export stays private. Signed in, answers can be personal, so treat it as one more sample, not the logged-out view.
- **"Which open-source tool keeps every screen consistent with Claude Code or Cursor?"** We were named first. Our title, repository description and docs use those exact words.
- **"Best free AI design-system generator for developers?"** We were first of three, described much as our introduction page describes us.
- **"How do I make a vibe-coded app look professional?"** We appeared only in a table of tools. The answer itself was steps it could quote: a checklist, products worth studying, a prompt of quality rules, and a build, look, critique and fix loop. Our guide doesn't present our own flow as such steps.
- **"How do I give Cursor my design tokens so every screen matches?"** We were not named. The answer wanted things to copy: a file tree, a tokens file, a ready Cursor rule that says "read DESIGN.md first", a first prompt that audits, and a page that shows every token. We have all of these (the overview page is that page), but our Cursor guide does not lead with them.
- **"A Claude skill that builds a design system and checks contrast?"** We were mentioned only in passing. Its main point, contrast checked on real text and background pairs, including hover and pressed fills and dark mode, is what our engine does, but no page says so in one quotable sentence. People say "Claude skill"; our pages mostly said "plugin".

The engine also repeated our own notes on how early the project is. Honest limits get quoted too.

**The lesson.** Answer engines quote pages that:
- answer the question directly, in the asker's words;
- give something to copy: a file tree, a rule file or a prompt;
- say each capability in one plain sentence.

A tool page that only describes itself wins "which tool" questions and loses "how do I" questions to general advice.

What both runs led to is in `fixes.md`.
