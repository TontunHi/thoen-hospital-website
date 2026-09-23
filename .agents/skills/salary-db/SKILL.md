---
name: salary-db
description: Read-only external salary database connection used for encrypted pay slip generation. Read before touching @/lib/salaryDb.ts or any pay-slip feature.
---

## What this covers
`@/lib/salaryDb.ts` — a read-only connection to an external salary database, used to generate encrypted pay slips.

## Rules
- Read-only, same as the HOSxP connection — never write against this DB from application code.
- Salary data is sensitive employee data, not PHI, but gets the same treatment under root AGENTS.md §2: no plaintext logging, masking on display, audit trail on access (see `.agents/skills/audit-logging/SKILL.md`).
- Pay slips must remain encrypted at rest and only be decrypted server-side at the point of generating the response to an authenticated, authorized request — never cache a decrypted pay slip.
