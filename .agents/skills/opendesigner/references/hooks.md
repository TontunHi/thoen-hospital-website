# Designer hooks and tool hooks

Some blocks need a human maker or a named tool. OpenDesigner asks for them instead of faking them. Source: `research/L17-how-systems-get-made.md` Part H (formats, fallbacks and checks, verified against 81 Tier A pages). `hooks.json` has the full detail for each hook: exact sizes, licence terms and evidence ids.

## Rules for every hook
1. **Ask once, as one checklist** (Q-brand-08), when the person zooms into brand or imagery. Say: "Which of these do you already have?" At levels 0 and 1, ask only about a brand color or logo. Everything else keeps its fallback and a briefed placeholder. An internal work tool with no brand may not need the brand-only hooks: sound, haptics, photos, illustration, motion and motif. Offer to mark them `not-needed` in one step, so they stop showing as open.
2. **If they have it,** accept the master formats in the tables below.
3. **If they don't,** offer these paths in order:
   - a designer, with a written brief
   - an open library, with its licence
   - a named tool, with its caveats
   - none
   Each hook's row lists its own options.
4. **One vector master, generated derivatives.** Ask for the master: SVG, or PDF with outlined text; layered files for app icons. Derive the platform sizes from it, with size and safe-zone checks.
5. **Keep a licence ledger per asset:** source, licence, attribution string, allowed slots and owner. Keep MIT, ISC and Apache notices for icon libraries, and add required credits. Block an asset from any slot its licence forbids (for example, some free illustration sets cannot be used in logos).
6. **Fetch per project; never pool assets** into a shared catalog. Several licences forbid offering their assets as a library to pick from inside a tool.
7. **When you suggest an AI tool,** state its terms for the person's plan (`guardrails.md` section 3).
8. **The commission path ships a brief** (below): required files and sizes from `hooks.json`, plus the system's tokens and direction. Remind the person that a contractor's logo needs a written copyright assignment.
9. **Label placeholders as placeholders.** Never present a generated stand-in as final.

Record each hook with `engine.py set hooks.<H-id>.status '"<status>"' --why "..."`. The status is `have`, `commissioning`, `tool`, `open-library`, `placeholder` or `not-needed`. It stays `pending` until asked. Use `--set-by asset` for values derived from a supplied asset.

The **Ask** and **Question** columns are what you say to the person, in plain words. Ask about one hook per message, except in the Q-brand-08 checklist.

## Asset hooks
| Hook | Ask | Master format | If no (in order) |
|---|---|---|---|
| `H-logo` (Q-brand-03) | Do you have a logo? Which parts: the name written out (wordmark), a symbol, both together? A one-color version? | SVG or PDF, text outlined | Commission (brief + assignment reminder); AI logo tools with caveats and a trademark search; wordmark in the chosen typeface |
| `H-appicon` (Q-icon-06) | Do you have app icon artwork? Separate layers are best. | Layered SVG/PDF (Apple Icon Composer), adaptive layers (Android), PNG for stores | Designer; Icon Composer; Android Studio Image Asset; Maskable.app |
| `H-favicon` (with the logo) | Asked with the logo | Master SVG | Generated from the symbol: favicon.ico 32, icon.svg with dark-mode query, apple-touch 180, manifest 192/512 + maskable |
| `H-icons` (Q-icon-01) | Do you have your own icons, or icons that free icon sets don't have? | SVG on the library grid, SF Symbol templates, Android vector drawables | A few of their own: glyphs from the closest open set, drawn in their construction (badge, glyph box, line, colour) and shown beside them for a yes (opendesigner-illustrate, `illustrate.py icons`); Lucide, Phosphor, Tabler, Heroicons, Material Symbols (keep notices); custom icons on the 24 px keyline; commission pictograms |
| `H-illus` (Q-img-04) | Do you have illustrations, or a drawing style or character? | Master SVG, Lottie for animation | Commission; open sets with their exact terms (the **opendesigner-illustrate** skill finds, recolors and applies them with a licence ledger); AI vector tools with plan terms; original art painted in code (**opendesigner-paint**); or no illustration and honest text empty states |
| `H-photo` (Q-img-01) | Do you have photos, or a photo style to follow? | Highest-resolution originals | Commission; Unsplash or Pexels under their licences (opendesigner-illustrate, `illustrate.py photos`); an AI image: tell the person once, keep the file's own provenance data, never caption it "AI generated" on the page |
| `H-type` (Q-type-02) | Do you have a brand font? Does its licence cover websites, apps and hosting the files yourself? | OTF/TTF masters, WOFF2 for web | Google Fonts (OFL/Apache, self-host OK); Fontshare (no subsetting or conversion, not offerable in a design tool's picker); Adobe Fonts (web embed only, no self-hosting or app embedding); buy the needed licences |
| `H-color` (Q-color-01) | Do you have brand colors that must match exactly? | Hex, RGB, OKLCH, Pantone refs, Figma variables | Candidates from the logo or brand book; otherwise seeds from the personality dials, labelled a starting point |
| `H-motion` (Q-img-06) | Do you have any animation: a moving logo, loading animations, animated drawings or 3D? | Lottie / dotLottie, Rive, glTF/GLB, USDZ | Commission a motion designer; a film or loop painted in code in the brand palette (**opendesigner-paint**, with the person's OK for its npm and Chromium installs); otherwise motion tokens only, no signature animation |
| `H-motif` (Q-img-07, Q-shape-05) | Do you have brand patterns, textures, color blends or a signature shape? | SVG patterns, gradient definitions | Commission; painted grounds and textures in the brand palette (**opendesigner-paint**); or none (decoration standing in for content reads generic) |
| `H-sound` (Q-motion-08) | Do you have app sounds, or a short sound for your brand? | Apple: .aiff/.wav/.caf under 30 s; Android: Ogg, WAV, MP3, AAC, FLAC | Commission; platform system sounds; or no sound |
| `H-haptic` (Q-motion-09) | Do you have your own vibration patterns? | Apple AHAP, Android VibrationEffect | System patterns first |
| `H-voice` (Q-voice-01) | Do you have a guide for how your product writes, or a word list? | PDF, Markdown, existing product copy | Model drafts voice from the personality answers, marked draft until a content designer or owner reviews it |
| `H-brandbook` (Q-ref-01) | Do you have a brand book? | PDF | Hand to opendesigner-extract: colors, font names, embedded logos; ask for the SVG master of any logo found |

**Brand font licence, per platform.** When they name a brand font, record what its licence covers with `engine.py pick Q-type-02 yes|web-only|app-only|license-only|no --why "<their words>"`. For any other mix, set it directly: `engine.py set raw.fontLicence '{"web": true, "app": false, "selfHost": true}'`. Name the font with `engine.py set raw.brandFace '"<font name>"'`. Then say in one line what it means for each platform in scope. For example: "Your licence covers websites only, so the iPhone app will use the system font."
The Swift and Compose exports fall back to the system font by themselves when `app` is not true. If they don't know what the licence covers, record nothing, and list it as an open item: never guess.

## Tool hooks
| Hook | Question | Named tools | Caveat |
|---|---|---|---|
| `H-tokens` | Which apps and platforms will use the design tokens, and how do you ship code packages? | Style Dictionary, Terrazzo, Tokens Studio | Only about 40% of teams automate token sync; Figma imports DTCG only partly |
| `H-figma` | Which design tool do you use, and on which plan? (Q-tool-03) | Figma remote MCP `use_figma`, Tokens Studio, Paper MCP, Penpot (native DTCG) | Figma modes per collection depend on plan; Code Connect is plan-gated |
| `H-comp` | Which component library or code stack do you build with? | Radix, Base UI, React Aria, shadcn registry | Review against the WAI-ARIA Authoring Practices |
| `H-dataviz` | Do you show charts? If so, which chart library? | Chart libraries per L05 | Library defaults override tokens unless themed |
| `H-a11y` | Who tests the app with screen readers and other assistive tools? | axe-core and lint rules, plus human screen-reader passes | Automated tools catch only part of WCAG |

## Brief for a missing asset (fill it in and give it to the person)
```
Asset: <hook name>            Needed by: <date or milestone>
Files: <formats and sizes from hooks.json>
System: <link to DESIGN.md>; palette <accent + neutrals>; type <faces>; radius <control/container>
Direction: <the chosen direction in one line>; memorable thing: <from Q-brand-02>
Constraints: <licence, platforms, dark mode, reduced motion>
Rights: written copyright assignment to <owner> on delivery
```
