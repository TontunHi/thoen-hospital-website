---
name: member-auth-flow
description: Passwordless Thai National ID + OTP auth for the /member hospital staff portal, and the required server-side session check pattern. Read before touching any /member route, its Server Components, or its API routes.
---

## What this covers
The `/member` portal uses passwordless authentication: Thai National ID + a 6-digit OTP delivered via Brevo/SMTP, implemented in `@/lib/memberAuth.ts`.

## Required pattern — pages
Every protected page under `/member` (e.g. `/member/signature`) is a Server Component that starts with:

```
const session = await verifyMemberSession();
if (!session) redirect('/member/login');
```

This check must happen server-side, before any protected UI renders. Never gate protected UI purely on client-side state (e.g. hiding a component after a client fetch resolves) — a directly-pasted URL must never expose protected content even for a flash of a frame.

## Required pattern — API routes
Every API route under `/member`'s API surface independently:
1. Calls `verifyMemberSession()` and rejects if null.
2. Checks `session.role` / permissions for the specific action being performed — the fact that the UI doesn't show a button for a given role is not a security boundary. Assume the API can be called directly.

## OTP specifics
- OTP delivery goes through Brevo/SMTP — don't introduce a second delivery channel without checking `@/lib/memberAuth.ts` first for existing rate-limiting/retry logic.
- Apply rate limiting to the OTP request and verify endpoints specifically (per root AGENTS.md §2) — these are classic brute-force targets since there's no password to slow an attacker down otherwise.

## Session security
- Keep session timeouts short for this portal relative to a typical consumer app — it fronts clinical/admin actions.
- Cookies: secure, `httpOnly`, `sameSite`. CSRF protection on every state-changing request (signature submission included).
