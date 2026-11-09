# Capturing a page for review

Source ids (`S-R5-nnn`) are in `cases.md` ("Sources") and `traces/R5-trace.md`. **tested** means it was run in this lane (Chrome 153, Playwright 1.58, macOS, 2026-09-29) and, except where said, is kept as a test in `scripts/test_probe_live.py` (class `ClaimsWeRelyOn`). **inferred** means reasoned, not observed. Tools change: if a tool no longer has a feature named here, use the nearest one and say so.

## Pick a route

| You have | Route | One page costs |
|---|---|---|
| A shell, Playwright for Python, and the app running locally | `capture.py` (ask before installing Playwright; it opens local addresses only) | one command for the whole plan |
| Any browser tool that can evaluate JavaScript (in-app browser, Claude in Chrome, Chrome DevTools MCP, Playwright MCP) | `review.py serve` in the background, then the one-line loader | one short call; the result goes to disk, not into your context |
| The same, but the page's security policy blocks scripts from 127.0.0.1 | paste `probe.js` (`review.py probe --print`), about 45 KB | one very long call: do it once per page and avoid reloading |
| Screenshots only | ask for the person's console output of `probe.js`; mark what you could not do `blocked` | the review is INCOMPLETE by construction |

### The `serve` route (browser tools)
```
review.py serve --dir opendesigner/review            run it in the background; it prints the loader, one line
```
Per page, evaluate the printed line with your browser tool, after changing `NAME` to `route-width-theme` (for example `home-390-light`). It loads `probe.js` from the helper, runs it, and posts the result to the helper, which writes `opendesigner/review/probes/home-390-light.json`. You get back one short line. The helper listens on 127.0.0.1 only, under a random path, serves only `probe.js`, and saves only probe results and capture documents (`kind: focus | hover | console | vitals | fonts`) into the review folder. It stops after an hour. After a reload `window.__od` is gone: run the loader again. Afterwards `__odSave('focus-home-390', __od.focusDoc())` saves a Tab walk the same way.

## What every route must do (all tested unless marked)

**Be on the right page.** Reload fresh. Wait for the load event and `document.fonts.ready`. Do not use "network idle": Playwright's own docs discourage it (S-R5-067). `fonts.ready` resolves when the fonts requested so far have loaded; fonts requested later can still swap in (S-R5-087 and the CSS Font Loading draft, S-R5-100). Check the URL, the title and a build marker. Dismiss cookie banners and dialogs on purpose, and say so in the report.

**Scroll, then take viewport-sized shots.** A full-page screenshot never scrolls: Playwright measures the page and captures beyond the viewport (S-R5-081). So lazy images far down are never requested, scroll-reveal sections stay hidden, fixed headers appear once at the top, and inner scroll areas are not expanded. In this lane's test Chrome wrapped a full-page PNG taller than 16,384 device pixels, repeating the top of the page with no error (tested once on 2026-09-29, not kept as an automated test); a related Playwright bug returns an empty file for WebP above 16,383 px (S-R5-083). Scroll in steps of about 85% of the viewport with a short wait, then shoot each step. Use `scale: "css"` so file sizes stay in CSS pixels.

**Keep tiles small enough to read.** Claude downsizes large images and says small detail is lost (S-R5-002, S-R5-003). Worked through Anthropic's reference function in this lane, a 1440 x 8000 page shrinks to about 464 x 2576 on the newest tier, so 16 px text is drawn at about 5 px and a 1 px border at about 0.3 px. Send tiles of 1440 x 900 or smaller, and 2x crops of small details. Over 20 images in one request, each must be 2000 px or smaller (S-R5-002). Check the docs for current limits.

**Use a real phone profile for phone widths.** Playwright's `isMobile` makes the context honour `<meta name="viewport">` (S-R5-055); a plain narrow desktop window does not, and with `isMobile` and no meta tag the layout width was 980 px (tested; S-R5-086). Set touch, pixel ratio 2 or 3 and mobile together. On a phone profile `(hover: hover)` is false and `(pointer: coarse)` true.

**Force the state you want to see.**
- Hover: move the real pointer to the element (Playwright `hover()`, or the tool's hover). Playwright has no API to force `:hover` or `:active`; CDP `CSS.forcePseudoState` does, on Chromium (S-R5-060). The pointer stays where it was: move it to (0, 0) before the next shot (S-R5-084).
- Focus: press Tab. `:focus-visible` is true after keyboard use and false after a mouse click on another control (S-R5-085), so do not click first.
- Dark mode, reduced motion, forced colors, contrast, print: Playwright `emulateMedia` sets all of them (S-R5-099; `contrast` needs Playwright 1.51 or later). Chrome DevTools MCP's `emulate` sets color scheme, viewport (with mobile and touch flags), user agent and throttling, but not reduced motion, forced colors or print (S-R5-019). For OpenDesigner CSS you can set `data-theme`, `data-density` and `data-motion` on `<html>` in the page: `__od.setMode({theme: 'dark', motion: 'reduced'})`.
- Safe-area insets: no Playwright API; the experimental CDP command `Emulation.setSafeAreaInsetsOverride` (S-R5-060) set `env(safe-area-inset-top)` to 47 px (tested), and the page needs `viewport-fit=cover` (S-R5-086; `env()` is S-R5-050).
- On-screen keyboard: a desktop browser has none. Shrink the viewport height to about half and confirm the focused input and its submit button stay visible (inferred; S-R5-051 describes the real API).

**Find out which font was really drawn.** `document.fonts.check()` returns true even for a family that does not exist (S-R5-054), and a width test can be fooled by a similar fallback. In Chromium, CDP `CSS.getPlatformFontsForNode` returns the font that was drawn: `capture.py` does this and `review.py check` reads it. Without CDP, use the probe's `fonts.familyState` and the network tab for a 404 on the font file.

**Read the console and the network** while the page loads and scrolls. A failing request is often the cause of a visual defect.

## Tools
- **In-app browser (Claude desktop).** Open your own tab (`tabs_create`): it is shared with other agents and the person. `resize_window` presets: mobile 375 x 812 (also emulates a touch phone: width under 768 does), tablet 768 x 1024; custom sizes need width and height; `colorScheme: light | dark`. Reset to `desktop` when you finish. `javascript_tool` evaluates with top-level `await`. `browser_batch` runs a sequence in one round trip: a Tab press, then `__od.focus()`, repeated, is one call. It has no reduced-motion or forced-colors emulation: use `__od.setMode({motion: 'reduced'})` on OpenDesigner CSS, otherwise mark those cells `blocked`.
- **Claude in Chrome.** The person's real, visible Chrome with their logins and fonts. A JavaScript `alert` blocks it (S-R5-089). Review only local or staging pages with it, and never act on an account.
- **Chrome DevTools MCP.** `take_screenshot`, `evaluate_script`, `get_css_styles` (matched rules), `list_console_messages`, network tools, `lighthouse_audit`, performance traces, `emulate` (above) (S-R5-019).
- **Playwright MCP.** `browser_evaluate`, `browser_run_code_unsafe` (raw Playwright, so CDP is reachable), `browser_emulate_media`, `--device`, `--mobile`, hover, console, network (S-R5-088). Its accessibility snapshot lists roles and names but is not a visual check: use it together with screenshots (S-R5-020).
- **Playwright script.** `capture.py` is a worked example of all of the above.
- **Native apps.** `probe.js` does not apply. Use the simulator's screenshot and accessibility tools, the system's dark mode, the largest text size, reduce motion, and a screen reader's names. Say what you could not measure.

## Things that go wrong in capture
- A screenshot of the wrong page: a cached build, another port, a login wall, a framework error overlay (`cases.md` CV-09).
- Playwright's `animations: "disabled"` (the default for `toHaveScreenshot`, not for `page.screenshot`) fast-forwards finite animations to their end and resets infinite ones to the start, so you never see the middle (S-R5-067).
- Negative-margin overflow to the left never raises `scrollWidth` (tested). The probe checks each element's box, not only the page width.
- `getAnimations()` forgets a finished transition (tested). Read `__od.motion()` right after the trigger.
- Playwright counts an `opacity: 0` or off-screen element as visible (S-R5-015). A control being "in the DOM" is not the same as being seen or reachable: `__od.at(x, y)`.
- Renders differ by OS, browser and version (S-R5-022). Say which one you used.
