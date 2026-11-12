<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

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
- **Dependency Injection for Testability:** Domain services (e.g. `@/lib/clinical/ipdWardService`, `@/lib/taskInboxService`, `@/lib/clinical/rcmDashboardService`) must accept an injectable `QueryExecutor` parameter defaulting to `queryClinicalDb` or `queryMemberDb`. This enables 100% unit test coverage in Vitest without needing live DB connections.
- **Unified Task Permission Resolver:** Always authorize inbox tasks through `@/lib/taskPermissionResolver.ts` (`resolveTaskPermissions`). All workflow state transitions (APPROVE, REJECT, SEND_BACK) must go through `@/lib/taskInboxService.ts` (`executeWorkflowAction`). Never compute ad-hoc `canEdit`, `canApprove`, or `canTakeJob` flags across different UI components or route handlers, and never embed raw SQL permission checks inside route handlers.
- **Unified File Storage Seam:** Never import raw Node.js `fs` or `fs/promises` in API routes. All file I/O — writes, reads, streaming (including HTTP 206 range requests), batch uploads, deletions, replacements, and dated-directory formatting — MUST go through `@/lib/storage/documentStorage.ts` (`DocumentStorage`). Use `DocumentStorage.readBuffer()` for image/binary reads and `DocumentStorage.serveFile()` for HTTP streaming.
- **Unified Member Auth Seam:** All member session lifecycle — OTP request, OTP verification, session creation (JWT build), session verification, session refresh (`/api/member/auth/refresh`), ThaID OAuth exchange — MUST go through `@/lib/auth/MemberAuthService.ts`. Route handlers for `/member` auth endpoints must be thin adapters: read cookie/body → call `MemberAuthService` → set/clear cookie → return JSON. Never create or verify JWTs inside route handlers directly.
- **Unified Hospital Asset Seam:** All asset management, category inference (IT/Medical/General from FSN and keywords), Gotowin location binding, and asset statistics MUST go through `@/lib/assets/assetService.ts` (`HospitalAssetService`). Route handlers under `src/app/api/assets/**` must be thin adapters delegating to this service.
- **Unified Hospital Events Seam:** All event lifecycle, attendee management, leaderboard, and ThaID checkin window validation MUST go through `@/lib/events/hospitalEventService.ts` (`HospitalEventService`) and `@/lib/events/eventTimeUtils.ts`. Event datetimes are stored literally in Thai local time (`Asia/Bangkok` UTC+7) in MySQL DATETIME, and serialized via `toBangkokIsoString` (`+07:00`) to prevent client-side double-shifting.
- **Unified Equipment Borrowing Seam:** All asset and consumable material borrow requests, approval workflows, and inventory tracking MUST go through `@/lib/equipment/equipmentBorrowService.ts` (`EquipmentBorrowService`). Route handlers under `src/app/api/member/equipment-borrow/**` must be thin adapters delegating to this service.
- **Unified Revenue Cycle Analytics Seam:** All RCM clinical dashboards, telemed tracking, fund reconciliations (NHSO SMT, MISHOS, RH1), and T1DM/GDM/PDM clinical cohort imports MUST go through `@/lib/clinical/rcmDashboardService.ts` (`RcmDashboardService`). Standardized 10 clinical specialties (`buildDepartmentSqlCase`, `classifySpecialty`), strongly typed `FiscalDateRange` (`startDate`, `endDate`), and dynamic Thai fiscal bounds (`getDefaultFiscalYearDateRange`, `resolveFiscalDateRange`).
- **Unified Member Work Summary Seam:** All member task tallies, pending approvals, and staff queue statistics MUST route through `@/lib/taskInboxService.ts` (`TaskInboxService.getMemberWorkSummary`). Never run raw SQL queries directly inside page server components.
- **Media & Video Delivery (HTTP 206):** For video files (e.g. Hero Slide MP4s), serve via `/api/stream?path=...` supporting HTTP 206 Partial Content (byte range requests) to enable smooth timeline seeking and Safari/iOS compatibility. Next.js CSP `media-src` must include `'self' data: blob: https:`.
- **Shared Formatters:** Avatar initials must use `@/lib/formatters.ts` (`getInitials`) to correctly strip Thai civil and medical honorifics (เช่น นพ., พญ., นาย, นางสาว, ทพ.).
- **Naming Conventions:** Names must reflect real hospital/medical domain terms (e.g. `PatientVisit`, `LabResult`, `AttendingPhysician`, `IpdWardService`, `TaskInboxService`) — never generic names like `data`, `item`, `handleStuff`.
- **State & Data Flow:** Use a predictable state pattern (server state via React Query/SWR with strict TTL, local UI state via hooks). Never bind component state directly to raw DB models — map to view-specific types/DTOs.
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
- **Rate Limiting:** Apply rate limits to public-facing and auth-sensitive endpoints (login, signature submission) to reduce brute-force and abuse risk.

### 4. Testing, Data, & Maintenance
- **Test Data:** Never seed dev/test databases with real patient records. Generate synthetic fixtures (fake names, fake citizen IDs that fail checksum validation on purpose so they can't be confused with real ones).
- **Automated Testing:** New helper functions, business workflows, and core utilities get unit tests via Vitest; critical flows (auth, signature submission, patient-data writes) get integration/E2E coverage.
- **Service Unit Testing & Mocking:** Domain services that internally invoke `logAudit()` (e.g. `MemberAuthService.buildSession()`, `EthicsDocumentService.deleteDocument()`) must have `logAudit` mocked in Vitest via `vi.mock('@/lib/audit', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }))` to keep unit tests isolated from the live DB. Note that `MemberAuthService.buildSession()` is async and must be awaited.
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

### 9. Engineering Principles & Rigor (pstack Integration)
The global plugin `pstack` (`C:\Users\Tontun\.gemini\config\plugins\pstack`) provides core engineering discipline and playbooks:
- **Boundary Discipline (`principle-boundary-discipline`):** Place validation, type narrowing, and error handling at system boundaries (API routes, form actions, gateway responses). Trust internal domain types unconditionally; keep business logic in pure, framework-free functions.
- **Model the Domain (`principle-model-the-domain`):** Encode real domain rules in data structures (state machines, discriminated unions, typed registries) instead of scattered if/else chains or boolean flag soup.
- **Fix Root Causes (`principle-fix-root-causes`):** Trace defects back to the earliest point where state diverged. Never patch downstream symptoms with ad-hoc null-guards.
- **Prove It Works (`principle-prove-it-works`):** Verify every change against real runtime evidence or passing Vitest tests before declaring done.
- **Laziness Protocol (`principle-laziness-protocol`):** Favor deletion over addition. Implement the smallest viable change that fully meets requirements without unnecessary layers or speculative abstractions.
- **Hospital Guardrail Override:** When executing `/poteto-mode` or any pstack playbook:
  1. *Never create direct DB sockets* — all data must flow via `@/lib/apiGateway`.
  2. *Never log or inspect plaintext PHI* — always mask or use synthetic fixtures.
  3. *Never use raw `fs` in API routes* — always use `DocumentStorage`.
<!-- END:project-architecture-rules -->

<!-- BEGIN:hospital-project-context -->
# Hospital System Project Context & Operations Guide

### 1. Development Environment & Command Execution
- **Windows / PowerShell Environment:** PowerShell execution policy restricts running `.ps1` scripts (such as `npm.ps1`). Whenever executing `npm` or `npx` commands through shells, wrap them in `cmd.exe /c "..."` (e.g. `cmd.exe /c "npm run build"` or `cmd.exe /c "npx prisma generate"`).
- **Package Overrides & Dependencies:**
  - Node.js 24+ and React 19 / Next.js 16+ (Turbopack enabled).
  - Package overrides in `package.json`: `sharp` (`^0.35.4`) and `deepmerge-ts` (`^8.0.2`) are pinned to prevent high/critical vulnerabilities. Do not remove these overrides.
  - Always verify vulnerabilities with `npm audit` after modifying dependencies.

### 2. Zero-Database Architecture & Centralized API Gateway
- **100% Zero-Database Architecture:** The Next.js application opens ZERO direct database sockets (no MySQL port 3306). All data operations route strictly through the centralized **Thoen Hospital Unified API Gateway** (`http://192.168.1.208:8443` or `process.env.API_GATEWAY_URL`) via `@/lib/apiGateway` (`ApiGatewayClient`).
- **Strict Fail-Closed Policy:** If the Gateway is unreachable, `GatewayUnavailableError` (HTTP 503) is thrown immediately. Never silently fallback to direct DB connections.
- **HOSxP Clinical DB (Read-Only):** `@/lib/clinicalDb` (`queryClinicalDb`) and clinical domain services delegate to `apiGateway.clinical.query` or dedicated endpoints. Enforced read-only (`SELECT`, `EXPLAIN`, `SHOW`). See `.agents/skills/hosxp-db-access/SKILL.md`.
- **Salary DB:** `@/lib/salaryDb` (`querySalaryDb`, `querySalaryEditDb`) delegates to `apiGateway.salary`. Supports batch uploads and ADP search enhancements. See `.agents/skills/salary-db/SKILL.md`.
- **Website Core & Member DB:** `@/lib/memberDb` (`queryMemberDb`) delegates to `apiGateway.app.query`, `apiGateway.app.execute`, and `apiGateway.app.transaction`.
- **Gateway Named APIs:** Named endpoint sets exist on the Gateway for Hero Slides, News CMS, Locations, Task Inbox, and Salary. Prefer Gateway named endpoints where available over raw SQL queries.
- **Remote Infrastructure & Server Operations (`/ssh-thlp`):** Whenever inspecting, modifying, or deploying on the internal API Gateway VM (`192.168.1.208`, user `thoen`) or the File Storage Proxmox CT (`192.168.1.24`, user `root`), invoke `.agents/skills/ssh-thlp/SKILL.md` via `/ssh-thlp`. Always use ephemeral Python paramiko scripts without persistent credentials, and consult the refactoring roadmap in `docs/gateway/TODO.md`.

### 3. Authentication & Access Control Flow
- **Hospital Staff Portal (`/member`):** Passwordless OTP auth. Full flow and required session-check pattern are in `.agents/skills/member-auth-flow/SKILL.md` — read that skill before touching any `/member` route or its APIs.
- **Session Refresh Seam:** Member session renewal occurs via `/api/member/auth/refresh`, maintaining session validity without forcing re-authentication during active work.
- **Task Permission & Inbox Workflow:** Centralized authorization in `@/lib/taskPermissionResolver.ts` (`resolveTaskPermissions`). All workflow state transitions route through `@/lib/taskInboxService.ts` (`executeWorkflowAction`). Field-level manager edits go through `updateTaskByManager`.
- **Ethics CMS:** All ethics document tree-building, cascading deletion, and year aggregation MUST go through `@/lib/cms/EthicsDocumentService.ts`. Route handlers under `src/app/api/ethics/**` and `src/app/api/member/ethics/**` must be thin adapters that call service methods — no inline Prisma tree maps or file cleanup logic inside routes.
- **Hospital Asset & Location Management:** Centralized asset domain logic in `@/lib/assets/assetService.ts` (`HospitalAssetService`). Auto-infers category from FSN codes (`7440`/`7430` → IT, `6515`/`6520`/`6530` → Medical, otherwise General) and binds Gotowin room locations.
- **Equipment & Material Borrowing Management:** Centralized workflow in `@/lib/equipment/equipmentBorrowService.ts` (`EquipmentBorrowService`). Manages borrow requests, inventory deduction, and approval states.
- **Hospital Events & QR Check-in System:** Centralized in `@/lib/events/hospitalEventService.ts` (`HospitalEventService`) and `@/lib/events/eventTimeUtils.ts`. Event datetimes are stored in Thai local time (`Asia/Bangkok` UTC+7) in MySQL DATETIME, and verified against Bangkok scan windows.
- **Revenue Cycle Management (RCM):** Centralized analytics in `@/lib/clinical/rcmDashboardService.ts` (`RcmDashboardService`). Supports monthly OPD/Invoice summaries, rep-funds waterfall ledger, telemed tracking, and direct cohort imports (T1DM/GDM/PDM) with HOSxP patient matching.
- **MariaDB Charset & Database Connection:** The hospital server defaults `init_connect='SET NAMES tis620'`. Always use `@/lib/prisma` (which automatically pins an interactive transaction with `SET NAMES utf8mb4`) rather than unpinned raw clients to avoid UTF-8 deserializer errors.
- **Audit Logging:** Any access to PHI or sensitive employee records must call `logAudit()`. Workflow transitions must write to `inbox_task_audit_logs`. See `.agents/skills/audit-logging/SKILL.md`.

### 4. Permanent Deletions & Deprecations
- **Contact Inquiries & Complaints:** The public contact form and complaint messaging features have been permanently removed from both UI and API. Do not re-create routes or forms for contact inquiries.
- **Direct Database Sockets:** MySQL port 3306 direct connections are permanently disabled. Never introduce direct database client libraries or fallback connection strings.
<!-- END:hospital-project-context -->
