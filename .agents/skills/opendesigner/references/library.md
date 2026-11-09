# The component library: when to offer it

The library (`assets/library/`, `scripts/library.py`) holds finished components built only on the engine's `--ds-*` tokens. It is optional. It saves the person's agent from designing a common part from scratch, but a person's own components, and their own taste, always come first. Never add a library component the person has not said yes to.

## When in the flow
- **Never during the interview.** Not in the sketch, and not while zooming into an area. The library is about building screens, not about deciding the system.
- **Offer it at the first build.** The moment is the first time the person asks for a page, a screen or a component after the system exists ("Building pages with the system" in SKILL.md, or a request for a new part in opendesigner-extend). Offer before you design that part, not after.
- **Once per project for the general offer.** Record the answer with `engine.py set profile.library '"yes"'` (or `"declined"`) `--why "<their words>"`, and read it back in later sessions. After a no, don't offer it again unless the person asks, or names a part the library has ("an audit log", "a plan picker").
- **Always on request.** "Show me the component library", "is there a ready-made table?" or "add the audit log" are answers in themselves: list or add without the offer.

## Who gets what
Read who you are talking to from `profile.voice` and the conversation (`rules.md` section 2).

**A novice** (plain voice, no design words, no components of their own): give **one** recommended pick, not a catalogue.
1. `python3 <skill>/scripts/library.py suggest --industry <their field> --style <closest style> --type <what they asked for>`. The style comes from the dials: `dense` for density 70 or more, `friendly` for roundness 70 or more with a playful feel, `technical` for devtools or monitoring, `editorial` for reading-first products, otherwise `quiet`.
2. If it prints "No component fits", say nothing about the library.
3. Otherwise one message, about 30 words: what the part is, that it already uses their colors, and the question. For example: "There's a ready-made approval panel that already uses your colors. Want me to start from it? Or I can design one from scratch." Then wait.

**An experienced designer** (designer or engineer voice, design words, a Figma file, their own components): don't offer the library as a starting point. Mention it only when **both** are true:
- the part they asked for is in the library (`library.py list --type <type>`), and
- the component's style matches their system (same style word as their dials give, and its industries include theirs or `any`).
Then one line, as a fact, not a pitch: "The library has an audit log in a technical style that matches this; want it as a base, or build it from your own parts?" If they have their own component for it, never mention the library.

## Adding one after a yes
1. `python3 <skill>/scripts/library.py add <slug> --into <their components folder>`. It copies one file and lists any `--ds-*` variable their tokens lack.
2. Missing variables: run `engine.py build` first if they have an OpenDesigner system; otherwise map each variable to the nearest token they have, and say which ones you mapped.
3. Turn the file into a component in their framework (React, Vue, Svelte or plain HTML; the files are web only, so not for SwiftUI or Compose), keeping the markup, the states and the accessibility notes in its `meta.json`. Replace the invented sample content with theirs.
4. Then do what every build ends with: `engine.py review`, and check it as rendered (`making.md`).

## Never
- Never add one silently, and never add more than the person asked for.
- Never offer more than one pick to a novice, or a catalogue to anyone who didn't ask.
- Never restyle the person's existing components to match a library one.
- Never present a library component as designed for them: it is a starting point that takes their tokens.
