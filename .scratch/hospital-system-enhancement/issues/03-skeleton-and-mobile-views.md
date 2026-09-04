# 03: Introduce Clinical Skeleton Loaders & Mobile Adaptive Card Views

**What to build:**
Upgrade clinical dashboards (ER Live Status, Lab Tracker, Loratadine Dispense) with dedicated Skeleton loading states matching table layouts to eliminate Content Layout Shift (CLS). Implement CSS responsive breakpoints (<768px) that transform dense data tables into readable stacked cards on ward tablets and smartphones.

**Blocked by:** 01: Clean Next.js 16 Middleware Deprecation & Eliminate Client Auth Flicker

**Status:** ready-for-agent

- [ ] Replace text กำลังโหลด... with polished animated Skeleton components
- [ ] Implement mobile CSS rules transforming tabular patient rows into triage cards on small screens
- [ ] Verify responsive layout across mobile (375px), tablet (768px), and desktop (1280px) viewports
