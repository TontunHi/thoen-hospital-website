---
name: hosxp-db-access
description: Read-only access patterns for the HOSxP hospital information system via API Gateway Named Endpoints — appointments, lab results, ER status, dispensing monitor. Read before touching /check-date, /service/lab, /service/lab-tracker, /service/er-in-status, /service/loratadine-dispense, or any file under @/lib/erDb.ts, @/lib/appointmentDb.ts, or @/lib/gateway/clinical*.ts.
---

## What this covers
Read-only access to the hospital's clinical database (HOSxP) strictly via **Thoen Hospital Unified API Gateway Named Endpoints** (`/api/v1/clinical/*`). Direct DB sockets and raw SQL strings are permanently retired and forbidden under `src/`.

## Access points
- `@/lib/apiGateway` (`apiGateway.clinical.*` — defined in `@/lib/gateway/clinicalGatewayNamespace.ts`, `@/lib/gateway/clinicalV2GatewayNamespace.ts`, and `@/lib/gateway/rcmV2GatewayNamespace.ts`)
- `@/lib/erDb.ts` — Emergency Room status adapter (delegates to Gateway Named APIs)
- `@/lib/appointmentDb.ts` — Doctor appointments adapter (delegates to Gateway Named APIs)

## Rules

1. **Read-only & Zero-SQL, always.** Never write, update, or delete against HOSxP from application code, and never add raw SQL strings or direct DB drivers in `src/`. Any new clinical query must be added as a Named Endpoint plugin on the API Gateway (`192.168.1.208`).

2. **Mandatory caching for polling routes.** Anything polled repeatedly by a client (TV displays at the ER, live dashboards, auto-refreshing pages) MUST go through `getCachedData(cacheKey, fetcher, ttlMs)` from `@/lib/cache.ts` with a 5–10s TTL (and Gateway-side `getCached` where appropriate). Do not hammer HOSxP on every request from a polling client — it's a shared clinical DB and concurrent hammering degrades systems used for patient care.

3. **Masking Thai citizen IDs on `/check-date`.** Doctor appointment data pulled here includes citizen names that must be masked per PDPA — follow the default masking rule in the root AGENTS.md (last 4 characters visible only). Do not display the raw value anywhere in this flow, including in dev tools/logs.

4. **Triage levels on `/service/er-in-status`.** Use the standard four levels only: Red (Emergency), Yellow (Urgent), Green (Semi-urgent), White (Non-urgent). Don't invent new levels or reorder them — downstream TV display logic and staff expectations depend on this exact set and order.

5. **Loratadine dispensing monitor (`/service/loratadine-dispense`).** Treat dispensing records as PHI-adjacent (tied to a specific patient encounter) even though the payload looks like inventory data — apply the same logging/masking discipline as lab results.

6. **No PHI in error messages.** If a Gateway/HOSxP request fails, log a reference ID and generic message per the root AGENTS.md logging rules — never surface raw query text or row data in a thrown error that could reach the client.
