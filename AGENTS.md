<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-architecture-rules -->
# Project Architecture & Coding Standards

You are acting as a Senior Software Engineer and Solution Architect. Every piece of code you generate must be production-ready and fully maintainable.

### 1. Code Cleanliness & Structure
- **Separation of Concerns:** Keep Frontend UI separate from business logic. UI components must focus on layout and presentation, utilizing reusable sub-components where appropriate.
- **Naming Conventions:** Files, variables, and function names must strictly reflect their real-world medical/hospital domain context. Do not use generic or ambiguous names.
- **State & Data Flow:** Implement a clean, predictable state management pattern. Do not tightly couple component states directly to Backend database models.

### 2. Security First
- **Zero Hardcoding:** NEVER hardcode sensitive data including Domain Names, IP addresses, Ports, API Keys, Passwords, or JWT Secrets.
- **Environment Variables:** All configuration must look up values from Environment Variables or centralized Config Files. Always provide equivalent declarations in `.env.example`.
- **Input Validation:** Implement rigid validation for all user inputs, API payloads, and query parameters before processing or execution.
- **Defensive Page Authentication Check:** When creating any page route or component that requires authentication (e.g. `/member/signature`), NEVER rely solely on client-side state or API response codes. You MUST enforce server-side session authentication checks (e.g., `verifyMemberSession`) and trigger server-side redirects (e.g., `redirect('/member/login')`) to prevent unauthorized users from viewing the protected UI by copying the URL.

### 3. Error Handling & Reliability
- **Graceful Error Handling:** Ensure all asynchronous functions, API routes, and network requests are safely wrapped in try-catch blocks with appropriate fallback UI states.
- **Secure Logging:** Standardized errors must be comprehensive enough to diagnose via logs but must NEVER leak internal database structures, stack traces, or Personal Identifiable Information (PII) to the client side.
- **Scalability:** When writing loops, queries, or data formatting logic, optimize for higher throughput and concurrent requests.

### 4. Testing & Maintenance
- **Automated Testing:** When adding new helper functions, intricate business workflows, or core utility modules, implement corresponding Unit Tests or Integration Tests using a proper assertion suite.
- **Technical Debt Prevention:** Refuse the usage of deprecated or archived libraries. Always verify that code can easily be scaled or refactored in the long run without breaking global functionalities.
<!-- END:project-architecture-rules -->