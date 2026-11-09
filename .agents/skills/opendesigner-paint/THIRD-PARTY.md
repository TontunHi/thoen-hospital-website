# Third-party code in this skill

`engine/`, `styles/`, `scripts/new-film.sh` and these references are vendored from **generative-painting-skills**:
- `references/painting-workflow.md` (upstream `SKILL.md`)
- `adding-a-style.md`, `choosing-and-mixing-styles.md`, `drawing-kit.md`, `editing.md`, `experimenting.md`, `motion-in-the-medium.md`, `sound.md`, `verifying.md`, `widescreen-and-titles.md`
- the example images

| | |
|---|---|
| Source | https://github.com/ckryptickunal/generative-painting-skills (the README's own clone address names github.com/debuu0007/generative-painting-skills) |
| Commit | `1ff8212779985e573507ebd51e5da080605af48d` (2026-09-28) |
| Author | Divyanshu Kumar, per the git history; the LICENSE names "generative-painting-skills contributors" |
| Licence | MIT, reproduced below. OpenDesigner's own code is MIT too |
| Runtime libraries | p5.js 2.3.3 (LGPL-2.1) and p5.brush 2.2.3 (MIT) by Alejandro Campos, installed from npm into each film project. They are not stored here and not embedded in frames |
| Vendored | 2026-10-04, by owner decision (`_coordination/DECISIONS.md`) |

## What OpenDesigner changed
- **Left out three paintings:** the upstream `styles/watercolour/scene-library/` 06 hibiscus canopy, 08 ornament grid and 20 field journal. They port hand-written sketches by unnamed authors, so their licence is unconfirmed. The other 35 paintings are included. Upstream marks 16 of them as reconstructions of one earlier film; OpenDesigner uses them for structure only (`../SKILL.md`). `archetypes.md`, `STYLE.md` and `references/drawing-kit.md` say so where they named the three.
- **Left out four images** that show paintings in those unattributed slots (owner decision 2026-10-14): `styles/watercolour/examples/beautiful-collisions-contact.jpg` (shots 06, 08 and 20 are the three ported sketches), `styles/watercolour/examples/tidal-collisions-contact.jpg` (the ocean edition, whose shots 06, 08 and 20 fill the same slots), and `styles/pointillism/examples/translation-plates-side-by-side.jpg` and `translation-watercolour-vs-pointillist.jpg` (both show those ocean shots). The watercolour and pointillism `STYLE.md`, `references/painting-workflow.md` and `../SKILL.md` now point to the mixed films in `references/` instead.
- **Pinned versions:** `engine/package.json` pins `playwright` 1.49.1 and `vite` 6.4.3 (upstream used `^1.49.0` and `^6.0.0`).
- **A lockfile** (owner decision 2026-10-14): `engine/package-lock.json` pins all 88 packages, each from registry.npmjs.org with a sha512 integrity hash, made with `npm install --package-lock-only` from the pinned manifest. Installs use `npm ci` (`scripts/new-film.sh`, `styles/pointillism/translating.md`, `references/painting-workflow.md`); upstream had no lockfile and used `npm install`.
- **Manifest fix:** `engine/scripts/export.mjs` now writes `manifest.json`'s `material` from the film's `STYLE`. Upstream wrote "pointillist translation" for every film.
- **Film ids checked:** `scripts/new-film.sh` refuses film ids other than lowercase letters, digits and hyphens. Upstream pasted the id unescaped into `sed` and `film.js`.
- **Smaller images:** example images over 300 KB were re-encoded at JPEG quality 72 (sips), and those wider or taller than 1600 px resized to 1600 px on the long edge. `ocean-of-points-contact.jpg` keeps its 1450 px.
- **A guide, not a skill:** upstream `SKILL.md` is now `references/painting-workflow.md`, with a header note and an updated scaffold step. Agents reach it through `opendesigner-paint`.
- **Left out entirely:** both upstream `README.md` files (repository and skill), `install.sh`, `CONTRIBUTING.md` and `docs/banner.jpg`.

To update from upstream:
1. Review the new upstream commit as you would a pull request (`.claude/skills/od-pr-review/SKILL.md`).
2. Copy the changed files.
3. Re-apply the changes above.
4. Move the commit in this file and in `scripts/paint.py` (`VENDORED`).

## Licence (upstream LICENSE, verbatim)

```
MIT License

Copyright (c) 2026 generative-painting-skills contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
