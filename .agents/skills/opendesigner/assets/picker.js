/* OpenDesigner variant picker: the floating switch for showing 2 to 5 options on a review copy of a real page.
 *
 * Built verbatim from the house picker spec (references/standards: STD-process-review-taste-44 to -46 and
 * STD-accessibility-motion-18). Its look is fixed chrome: never restyle it with the project's tokens, fonts or colors.
 * Change only the variant names and count, and data-od-position="top" when a variant fills the bottom centre.
 *
 * Use (one self-contained review page, or a review route; never the live product, STD-process-review-taste-41):
 *
 *   <div data-od-stage>                                   where the chosen variant is drawn
 *     <template data-od-variant="Today">...</template>    keep the current version as an option (making.md section 3)
 *     <template data-od-variant="Calmer">...</template>
 *     <template data-od-variant="Denser" data-od-motion>...</template>   data-od-motion: it has an entrance worth replaying
 *   </div>
 *   <script src="picker.js"></script>
 *
 * Keys: 1 to N pick a variant, left and right arrows step (wrapping), R replays. Keys are ignored while typing in a field
 * or with Cmd, Ctrl or Alt held. The choice is kept in the address as ?v=2 (1-based). Every switch and replay re-mounts the
 * variant, so its entrance runs again; the swap itself is instant, and only the picker's highlight slides.
 */
(function () {
  "use strict";
  var CSS = [
    ".proto-picker{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:2px;padding:4px;margin:0;border:0;border-radius:999px;",
    "background:rgba(10,10,10,0.82);-webkit-backdrop-filter:blur(12px) saturate(1.4);backdrop-filter:blur(12px) saturate(1.4);",
    "box-shadow:0 0 0 1px rgba(255,255,255,0.08) inset,0 8px 24px rgba(0,0,0,0.24),0 2px 6px rgba(0,0,0,0.12);",
    "font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;font-size:13px;font-weight:400;line-height:1;letter-spacing:normal;text-transform:none;box-sizing:border-box}",
    ".proto-picker[data-position=\"top\"]{top:24px;bottom:auto}",
    ".proto-picker .proto-picker-highlight{position:absolute;top:4px;left:0;height:28px;width:0;border-radius:999px;background:rgba(255,255,255,0.12);pointer-events:none}",
    ".proto-picker[data-ready] .proto-picker-highlight{transition:transform 250ms cubic-bezier(0.23,1,0.32,1),width 250ms cubic-bezier(0.23,1,0.32,1)}",
    ".proto-picker .proto-picker-item,.proto-picker .proto-picker-replay{position:relative;z-index:1;display:inline-flex;align-items:center;height:28px;margin:0;padding:0 12px;border:0;border-radius:999px;",
    "background:none;color:rgba(255,255,255,0.55);font:inherit;line-height:1;letter-spacing:inherit;white-space:nowrap;cursor:pointer;-webkit-appearance:none;appearance:none;transition:color 150ms ease-out}",
    ".proto-picker .proto-picker-item:hover,.proto-picker .proto-picker-replay:hover{color:rgba(255,255,255,0.85)}",
    ".proto-picker .proto-picker-item[data-active]{color:#fff}",
    ".proto-picker .proto-picker-item:active,.proto-picker .proto-picker-replay:active{transform:scale(0.97)}",
    ".proto-picker .proto-picker-item:focus-visible,.proto-picker .proto-picker-replay:focus-visible{outline:2px solid rgba(255,255,255,0.4);outline-offset:2px}",
    ".proto-picker .proto-picker-divider{width:1px;height:16px;margin:0 4px;background:rgba(255,255,255,0.12)}",
    ".proto-picker .proto-picker-replay{padding:0 10px;font-size:14px}",
    "@media (prefers-reduced-motion:reduce){.proto-picker[data-ready] .proto-picker-highlight{transition:none}}"
  ].join("");

  function init(stage) {
    var templates = Array.prototype.slice.call(stage.querySelectorAll(":scope > template[data-od-variant]"));
    if (templates.length < 2) return null;  // one option is not a choice
    var names = templates.map(function (t) { return t.getAttribute("data-od-variant"); });
    var motion = templates.some(function (t) { return t.hasAttribute("data-od-motion"); });
    if (!document.getElementById("od-picker-css")) {
      var style = document.createElement("style");
      style.id = "od-picker-css";
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    var nav = document.createElement("nav");
    nav.className = "proto-picker";
    nav.setAttribute("aria-label", "Prototype variants");
    if (stage.getAttribute("data-od-position") === "top") nav.setAttribute("data-position", "top");
    var hl = document.createElement("span");
    hl.className = "proto-picker-highlight";
    hl.setAttribute("aria-hidden", "true");
    nav.appendChild(hl);
    var items = names.map(function (name, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "proto-picker-item";
      b.textContent = name;
      b.addEventListener("click", function () { pick(i); });
      nav.appendChild(b);
      return b;
    });
    if (motion) {
      var div = document.createElement("span");
      div.className = "proto-picker-divider";
      div.setAttribute("aria-hidden", "true");
      var replay = document.createElement("button");
      replay.type = "button";
      replay.className = "proto-picker-replay";
      replay.setAttribute("aria-label", "Replay animation (R)");
      replay.textContent = "↻";
      replay.addEventListener("click", function () { mount(current); });
      nav.appendChild(div);
      nav.appendChild(replay);
    }
    document.body.appendChild(nav);

    var current = 0;
    var v = parseInt(new URLSearchParams(location.search).get("v"), 10);
    if (v >= 1 && v <= names.length) current = v - 1;

    function slide() {
      var a = items[current];
      hl.style.width = a.offsetWidth + "px";
      hl.style.transform = "translateX(" + a.offsetLeft + "px)";
    }
    var frame = 0;
    function clear() {
      Array.prototype.slice.call(stage.childNodes).forEach(function (n) {
        if (!(n.nodeType === 1 && n.tagName === "TEMPLATE")) stage.removeChild(n);
      });
    }
    function mount(i) {  // clear the stage, then draw on the next frame so entrances run again
      cancelAnimationFrame(frame);  // two switches in one frame draw only the last one
      clear();
      frame = requestAnimationFrame(function () {
        clear();
        stage.appendChild(templates[i].content.cloneNode(true));
        stage.dispatchEvent(new CustomEvent("od:variant", { detail: { index: i, name: names[i] } }));
      });
    }
    function pick(i) {
      current = (i + names.length) % names.length;
      items.forEach(function (b, j) {
        if (j === current) { b.setAttribute("data-active", ""); b.setAttribute("aria-current", "true"); }
        else { b.removeAttribute("data-active"); b.removeAttribute("aria-current"); }
      });
      var url = new URL(location.href);
      url.searchParams.set("v", String(current + 1));
      history.replaceState(history.state, "", url);
      slide();
      mount(current);
    }
    document.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= names.length) { pick(n - 1); }
      else if (e.key === "ArrowRight") { pick(current + 1); }
      else if (e.key === "ArrowLeft") { pick(current - 1); }
      else if (e.key === "r" || e.key === "R") { mount(current); }
      else return;
      e.preventDefault();
    });
    window.addEventListener("resize", slide);
    pick(current);
    requestAnimationFrame(function () { requestAnimationFrame(function () { nav.setAttribute("data-ready", ""); }); });
    return { pick: pick, names: names };
  }

  function start() {
    var stage = document.querySelector("[data-od-stage]");
    if (stage) window.odPicker = init(stage);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
