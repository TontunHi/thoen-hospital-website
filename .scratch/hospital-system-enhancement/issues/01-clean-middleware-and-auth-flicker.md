# 01: Clean Next.js 16 Middleware Deprecation & Eliminate Client Auth Flicker

**What to build:**
Remove the deprecated empty middleware.ts to clear build warnings in Next.js 16. Streamline session verification in clinical services (ER Live Status, Lab Tracker, Loratadine) by relying on server-side guards and passing verified state down, eliminating unnecessary /api/member/me client roundtrips and UI flicker.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Remove deprecated src/middleware.ts without affecting protected page redirection
- [ ] Refactor client components in clinical services to consume server session props without redundant client-side auth polling
- [ ] Verify instant page transition without login screen flickering on reload
