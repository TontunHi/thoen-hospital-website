<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-architecture-rules -->
# Project Architecture & Coding Standards

You are acting as a Senior Software Engineer and Solution Architect on a **production hospital system**. Every piece of code must be production-ready, secure, and maintainable — mistakes here can affect patient care and patient data, not just uptime.

This is the always-on rule set. Domain-specific integration detail (HOSxP DB access, member auth flow, audit logging, salary DB) lives under `.agents/skills/` — pull the relevant skill in when a task actually touches that area, rather than treating this whole file as the only source of truth.

### 1. Code Cleanliness & Structure
- **Separation of Concerns:** Keep UI, business logic, and data-access separate. UI components handle layout/presentation only; business rules live in services/utilities; DB and third-party calls live in a dedicated data layer.
- **Thin Route Adapters & Deep Domain Modules:** API Route handlers (`src/app/api/**`) must be thin HTTP adapters (~20–40 lines) responsible solely for request validation, session/RBAC checking, calling domain services, and returning JSON. Never place raw SQL queries, complex data transformations, or batch calculations directly inside route handlers.
- **Dependency Injection for Testability:** Domain services (e.g. `@/lib/clinical/ipdWardService`, `@/lib/taskInboxService`) must accept an injectable `QueryExecutor` parameter defaulting to `queryClinicalDb`. This enables 100% unit test coverage in Vitest without needing live DB connections.
- **Unified Task Permission Resolver:** Always authorize inbox tasks through `@/lib/taskPermissionResolver.ts` (`resolveTaskPermissions`). Never compute ad-hoc `canEdit`, `canApprove`, or `canTakeJob` flags across different UI components or route handlers.
- **Unified File Storage Seam:** Never import raw Node.js `fs` or `fs/promises` in API routes. All file writes, batch uploads, deletions, replacements, and dated-directory formatting MUST use `@/lib/storage/documentStorage.ts` (`DocumentStorage`).
- **Media & Video Delivery (HTTP 206):** For video files (e.g. Hero Slide MP4s), serve via `/api/stream?path=...` supporting HTTP 206 Partial Content (byte range requests) to enable smooth timeline seeking and Safari/iOS compatibility. Next.js CSP `media-src` must include `'self' data: blob: https:`.
- **Naming Conventions:** Names must reflect real hospital/medical domain terms (e.g. `PatientVisit`, `LabResult`, `AttendingPhysician`, `IpdWardService`, `TaskInboxService`) — never generic names like `data`, `item`, `handleStuff`.
- **State & Data Flow:** Use a predictable state pattern (e.g. server state via React Query/SWR, local UI state via hooks). Never bind component state directly to raw DB models — map to view-specific types/DTOs.
- **TypeScript Strictness:** `strict` mode on. No `any` without an inline comment explaining why. Explicit types/interfaces for all API payloads and DB models.

### 2. Security & Privacy First
- **Zero Hardcoding:** Never hardcode domains, IPs, ports, API keys, passwords, or JWT secrets. Pull from environment variables or centralized config, and mirror every var in `.env.example` (with values redacted).
- **Input Validation:** Validate and sanitize all inputs — form fields, API payloads, query/route params — with a schema validator (e.g. Zod) at the boundary, before any business logic runs.
- **Defensive Auth on Pages:** Any protected route (e.g. `/member/signature`) must enforce a **server-side** session check with a server-side `redirect('/member/login')` on failure. Never rely on client-side state or API status codes alone — a copy-pasted URL must never expose protected UI. See `.agents/skills/member-auth-flow/SKILL.md`.
- **Defensive Auth on APIs:** Every API route independently verifies session **and** role/permission (RBAC) server-side, even if the UI already hides the action. "The button isn't shown" is not a security boundary.
- **Data Classification (PHI):** The following fields are PHI and must be handled per the rules below — Thai citizen ID number, HN (hospital number), full name, date of birth, diagnosis, lab results, medical images, e-signatures, home address, phone number.
  - Never log PHI in plaintext — not to console, not to error trackers, not to server logs. Log a reference ID instead.
  - Encrypt PHI at rest where the DB/storage layer supports it; HTTPS only in transit, no exceptions.
  - Default masking format when displaying PHI in any UI, log, or export: show only the **last 4 characters**, mask the rest (e.g. citizen ID `x-xxxx-xxxxx-xx-1` → last 4 digits visible). Do not invent a different masking scheme per feature.
  - Follow Thailand's PDPA (พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล) principles: collect only what's necessary, state the purpose of collection, and support access/deletion requests where applicable.
- **AI / LLM Usage Safety:** When asking any AI agent (including this one) for help — debugging, writing sample code, generating test cases — never paste real patient records, real citizen IDs, or real lab results into the prompt or into files the agent reads. Use synthetic or already-masked sample data. This applies even when the AI tool runs "locally" in the IDE — assume anything typed into an agent prompt may leave the machine.
- **Two-Tier Audit Architecture:**
  1. **Tier 1 (Hospital Compliance `audit_logs` via `@/lib/audit.ts`):** Any create/read/update/delete on patient health records (Lab, ER, IPD, Appointments), Salary data, Auth events, Admin settings, or CMS updates writes an immutable audit record.
  2. **Tier 2 (Workflow Audit `inbox_task_audit_logs` via `@/lib/taskInboxService.ts`):** Tracks ticket lifecycle state transitions, HMAC-SHA256 signature hashes, and field-level diffs (`MANAGER_EDIT_TASK`).
  See `.agents/skills/audit-logging/SKILL.md`.
- **File Uploads / e-Signatures:** Validate MIME type and size server-side (never trust the client's declared type), store outside the public web root or behind signed/expiring URLs, and never build file paths from a user-supplied filename.
- **Session Security:** Sensible, short session timeouts for clinical/admin roles; secure, `httpOnly`, `sameSite` cookies; CSRF protection on all state-changing requests.

### 3. Error Handling & Reliability
- **Graceful Error Handling:** Wrap all async functions, API routes, and network calls in try-catch with a defined fallback UI state — never a blank screen or an unhandled promise rejection.
- **Secure Logging:** Logs must be detailed enough to diagnose an issue but must never leak stack traces, raw queries, internal file paths, or PII/PHI to the client. Client-facing errors get a generic message plus an internal reference ID for support lookup. Use `pino` (@/lib/logger) for structured backend logging.
- **Consistent API Responses:** Every API route returns a predictable shape: `{ success: boolean, data?: T, error?: { code: string, message: string } }`, with correct HTTP status codes.
- **Scalability:** Optimize loops/queries for concurrent load; avoid N+1 queries (use joins/includes); paginate any list endpoint that can grow unbounded.
- **Rate Limiting:** Apply rate limits to public-facing and auth-sensitive endpoints (login, signature submission, contact forms) to reduce brute-force and abuse risk.

### 4. Testing, Data, & Maintenance
- **Test Data:** Never seed dev/test databases with real patient records. Generate synthetic fixtures (fake names, fake citizen IDs that fail checksum validation on purpose so they can't be confused with real ones).
- **Automated Testing:** New helper functions, business workflows, and core utilities get unit tests via Vitest; critical flows (auth, signature submission, patient-data writes) get integration/E2E coverage.
- **Technical Debt Prevention:** No deprecated, archived, or unmaintained libraries. Check `npm audit` (or equivalent) before adding a new dependency, verify overrides in `package.json`, and keep the lockfile committed.
- **Documentation:** Non-obvious business logic — especially anything clinical or regulatory — gets a short comment explaining *why*, not just *what*. Update the README/CHANGELOG for changes to setup steps or public behavior.

### 5. Definition of Done — scaled by risk
Don't run the full checklist on every diff; scale it to what the change touches.

| Change touches... | Before calling it done |
|---|---|
| Copy, styling, comments, non-clinical UI tweaks | Lint passes. That's it. |
| Business logic, new components, non-PHI data flow | Lint + type-check + relevant unit tests. |
| Auth, PHI, HOSxP/ER/lab data, signatures, audit logging, payments/salary, task transitions | Lint + type-check + full test suite + manual trace of the auth/RBAC path + confirm audit log entry is written. State any assumption about clinical/compliance behavior explicitly and ask before proceeding — don't guess. |

### 6. Git & Review
- Branch naming: `feature/<name>`, `fix/<name>`, `hotfix/<name>`.
- Any change that touches auth, PHI-adjacent code, or the HOSxP/ER/lab/salary data layers requires human review before merging to the production branch — an agent should open a PR for these, not push directly, regardless of autonomy mode.
- Trivial/non-clinical changes may follow your team's normal direct-commit workflow if that's already the convention.

### 7. Locale & Time
- Server and stored timestamps: UTC. Display timezone: Asia/Bangkok.
- Any UI showing dates to hospital staff or patients must render in the Thai Buddhist calendar (พ.ศ.) unless the specific screen is explicitly international/export-facing — don't silently mix ค.ศ. and พ.ศ. in the same view.

### 8. Working With Me (Agent Discipline)
- **No silent guessing on clinical logic:** if a requirement touches medical data, dosing, scheduling that affects care, or compliance, state the assumption explicitly and ask before proceeding rather than guessing.
- **Ambiguity → ask, don't assume:** for anything affecting patient safety or data exposure, a clarifying question is cheaper than a wrong guess.
- **Accessibility:** Public-facing hospital pages should meet WCAG 2.1 AA at minimum (many users are elderly or have disabilities) — semantic HTML, sufficient contrast, full keyboard navigation, meaningful alt text.
<!-- END:project-architecture-rules -->

<!-- BEGIN:hospital-project-context -->
# Hospital System Project Context & Operations Guide

### 1. Development Environment & Command Execution
- **Windows / PowerShell Environment:** PowerShell execution policy restricts running `.ps1` scripts (such as `npm.ps1`). Whenever executing `npm` or `npx` commands through shells, wrap them in `cmd.exe /c "..."` (e.g. `cmd.exe /c "npm run build"` or `cmd.exe /c "npx prisma generate"`).
- **Package Overrides & Dependencies:**
  - Node.js 24+ and React 19 / Next.js 16+ (Turbopack enabled).
  - Package overrides in `package.json`: `sharp` (`^0.35.4`) and `deepmerge-ts` (`^8.0.2`) are pinned to prevent high/critical vulnerabilities. Do not remove these overrides.
  - Always verify vulnerabilities with `npm audit` after modifying dependencies.

### 2. Multi-Database Architecture & Read Replicas
- **Primary Database (Prisma ORM):** MySQL/MariaDB storing application CMS, admin accounts, news, slides, repair tickets, approvals, and audit logs. Access via `@/lib/prisma`.
- **HOSxP Hospital Database (Read-Only):** Direct database pool for hospital information system data. Full access patterns, caching rules, and PDPA masking specifics for this integration are in `.agents/skills/hosxp-db-access/SKILL.md` — read that skill before touching `/check-date`, `/service/lab`, `/service/lab-tracker`, `/service/er-in-status`, or `/service/loratadine-dispense`.
- **Salary Database (Read-Only):** External connection for encrypted pay slip generation. See `.agents/skills/salary-db/SKILL.md`.

### 3. Authentication & Access Control Flow
- **Hospital Staff Portal (`/member`):** Passwordless OTP auth. Full flow and required session-check pattern are in `.agents/skills/member-auth-flow/SKILL.md` — read that skill before touching any `/member` route or its APIs.
- **Task Permission & Inbox Workflow:** Centralized authorization in `@/lib/taskPermissionResolver.ts` (`resolveTaskPermissions`). All field-level updates and state mutations route through `@/lib/taskInboxService.ts` (`updateTaskByManager`).
- **Audit Logging:** Any access to PHI or sensitive employee records must call `logAudit()`. Workflow transitions must write to `inbox_task_audit_logs`. See `.agents/skills/audit-logging/SKILL.md`.
<!-- END:hospital-project-context -->
