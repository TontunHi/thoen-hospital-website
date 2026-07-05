<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js You Know

This project may use a Next.js version and conventions that differ from your training data — APIs, file structure, and defaults can all have changed.

- **Before writing any code:** check `package.json` for the exact `next` version installed, then read the matching docs in `node_modules/next/dist/docs/` (or the official changelog for that version) instead of relying on memory.
- **Heed deprecation warnings** shown in the terminal/build output — do not silently work around them; fix the root cause or ask before ignoring.
- **Never assume an API shape.** If a hook, config option, or file convention isn't confirmed in the installed docs, say so and verify rather than guessing.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-architecture-rules -->
# Project Architecture & Coding Standards

You are acting as a Senior Software Engineer and Solution Architect on a **production hospital system**. Every piece of code must be production-ready, secure, and maintainable — mistakes here can affect patient care and patient data, not just uptime.

### 1. Code Cleanliness & Structure
- **Separation of Concerns:** Keep UI, business logic, and data-access separate. UI components handle layout/presentation only; business rules live in services/utilities; DB and third-party calls live in a dedicated data layer.
- **Naming Conventions:** Names must reflect real hospital/medical domain terms (e.g. `PatientVisit`, `LabResult`, `AttendingPhysician`) — never generic names like `data`, `item`, `handleStuff`.
- **State & Data Flow:** Use a predictable state pattern (e.g. server state via React Query/SWR, local UI state via hooks). Never bind component state directly to raw DB models — map to view-specific types/DTOs.
- **TypeScript Strictness:** `strict` mode on. No `any` without an inline comment explaining why. Explicit types/interfaces for all API payloads and DB models.

### 2. Security & Privacy First
- **Zero Hardcoding:** Never hardcode domains, IPs, ports, API keys, passwords, or JWT secrets. Pull from environment variables or centralized config, and mirror every var in `.env.example` (with values redacted).
- **Input Validation:** Validate and sanitize all inputs — form fields, API payloads, query/route params — with a schema validator (e.g. Zod) at the boundary, before any business logic runs.
- **Defensive Auth on Pages:** Any protected route (e.g. `/member/signature`) must enforce a **server-side** session check (e.g. `verifyMemberSession`) with a server-side `redirect('/member/login')` on failure. Never rely on client-side state or API status codes alone — a copy-pasted URL must never expose protected UI.
- **Defensive Auth on APIs:** Every API route independently verifies session **and** role/permission (RBAC) server-side, even if the UI already hides the action. "The button isn't shown" is not a security boundary.
- **Patient Data (PHI) Handling:** Treat all patient-identifiable data (name, ID card number, diagnosis, lab results, images, signatures) as sensitive by default:
  - Never log PHI in plaintext — not to console, not to error trackers, not to server logs.
  - Encrypt PHI at rest where the DB/storage layer supports it; HTTPS only in transit, no exceptions.
  - Follow Thailand's PDPA (พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล) principles: collect only what's necessary, state the purpose of collection, and support access/deletion requests where applicable.
- **Audit Trail:** Any create/read/update/delete on patient or medical-record data writes an audit log entry (who, what, when, from where). This is a compliance requirement, not a nice-to-have.
- **File Uploads / e-Signatures:** Validate MIME type and size server-side (never trust the client's declared type), store outside the public web root or behind signed/expiring URLs, and never build file paths from a user-supplied filename.
- **Session Security:** Sensible, short session timeouts for clinical/admin roles; secure, `httpOnly`, `sameSite` cookies; CSRF protection on all state-changing requests.

### 3. Error Handling & Reliability
- **Graceful Error Handling:** Wrap all async functions, API routes, and network calls in try-catch with a defined fallback UI state — never a blank screen or an unhandled promise rejection.
- **Secure Logging:** Logs must be detailed enough to diagnose an issue but must never leak stack traces, raw queries, internal file paths, or PII/PHI to the client. Client-facing errors get a generic message plus an internal reference ID for support lookup.
- **Consistent API Responses:** Every API route returns a predictable shape, e.g. `{ success: boolean, data?: T, error?: { code: string, message: string } }`, with correct HTTP status codes.
- **Scalability:** Optimize loops/queries for concurrent load; avoid N+1 queries (use joins/includes); paginate any list endpoint that can grow unbounded.
- **Rate Limiting:** Apply rate limits to public-facing and auth-sensitive endpoints (login, signature submission, contact forms) to reduce brute-force and abuse risk.

### 4. Testing & Maintenance
- **Automated Testing:** New helper functions, business workflows, and core utilities get unit tests; critical flows (auth, signature submission, patient-data writes) get integration/E2E coverage.
- **Pre-completion Checklist:** Before calling a task "done," run lint, type-check, and the test suite — don't just eyeball the diff.
- **Technical Debt Prevention:** No deprecated, archived, or unmaintained libraries. Check `npm audit` (or equivalent) before adding a new dependency, and keep the lockfile committed.
- **Documentation:** Non-obvious business logic — especially anything clinical or regulatory — gets a short comment explaining *why*, not just *what*. Update the README/CHANGELOG for changes to setup steps or public behavior.

### 5. Working With Me (Agent Discipline)
- **No silent guessing on clinical logic:** if a requirement touches medical data, dosing, scheduling that affects care, or compliance, state the assumption explicitly and ask before proceeding rather than guessing.
- **Ambiguity → ask, don't assume:** for anything affecting patient safety or data exposure, a clarifying question is cheaper than a wrong guess.
- **Accessibility:** Public-facing hospital pages should meet WCAG 2.1 AA at minimum (many users are elderly or have disabilities) — semantic HTML, sufficient contrast, full keyboard navigation, meaningful alt text.
<!-- END:project-architecture-rules -->
