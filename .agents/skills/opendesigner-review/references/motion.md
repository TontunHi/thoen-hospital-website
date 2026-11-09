# Reviewing things that move

A still image cannot show a movement. A review of motion needs frames you chose, numbers about timing, and a second run with reduced motion on. Source ids are in `cases.md`. **tested** = run in this lane (Chrome 153, 2026-09-29; kept in `scripts/test_probe_live.py`, class `ClaimsWeRelyOn`, except the ffmpeg contact sheet); **inferred** = reasoned, not observed.

## 1. Inventory: what moves, and how
```
__od.motion()
```
returns `animations` (every running CSS animation, CSS transition and Web Animation: its target, duration, delay, iterations, easing, play state, the properties it changes, and whether it is driven by time or by scroll), `transitionDurations` and `declared` (what the stylesheets say will move, which finds transitions that have not fired yet), `reducedMotionRules`, and `libs` (GSAP, Lottie).

Limits you must state in the report:
- `document.getAnimations()` lists CSS animations, CSS transitions and Web Animations (S-R5-058). A **finished transition disappears** from the list (tested; wait for `transitionend`, not a fixed delay), so read it right after the trigger.
- It does not list canvas, WebGL, video, SVG SMIL, GIF, or motion driven by `requestAnimationFrame` (DevTools' animation panel misses the last for the same reason, S-R5-061). For Motion's spring and JS-driven values the docs are silent; they probably do not appear (inferred, S-R5-065).
- Scroll-driven animations (`animation-timeline: scroll()` or `view()`) report a `ScrollTimeline` and a percent `currentTime` (tested, S-R5-062).

## 2. Frames you choose
Pause and seek instead of waiting. MDN says `currentTime` can be set "whether running or paused" (S-R5-059); in this lane's tests a paused animation stayed paused, the frame updated, and the computed style at that moment was repeatable (a transform read 25.8 px at 500 ms and 100 px at 1000 ms).
```
__od.seek(0)   screenshot      __od.seek(0.25)   screenshot      0.5      0.75      1
__od.seekTime(1)               SVG SMIL and <video> to a time in seconds (S-R5-066)
__od.play()                    resume
```
`seek(f)` pauses every CSS and Web Animation at fraction `f` of its run (a looping one at `f` of one loop), and also tries the GSAP timelines and Lottie players it finds, through their documented calls (GSAP `getChildren()`, `pause()`, `progress()`; Lottie `goToAndStop`, S-R5-063, S-R5-064). Tested on 2026-10-04 with gsap 3.15.0 and lottie-web 5.13.0 from npm: a looping GSAP tween read 8, 58, 108 and 208 px at f = 0, .25, .5 and 1, Lottie reached its last frame at f = 1, and `play()` resumed both. That test needs the npm packages, so it is not kept in the suite. A recommended set is 6 to 12 frames: the first, the first change, 25%, 50%, 75%, the end, one more loop, and one interrupted run [inferred]. Cells of 320 to 480 px wide keep a filmstrip readable [inferred].

Claude reads still frames only. An animated GIF or WebP is read as its first frame, each image costs about ceil(width/28) x ceil(height/28) tokens, and a request over 20 images needs each at 2000 px or smaller (S-R5-002). Label each frame ("frame 3, t = 50%"). For a real recording: Playwright `recordVideo` writes a file only after the context closes (S-R5-068), at 25 fps by default (`recordVideo.fps`, S-R5-067); then `ffmpeg -i clip.webm -vf "fps=5,scale=320:-1,tile=5x2" -frames:v 1 sheet.png` makes a 5 x 2 contact sheet (tested).

For motion the page cannot list (canvas, WebGL, GIF): capture on a timer and look. Say plainly that it was judged by eye.

## 3. Measured checks
| Check | How | Standard |
|---|---|---|
| Starts on its own, runs over 5 s beside other content, with no pause control (unless essential) | `declared.infiniteDeclared`; `iterations: infinite`; duration x iterations over 5000 ms | WCAG 2.2.2, level A (S-R5-075) |
| Flashes more than 3 times in any one second, unless below the general and red flash thresholds | frames at 25 fps are enough to see 3 Hz [inferred] | WCAG 2.3.1, level A (S-R5-076) |
| Motion from interaction (parallax, scroll effects) cannot be turned off | `reducedMotionRules`, and the reduced-motion run below | WCAG 2.3.3, level AAA; the house floor treats it as required (S-R5-077) |
| UI transition over 300 ms | `transitionDurations` | house standard STD-easing-duration-06; Material motion tokens run 50 to 1000 ms (S-R5-069); NN/g: about 100 ms feedback, 200 to 300 ms modals (S-R5-070); Apple's guidelines give no numbers (S-R5-071) |
| Layout properties animated (width, height, top, left, margin), `transition: all` | `declared.layoutProps`, `declared.transitionAll` | animate transform and opacity (S-R5-072) |
| Layout shift while loading; long frames | `await __od.vitals()` on a fresh load: layout shift 0.1 or less is good (S-R5-074); a frame over 50 ms is a long animation frame (S-R5-073) | Core Web Vitals |

## 4. Reduced motion: run it twice
Run the probe normally, then again with reduced motion on (Playwright `emulateMedia({reducedMotion: 'reduce'})`, or `__od.setMode({motion: 'reduced'})` on OpenDesigner CSS, or the system setting). Compare `motion.running` and the animation lists: non-essential movement should drop out. Chrome DevTools MCP's `emulate` cannot set it (S-R5-019).

## 5. Easily missed
- **Exits.** Click close, then read `__od.motion()` at once: is the element still there while it animates out? Is there an exit at all?
- **Interrupted motion.** Click again during a transition. It must not snap or stick.
- **Scroll-driven.** Scroll to 0, 25, 50, 75, 100% and shoot each.
- **View transitions and route changes.** Trigger the navigation and sample frames. `document.startViewTransition()` returns a ViewTransition whose `ready` and `finished` promises you can await (MDN: ViewTransition).
- **Carousels, toasts, banners.** Auto-rotation needs a pause control and must stop on hover and focus (S-R5-078); auto-dismiss needs another way to get the information, or a time limit control (S-R5-079).
- **Hidden tabs.** `requestAnimationFrame` calls are paused in most browsers in a background tab (MDN: Window.requestAnimationFrame): keep the tab in front.
- **Charts and counters.** Capture the first frame, wait for the library's finished event (Chart.js has `onComplete`, S-R5-080) or an empty animation list, then compare the final numbers with the data. For a canvas chart compare with a render that has animation turned off. Hover for tooltips with a real pointer.
- **Skeleton to content.** NN/g: skeletons and spinners are not needed under a second; spinners suit waits of 2 to 10 seconds, skeletons waits under 10, progress bars longer (S-R5-034). A skeleton that shows for a fraction of a second is noise [inferred]. Never show "no records" while loading (S-R5-033).
- **The tool's own pause.** Playwright's screenshot `animations: "disabled"` jumps finite animations to their end and resets infinite ones, which hides the middle (S-R5-067).
