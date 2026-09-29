# Thoen Hospital Website: UX/UI Upgrade & Maintenance List

Based on a code review of `thoen-hospital-website-main.zip` (Next.js 16 App Router, React 19, vanilla CSS, Prisma, Sarabun font).
Numbers below come from searching the source. Items marked **(verify)** should be confirmed in the browser before starting work.

Priority: **P1** = do first (accessibility/safety/visible bugs), **P2** = next, **P3** = nice to have.
Effort: **S** = under half a day, **M** = 1-2 days, **L** = 3+ days.

---

## 1. Accessibility

| # | Pri | Effort | Where | Finding | Recommended change |
|---|-----|--------|-------|---------|--------------------|
| A1 | P1 | S | all `*.css` | 0 uses of `:focus-visible`; 33 rules set `outline: none/0` (mostly `member/*` forms and inputs) | Add a global `:focus-visible` ring in `globals.css`. Where `outline: none` is used on inputs, replace it with a visible border or box-shadow on `:focus-visible` |
| A2 | P1 | M | `Navbar.tsx`, `Navbar.css` | Dropdowns open only on CSS `:hover`. The toggle is a `<span>` (or a link) with no `aria-expanded`, no `aria-haspopup`, and no `:focus-within` rule. Keyboard and touch users cannot reliably open submenus | Make each toggle a `<button aria-expanded aria-controls>`. Open on click/Enter/Space, close on Esc and outside click. Add `:focus-within` as a fallback |
| A3 | P1 | S | `Navbar.tsx` (RDU nested folders) | `navbar__nested-trigger` is a `<div onClick>`. It has no role, no tabindex, and no key handler | Change to `<button>` with `aria-expanded` |
| A4 | P2 | S | `globals.css`, all `*.css` | 0 uses of `prefers-reduced-motion`. Hero autoplay, skeletons, spinners and transitions always run | Add a global reduced-motion block. Disable hero autoplay when it matches |
| A5 | P1 | S | `HeroSlideshow.tsx` | Autoplays every 5 s with no pause/play control. Nothing pauses it on hover or focus. `aria-label`s are in English ("Previous Slide") on a Thai site. Slides have no `aria-roledescription="carousel"` or live region | Add a pause button, pause on hover/focus, use Thai labels, add carousel roles and `aria-live="off"` while autoplaying |
| A6 | P2 | S | `HeroSlideshow.tsx` | External slide links use `target="_blank"` for every `linkUrl`, including internal pages | Open internal links in the same tab. Add "(opens in new tab)" for external ones |
| A7 | P2 | S | `globals.css`, `Footer.css`, `page.css`, `member/news/layout.css` | `--accent-gold` (#C8A835) is used as a text color. On white it is roughly 2.4:1 contrast, below the 4.5:1 WCAG AA minimum **(verify each usage; dark backgrounds are fine)** | Use `--accent-gold-dark` (#A68B2A or darker) for text on light backgrounds. Keep the lighter gold for decoration only |
| A8 | P2 | S | small text across CSS | About 150 declarations use 0.75-0.8rem (12-13px), plus mixed px sizes (12/13/14px). Hard to read for older patients | Set a minimum of 14px for body/table text. Use the existing `--font-size-*` tokens instead of ad-hoc values |
| A9 | P2 | S | CSS (all) | 0 rules with `min-height: 40-49px`. Small buttons, icon buttons and pagination are likely below the 44px touch target | Set a 44px minimum on buttons, dropdown items and icon buttons **(verify on a phone)** |
| A10 | P2 | S | forms in `member/*` | `check-date` and login use labels and ARIA well. Other forms were not checked field by field | Audit remaining forms for `<label htmlFor>`, `autoComplete`, `inputMode`, and `aria-describedby` on errors |
| A11 | P3 | S | `layout.tsx` | No skip-to-content link | Add "ข้ามไปเนื้อหาหลัก" as the first focusable element and give `<main>` an id |
| A12 | P3 | S | `globals.css` | Icon-only elements are labelled in some places but not systematically (29 `aria-` and 14 `role=` uses across the whole app) | Sweep icon-only buttons and decorative icons (`aria-hidden`) |

---

## 2. Visual consistency & design system

| # | Pri | Effort | Where | Finding | Recommended change |
|---|-----|--------|-------|---------|--------------------|
| D1 | P1 | S | `manifest.ts` vs `globals.css` | PWA `theme_color` is `#0284c7` (blue) but the brand primary is `#0D7446` (green) | Change `theme_color` to the brand green. Also add a real 192px and 512px icon, and a separate maskable icon |
| D2 | P2 | L | all `*.css` | About 2,564 hard-coded hex colors vs about 1,785 `var(--…)` uses. The design tokens are only partly adopted | Move repeated hex values into tokens (success/warning/danger/info, surfaces, borders). Do it gradually, page by page, with a lint rule or grep check |
| D3 | P2 | L | `.tsx` files | About 455 inline `style={{…}}` blocks. They bypass tokens and make theming and responsive fixes harder | Move repeated inline styles into CSS classes. Start with the biggest files: `member/page.tsx`, `SalaryDashboardClient.tsx`, `UploadSalaryClient.tsx` |
| D4 | P2 | M | CSS media queries | Breakpoints are inconsistent: 480, 576, 600, 640, 768, 769, 900, 991, 992, 1024, 1120, 1200, 1280 | Standardize on 3-4 breakpoints (for example 640 / 768 / 1024 / 1280) and define them in one place |
| D5 | P3 | S | `src/app/page.module.css` | Leftover create-next-app file (dark-mode `.page`, `.logo` rules). It is not imported anywhere I could find **(verify)** | Delete it. It is also the only `prefers-color-scheme` rule in the app |
| D6 | P3 | M | `globals.css` | No dark mode. Not needed for the public site, but staff dashboards and TV mode might benefit | Optional: define a dark token set for internal pages and TV mode only |
| D7 | P3 | S | `Navbar.tsx` | Mourning ribbon is permanently in the navbar with hard-coded markup | Make it a config flag (for example `src/config/home.ts`) so it can be turned off without a code change |

---

## 3. Navigation & information architecture

| # | Pri | Effort | Where | Finding | Recommended change |
|---|-----|--------|-------|---------|--------------------|
| N1 | P2 | M | `Navbar.tsx` | The top bar has 9-10 items plus login, check-date and member buttons. That is crowded on 1024-1280px screens | Group secondary items (ITA, RDU, ชมรมจริยธรรม) under one menu such as "เอกสารและความโปร่งใส", or move them to the footer |
| N2 | P2 | S | `Navbar.tsx` | "การบริการ" menu links to `/package/...` while `/service` is the staff area "ระบบงานภายใน". The names are easy to confuse | Rename to make the public vs staff areas obvious, for example "แพ็กเกจและบริการ" vs "ระบบงานภายใน (บุคลากร)" |
| N3 | P2 | M | `Navbar.tsx` | `/api/rdu` and `/api/member/me` are fetched from the client after load (and `/api/member/me` again on every route change). The menu can flicker and the "ระบบงานภายใน" link pops in late | Load the RDU menu server-side (layout or cached route). Cache the session check and only re-run it when auth changes |
| N4 | P2 | S | Navbar / `page.tsx` | The most common public tasks (appointment check, contact, opening hours) are not prominent on the first screen **(verify on mobile)** | Add a quick-action row on the home page: ตรวจสอบนัด / เบอร์โทร / เวลาทำการ / แผนที่ |
| N5 | P3 | S | pages | No breadcrumbs on deep pages (`/package/...`, `/about/...`, `/news/[slug]`) | Add a simple breadcrumb component |
| N6 | P3 | S | `Navbar.tsx` | `as any` casts in the nav-link loop (`isRdu`, `folders`) | Type the nav config properly. It will also make N1 easier |

---

## 4. Forms, feedback & error handling

| # | Pri | Effort | Where | Finding | Recommended change |
|---|-----|--------|-------|---------|--------------------|
| F1 | P1 | M | `member/*` (33 uses) | Native `alert()` / `confirm()` are used for delete, logout, sync and export errors. They block the page and cannot be styled or translated | Create a shared `ConfirmDialog` and toast component (an in-app toast already exists for approvals). Use them for destructive actions and errors |
| F2 | P2 | M | `member/*` forms | Validation and error patterns are per-page | Create shared form components (Field, FormError, SubmitButton with loading state). Show inline errors next to the field |
| F3 | P2 | S | `check-date` | The 13-digit ID input works, but the input type and helper text should be checked **(verify)** | Use `inputMode="numeric"`, `autoComplete="off"`, a live digit counter, and a short privacy note that only masked data is shown |
| F4 | P2 | S | `error.tsx` files | Error boundaries exist only for `member`, `salary`, `service` and the root. Not for `news`, `package`, `systems`, `ita`, `ethics` | Add error and loading states for the missing public sections |
| F5 | P3 | S | `not-found.tsx` | 404 is good. It links to home and contact | Add a search box or links to popular pages |

---

## 5. Data-heavy staff screens (lab, beds, wards, ER, salary)

| # | Pri | Effort | Where | Finding | Recommended change |
|---|-----|--------|-------|---------|--------------------|
| S1 | P1 | S | 10 client components (`ERInStatusClient`, `WardStatusClient`, `BedOccupancyClient`, `LabTrackerClient`, `StatusOrClient`, …) | Each runs its own `setInterval` polling. None use the Page Visibility API (0 `visibilitychange` uses), so hidden tabs keep hitting the HOSxP-backed APIs | Create a shared `usePolling(fn, ms)` hook that pauses when the tab is hidden and resumes with an immediate refresh. Also cleans up 10 copies of the same code |
| S2 | P2 | M | same components | Loading, "last updated" and stale-data states differ per screen | Show a consistent "อัปเดตล่าสุด HH:MM:SS" and a stale/offline banner when a refresh fails |
| S3 | P2 | M | 20 files with `<table>` | Some pages have `overflow-x: auto` wrappers (23 CSS files), but table behavior on phones is not consistent **(verify)** | Create a shared `ResponsiveTable`. Use card layout under 640px, sticky header, and sticky first column where useful. ER already has a card/table toggle, so reuse that pattern |
| S4 | P2 | S | `ERTvModeClient`, `tv-mode/page.css` | TV mode uses rem sizes, some as small as 0.8-0.95rem | Test at real TV distance. Use `clamp()` for fluid sizes and keep contrast high. Add auto-reload and a burn-in-safe layout if it runs all day |
| S5 | P3 | S | dashboards | Triage colors and status badges may rely on color alone **(verify)** | Add text or icon alongside color for every status |

---

## 6. Performance & assets

| # | Pri | Effort | Where | Finding | Recommended change |
|---|-----|--------|-------|---------|--------------------|
| P1 | P2 | S | 8 admin files | Raw `<img>` used in `ProfileBanner`, `TelegramLinkModal`, `MemberSignatureClient`, `news/slides`, `news/create`, `news/[id]/edit` | Fine for blob previews. For real stored images, use `next/image` with `sizes`, or explicitly disable the lint warning where intended |
| P2 | P2 | S | `HeroSlideshow.tsx` | All slides render as `fill` images with `sizes="100vw"`. Only the first has `priority`, which is right, but the rest are still in the DOM | Lazy-render inactive slides. Give the hero container a fixed aspect ratio to avoid layout shift |
| P3 | P2 | S | `public/uploads/`, `public/documents/` | User uploads and PDFs live inside `public/` and in the repo, so the repo will keep growing | Move uploads outside the repo (a mounted volume, already partly handled by `/uploads/[...path]`). Add `public/uploads` to `.gitignore`. Keep only static assets in git |
| P4 | P3 | S | `layout.tsx` | Sarabun loads 6 weights (300-800) | Trim to the weights actually used (usually 400/500/600/700) |
| P5 | P3 | S | Lighthouse | Not measured yet | Run Lighthouse (mobile) on `/`, `/news`, `/package`, `/contact`, `/service/ward-status`. Save the scores as a baseline in this repo |

---

## 7. PWA, SEO & discoverability

| # | Pri | Effort | Where | Finding | Recommended change |
|---|-----|--------|-------|---------|--------------------|
| W1 | P2 | M | `manifest.ts` | A manifest exists (`display: standalone`) but there is no service worker, so it is not really installable or offline-capable | Either add a small service worker (offline page + asset caching, no API caching for patient data) or drop `standalone` if a PWA is not a goal |
| W2 | P2 | S | `src/app` | No `sitemap.ts` or `robots.ts` | Add both. Disallow `/member`, `/salary`, `/service`, `/api` in robots |
| W3 | P2 | S | 10+ public pages | Several public `page.tsx` files export no page-level `metadata` (systems, news, package, dentistry, health-check-1day, contact, ethics, check-date, …) **(verify: client components cannot export it, so split them)** | Add `metadata` (unique title and description) per page. News detail pages should also use `generateMetadata` with Open Graph image |
| W4 | P3 | S | `layout.tsx` | Structured data is missing | Add `Hospital`/`MedicalOrganization` JSON-LD (address, phone, hours) on the home and contact pages |
| W5 | P3 | S | `layout.tsx` | Inline script in `<head>` that swallows Event-type unhandled rejections | Keep only if the cause is known. Otherwise find and fix the source. Move it to a small client component |

---

## 8. Maintenance & code health

| # | Pri | Effort | Where | Finding | Recommended change |
|---|-----|--------|-------|---------|--------------------|
| M1 | P1 | S | `package.json` | `eslint-config-next` is `^0.2.4`. That is not the version line that matches Next 16 (should track the Next version) **(verify)** | Align `eslint-config-next` with the installed `next` version, then run `npm run lint` and fix what appears |
| M2 | P2 | M | large files | Several files are over 500 lines: `UploadSalaryClient` (957), `SalaryDashboardClient` (752), `EthicsAdminClient` (718), `AuditLogsClient` (654), `MembersAdminClient` (649), `member/page.tsx` (619) | Split into smaller components and hooks (table, filters, modal, form). This is also where most of the inline styles (D3) live |
| M3 | P2 | M | tests | Vitest covers `lib/` and two API routes. There are no component tests and Playwright is installed but unused **(verify)** | Add Playwright smoke tests: home loads, nav dropdown by keyboard, check-date happy/error path, member login screen. Run them in `ci.yml` |
| M4 | P2 | S | `.github/workflows/ci.yml` | Check that CI runs lint, typecheck, unit tests and build | Add `tsc --noEmit` and an accessibility check (for example `@axe-core/playwright`) |
| M5 | P3 | S | `next.config.ts` | Developer LAN IPs are hard-coded in `allowedDevOrigins` | Move to an env var (`ALLOWED_DEV_ORIGINS`) |
| M6 | P3 | S | `next.config.ts` | CSP allows `'unsafe-inline'` and `'unsafe-eval'` for scripts | Not UX, but worth tightening when possible (nonce-based CSP) |
| M7 | P3 | S | docs | `update.md`, `CONTEXT.md`, `AGENTS.md`, `CLAUDE.md` and `docs/` exist | Add a short `docs/ui-guidelines.md` (tokens, breakpoints, components, a11y checklist) so new pages follow the same rules |
| M8 | P3 | S | CSS | Per-page CSS files (about 22k lines) with no shared utilities | Before adding more, extract shared patterns into `globals.css` or a `components/ui` layer: buttons, cards, badges, tables, modals |

---

## Suggested order of work

| Phase | Items | Goal |
|-------|-------|------|
| 1: Quick wins (about 1-2 days) | A1, A5, D1, M1, S1, W2, D5 | Focus rings, hero controls, brand color fix, lint fix, stop wasted polling, robots/sitemap |
| 2: Core UX (about 1 week) | A2, A3, F1, N3, N4, W3, A7, A8, A9 | Keyboard-accessible menu, real dialogs/toasts, faster nav, better first screen and metadata |
| 3: Consistency (2-3 weeks, gradual) | D2, D3, D4, S3, F2, M2 | Tokens, shared table/form components, smaller files |
| 4: Polish | W1, W4, P2, P3, M3, M4, N1, S4 | PWA decision, structured data, tests, TV mode tuning |

## Before starting

- Run Lighthouse and axe DevTools on the 6 key pages and record the baseline.
- Test on a real phone and on a 1366x768 laptop, since those are common in hospital environments.
- Test the ER TV screen from typical viewing distance.
