---
name: hosxp-db-access
description: Read-only access patterns for the HOSxP hospital information system DB — appointments, lab results, ER status, dispensing monitor. Read before touching /check-date, /service/lab, /service/lab-tracker, /service/er-in-status, /service/loratadine-dispense, or any file under @/lib/hosDb.ts, @/lib/erDb.ts, @/lib/appointmentDb.ts.
---

## What this covers
Direct, read-only connection into the hospital's clinical database (HOSxP), separate from the app's own Prisma-managed MySQL/MariaDB.

## Access points
- `@/lib/hosDb.ts` — general HOSxP queries
- `@/lib/erDb.ts` — Emergency Room status
- `@/lib/appointmentDb.ts` — doctor appointments

## Rules

1. **Read-only, always.** Never write, update, or delete against the HOSxP connection from application code. If a write against clinical data is genuinely required, stop and ask — this is very likely the wrong layer for it.

2. **Mandatory caching for polling routes.** Anything polled repeatedly by a client (TV displays at the ER, live dashboards, auto-refreshing pages) MUST go through `getCachedData(cacheKey, fetcher, ttlMs)` from `@/lib/cache.ts` with a 5–10s TTL. Do not query HOSxP directly on every request from a polling client — it's a shared clinical DB and concurrent hammering degrades it for everyone, including systems actually used for patient care.

3. **Masking Thai citizen IDs on `/check-date`.** Doctor appointment data pulled here includes citizen names that must be masked per PDPA — follow the default masking rule in the root AGENTS.md (last 4 characters visible only). Do not display the raw value anywhere in this flow, including in dev tools/logs.

4. **Triage levels on `/service/er-in-status`.** Use the standard four levels only: Red (Emergency), Yellow (Urgent), Green (Semi-urgent), White (Non-urgent). Don't invent new levels or reorder them — downstream TV display logic and staff expectations depend on this exact set and order.

5. **Loratadine dispensing monitor (`/service/loratadine-dispense`).** Treat dispensing records as PHI-adjacent (tied to a specific patient encounter) even though the payload looks like inventory data — apply the same logging/masking discipline as lab results.

6. **No PHI in error messages.** If a HOSxP query fails, log a reference ID and generic message per the root AGENTS.md logging rules — never surface raw query text or row data in a thrown error that could reach the client.
