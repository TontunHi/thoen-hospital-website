---
name: audit-logging
description: When and how to call logAudit() for PHI/sensitive-record access. Read before writing any code path that creates, reads, updates, or deletes patient or sensitive employee data.
---

## Two-Tier Audit Architecture

Thoen Hospital utilizes a two-tier auditing structure:

### Tier 1: Hospital Compliance & Security (`audit_logs` via `@/lib/audit.ts`)
Required for legal, regulatory (PDPA/MOPH), and access auditing.
- **When to call it:**
  - Patient Health Information (PHI) reads and writes (appointments, lab results, ER status, dispensing records, signatures, IPD ward).
  - Sensitive employee records (salary downloads, profile changes).
  - Authentication events (OTP requests, login, logout, failed attempts).
  - Administrative actions (role assignment, permission key bindings, CMS slides/news/ethics/outgoing docs).
- **Functions:**
  - `logAudit()`: Immediate write for standard and mutation events.
  - `logThrottledAudit()`: Coalesced write (5-minute window per actor+action+target) for high-frequency polling/read endpoints to avoid database spam.
- **Required fields:**
  - `actor`: session user identifier (e.g. `user_123` or Thai ID)
  - `action`: structured verb (e.g. `VIEW_LAB_RESULT`, `CREATE_SLIDE`, `UPDATE_SLIDE`, `DELETE_SLIDE`)
  - `target`: identifier of the accessed resource (never embedding raw PHI)
  - `ip`: client IP address
  - `userAgent`: browser/client user agent string

### Tier 2: Workflow & Task Lifecycle (`inbox_task_audit_logs` via `@/lib/taskInboxService.ts`)
Required for ticket state machines, legal e-signature trails, and managerial edits.
- **When it is recorded:**
  - Ticket lifecycle state transitions (Draft -> Pending -> Approved -> In Progress -> Completed -> Closed).
  - E-Signature stamping with HMAC-SHA256 integrity hashes.
  - Manager / Admin field edits (`MANAGER_EDIT_TASK`) with automatic JSON diffing (`{ old: {...}, new: {...} }`).

## What not to do
- Don't log the PHI value itself as part of the audit entry (e.g. don't put citizen ID, patient name, or diagnosis in free-text fields) — record *that* access happened and *by whom*, referencing the ID.
- Don't batch-skip audit calls in a loop for performance.
- Don't make audit logging best-effort in a way that swallows fatal database errors.
