# Comprehensive Hospital System & Portal Enhancement Specification

## Problem Statement

The Thoen Hospital website and clinical staff portals serve two critical user groups: hospital personnel (medical doctors, ER nurses, and department staff accessing real-time patient care data) and the public (local citizens, seniors, and patients seeking health services and hospital updates).

Currently:
1. Staff face client-side layout flicker and redundant authentication requests (/api/member/me called on pages already guarded by server sessions).
2. Large clinical tables (ER live status, Lab tracker, Loratadine dispensation) lack responsive card layouts and experience severe Content Layout Shift (CLS) due to generic Loading... text rather than structured skeleton loaders.
3. Repetitive queries against the primary HOSxP read-only replica lack short-lived caching, imposing unnecessary database overhead during concurrent ward visits.
4. Next.js 16 deprecation warnings (middleware.ts) clutter production logs.
5. Public-facing health portals lack elder-friendly accessibility features (text scaling controls, WCAG 2.1 AA high-contrast considerations).

## Solution

A robust, three-tiered enhancement across architecture, internal clinical services, and public healthcare UI:
1. **Core Architecture & Performance**: Eliminate deprecated middleware, streamline server-side session propagation to eliminate double-auth flickers, and introduce short-lived server-side data caching (5-10s) with rate limiting for HOSxP replica reads.
2. **Clinical Staff UX & Mobile Responsiveness**: Replace plain loading states with skeleton components for ER Live Status, Lab Tracker, and Loratadine views; implement responsive adaptive card views on screens narrower than 768px; enforce strict server-side PHI masking on payload boundaries.
3. **Public Accessibility & Portal Polish**: Provide WCAG 2.1 AA compliant font-size adjustments for senior citizens, refine high-contrast text ratios, and add graceful empty/offline states across hospital services and package views.

## User Stories

1. As an ER nurse accessing the live status dashboard on a mobile ward tablet, I want to see an immediate responsive card layout so that patient triage information is readable without horizontal scrolling.
2. As a clinical officer, I want page loads to show smooth skeleton placeholders instead of abruptly shifting text, so that visual stability and perceived performance are maximized.
3. As an attending physician, I want the system to avoid duplicate authentication roundtrips when navigating between protected clinical services, so that transitions are instantaneous without login flickers.
4. As a database administrator, I want frequent live status queries to utilize short-lived server-side caching, so that the HOSxP replica is shielded from concurrent spikes.
5. As an elderly resident of Thoen district, I want to be able to enlarge the website font size directly from the navigation bar, so that I can easily read hospital service hours and specialized clinic schedules.
6. As a compliance officer, I want all sensitive patient identifiers (HN, national ID) to be strictly masked at the API response boundary before reaching the browser, so that patient confidentiality complies with Thai PDPA regulations.
7. As a DevOps engineer, I want clean production build logs without deprecated Next.js middleware warnings, so that runtime observability is maintainable.

## Implementation Decisions

### Architectural Seams & Session Propagation
- Remove redundant client-side /api/member/me fetch inside protected client components. Server components will verify member sessions via erifyMemberSession() and pass normalized session context as props.
- Deprecate empty middleware.ts to satisfy Next.js 16 conventions and silence build warnings.

### Data Layer & Caching
- Introduce a server-side read-cache utility for high-frequency HOSxP queries (ER active patients, Lab status summaries) with a configurable TTL (5 to 10 seconds), preserving freshness while preventing connection starvation.
- Enforce data boundary transformation: Raw SQL results mapped to strict DTOs where patient identifiers are masked prior to serialization.

### UI / UX & Component Slices
- Create shared Skeleton components matching table and metric card geometries.
- Introduce mobile CSS breakpoints (768px) converting wide tabular records into accessible stacked triage cards.
- Implement an Accessibility Floating Toolbar / Navbar toggle for public routes supporting normal, medium (+25%), and large (+50%) typography scaling.

## Testing Decisions

- Test user journeys through external behavioral assertions (verifying rendered DOM elements, accessibility attributes, and response statuses), not internal private methods.
- Test modules:
  - Session boundary verification: Protected routes redirect unauthenticated users without client-side execution.
  - Data privacy: API endpoints return masked HN/names in both JSON payloads and view models.
  - Responsive layout: Viewport rendering at 375px and 1200px.

## Out of Scope

- Direct bi-directional write operations to HOSxP database (HOSxP remains read-only).
- Modifying underlying member authentication schema (Brevo SMTP integration remains as implemented).

## Further Notes

All changes strictly conform to the project's [AGENTS.md] rules: zero hardcoding, strict TypeScript, server-side defensive auth, and WCAG 2.1 AA accessibility.
