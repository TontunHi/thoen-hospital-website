# 02: Implement Short-Lived Caching & Strict PDPA Masking for Clinical Queries

**What to build:**
Implement an in-memory short-lived read cache (TTL: 5-10s) for read-only HOSxP replica queries (ER status and Lab tracker) to protect database health under concurrent clinical use. Verify and enforce server-side PHI masking on all serialized API payloads before leaving the backend boundary.

**Blocked by:** 01: Clean Next.js 16 Middleware Deprecation & Eliminate Client Auth Flicker

**Status:** ready-for-agent

- [ ] Create short-lived query cache utility for high-concurrency ER and Lab endpoints
- [ ] Ensure all patient names, HNs, and identification data are masked at the API response layer
- [ ] Confirm HOSxP replica connection pool load drops during rapid client refreshes
