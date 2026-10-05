# Thoen Hospital Website — Agent Instructions

Hospital management & portal system built with Next.js 16 (React 19), Prisma ORM, and MySQL.

> **Full Rules & Compliance:** See [AGENTS.md](file:///c:/Users/Tontun/Documents/thoen-hospital-website/AGENTS.md) and [CONTEXT.md](file:///c:/Users/Tontun/Documents/thoen-hospital-website/CONTEXT.md).

## Essential Windows Commands
Run commands via `cmd.exe /c "..."` to bypass PowerShell script execution restrictions:

```bash
# Development & Build
cmd.exe /c "npm run dev"          # Start dev server on 0.0.0.0:3000
cmd.exe /c "npm run build"        # Build Next.js application
cmd.exe /c "npm run build:full"   # Run prisma generate + build

# Testing & Quality
cmd.exe /c "npm run test"         # Run Vitest test suite
cmd.exe /c "npm run test:watch"   # Run Vitest in watch mode
cmd.exe /c "npx tsc --noEmit"     # Run TypeScript type check
cmd.exe /c "npm run lint"         # Run ESLint

# Database & Maintenance
cmd.exe /c "npm run db:generate"  # Generate Prisma client
cmd.exe /c "npm run db:backup"    # Run DB backup script
cmd.exe /c "npm run db:safe-push" # Safe schema sync
cmd.exe /c "npm run maintenance:cleanup" # Purge old audit logs
```

## Architecture & DB Boundaries
1. **Primary DB (Prisma):** `@/lib/prisma` — CMS, users, tickets, approvals, audit logs.
2. **HOSxP DB (Read-Only):** `@/lib/clinicalDb`, `@/lib/clinical/ipdWardService` — Appointments, Lab, ER, IPD, Bed Occupancy, OR. Never write/mutate.
3. **Salary DB (Read-Only):** `@/lib/salaryDb` — Encrypted pay slip data.
4. **File Storage Seam:** `@/lib/storage/documentStorage` (`DocumentStorage`) — Never import raw `fs` in API routes. Use `readBuffer()` for image/binary reads, `serveFile()` for HTTP 206 byte-range streaming (video/Safari), `save()`/`saveBatch()`/`delete()` for writes.
5. **Member Auth Seam:** `@/lib/auth/MemberAuthService` — All OTP, JWT build/verify, and ThaID OAuth flows. Route handlers: read cookie/body → call service → set cookie. Never create or verify JWTs inside a route handler.
6. **Ethics CMS Seam:** `@/lib/cms/EthicsDocumentService` — Tree building, year aggregation, cascading file+record delete. Ethics route handlers are thin adapters only.
7. **Hospital Asset Seam:** `@/lib/assets/assetService` (`HospitalAssetService`) — Auto-categorization (IT/Medical/General), FSN mapping, Gotowin integration. Route handlers: `@/app/api/assets/**`.

## Architectural & Coding Standards
- **Thin Route Adapters:** API routes (`src/app/api/**`) must be thin (~20–40 lines) delegating to deep domain modules in `@/lib/`.
- **Task Permissions (Single Source of Truth):** Use `@/lib/taskPermissionResolver` (`resolveTaskPermissions`) for all inbox authorization (`canView`, `canEdit`, `canApprove`, `canTakeJob`, `canCancel`).
- **Task Workflow Actions:** All APPROVE/REJECT/SEND_BACK transitions go through `@/lib/taskInboxService` (`executeWorkflowAction`) — handles permission check, HMAC verify, step advance, audit log, and Telegram notify. Manager field edits use `updateTaskByManager`.
- **Test Seams:** Domain services accept an injectable `QueryExecutor` parameter defaulting to `queryClinicalDb` for 100% Vitest unit testability.
- **File Uploads:** Use `DocumentStorage.save()`, `saveBatch()`, or `formatDateDirectory()`.

## Testing Gotchas
- **Mock `logAudit` in service unit tests:** Services that call `logAudit()` internally (e.g. `MemberAuthService.buildSession`, `EthicsDocumentService.deleteDocument`) need: `vi.mock('../audit', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }))`
- **`buildSession` is async:** `MemberAuthService.buildSession()` returns `Promise<string>` — always `await` it. The old `createToken` was sync and is now deprecated (throws).


## Critical Hospital Rules (Zero Exception)
- **PHI / PDPA:** Never log patient data in plaintext. Always mask Thai ID/HN to **last 4 digits** (e.g. `x-xxxx-xxxxx-xx-1`) and patient names to `first 3 chars + ***`.
- **Two-Tier Audit Trail:** 
  1. `audit_logs` via `logAudit()`: PHI, Salary, Auth, Admin settings, CMS slides/docs.
  2. `inbox_task_audit_logs`: Ticket state machines, HMAC-SHA256 signature stamps, manager field diffs.
- **Auth & RBAC:** Enforce server-side session and role check on all protected pages & APIs.
- **Date Display:** Thai Buddhist Calendar (พ.ศ.) for UI shown to staff/patients. Timezone `Asia/Bangkok`.
