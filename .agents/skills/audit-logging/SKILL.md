---
name: audit-logging
description: When and how to call logAudit() for PHI/sensitive-record access. Read before writing any code path that creates, reads, updates, or deletes patient or sensitive employee data.
---

## What this covers
`@/lib/audit.ts` — the audit trail required for compliance whenever PHI or sensitive employee records are touched.

## When to call it
Any create/read/update/delete on:
- Patient health information (appointments, lab results, ER status, dispensing records, signatures, images)
- Sensitive employee records (salary, personal identifiers)

This includes reads, not just writes — viewing a lab result is itself an auditable event.

## Required fields
Every `logAudit()` call needs:
- **actor** — who performed the action (session user, not just "system")
- **action** — what was done (e.g. `VIEW_LAB_RESULT`, `UPDATE_SIGNATURE`, `EXPORT_PATIENT_LIST`)
- **target resource** — what record was touched, by ID, not by embedding the PHI value itself into the log entry
- **client IP** — source of the request

## What not to do
- Don't log the PHI value itself as part of the audit entry (e.g. don't put the citizen ID or diagnosis text in the `action` or a free-text field) — the audit log records *that* access happened and *by whom*, not a copy of the data.
- Don't batch-skip audit calls in a loop for performance — if a route returns a list of N patient records, that's N auditable reads (or one entry covering the query with enough detail to reconstruct what was returned), not zero.
- Don't make audit logging best-effort/fire-and-forget in a way that can silently fail — if the audit write fails, that's worth surfacing (per root AGENTS.md error-handling rules), not swallowing.
