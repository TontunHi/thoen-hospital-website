# 3. Rewrite the backend in Go, route by route

Date: 2026-10-08

## Status
Accepted

## Context
The backend is the 78 API routes and the `src/lib` domain modules inside the Next.js app, running as one Node process behind IIS. Users report slow pages in every area and degradation under load. No measurement exists yet of how that time splits between the application and the databases.

## Decision
Rebuild the backend as a Go service in `backend/`, keeping business workflows, API contracts and every database exactly as they are.

- **Databases are untouched.** All four stay MySQL (HOSxP and salary in `tis620`). Prisma remains the owner of the primary schema.
- **Next.js stays as the frontend.** Server-rendered pages that call `src/lib` in-process today will fetch from Go instead.
- **Cutover is route by route.** IIS gets one rewrite rule per ported path; removing the rule is the rollback.
- **Parity is proven, not assumed.** Golden record/replay compares Node and Go responses, using a seeded stand-in HOSxP with synthetic patients only.
- **Each area is baselined on Node before it is ported**, so the Go version has a measured target.
- **The Go service runs on the existing Windows server** as a native binary. No Docker in production.
- **Pilot:** HOSxP read-only routes (ER status, appointment lookup).
- Bots and maintenance scripts stay in TypeScript until every route is ported.

Any change to a business workflow needs explicit approval first.

## Considered options
- **Measure and fix in place** (profile slow endpoints, fix queries and caching, raise the PM2 instance count). Recommended as the cheaper first step and rejected by the project owner in favour of the rewrite.
- **Go for hot paths only.** Rejected: leaves domain rules in two languages permanently.
- **Big-bang switch.** Rejected: nothing ships until the end and rollback is all-or-nothing.

## Consequences
- If an area's baseline shows the time is spent in the database, porting it to Go will not make it faster; that area needs query or caching work instead.
- Until the last route moves, permission, audit and notification rules exist in both TypeScript and Go and must be kept in step.
- The rate limiter and short-lived cache are in-memory per process, so Node and Go each hold their own counters during the migration.
