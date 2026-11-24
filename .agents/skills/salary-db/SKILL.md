---
name: salary-db
description: External salary database access via API Gateway Named Endpoints used for encrypted pay slip generation and finance batch management. Read before touching @/lib/salary/*, @/lib/gateway/salaryGatewayNamespace.ts, or any pay-slip feature.
---

## What this covers
Access to the external salary database strictly via **Thoen Hospital Unified API Gateway Named Endpoints** (`/api/v1/salary/*` via `apiGateway.salary.*` in `@/lib/gateway/salaryGatewayNamespace.ts` and `@/lib/salary/salaryPortalService.ts`). Legacy `@/lib/salaryDb.ts` and raw SQL endpoints are permanently retired.

## Rules
- Never open direct DB sockets or embed raw SQL strings under `src/` — route all salary reads and finance batch operations exclusively through Gateway Named Endpoints.
- Salary data is sensitive employee data, not PHI, but gets the same treatment under root AGENTS.md §2: no plaintext logging, masking on display, audit trail on access (see `.agents/skills/audit-logging/SKILL.md`).
- Pay slips must remain encrypted at rest and only be decrypted server-side at the point of generating the response to an authenticated, authorized request — never cache a decrypted pay slip.
