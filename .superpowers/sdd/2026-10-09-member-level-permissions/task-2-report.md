# Task 2 Report: Auth Hydration Layer (`memberAuth.ts`)

- **Status:** DONE
- **Files Modified:**
  - `src/lib/memberAuth.ts` (Updated `fetchAuthenticatedMember` to query `member_permissions` with `user.id`)
  - `src/lib/__tests__/memberAuth.test.ts` (Added assertions verifying `member_permissions` queried by `member_id`)
- **Commit:** `539aa86` (`feat(auth): hydrate member permissions from member_permissions table`)
- **Tests:** 10/10 in `memberAuth.test.ts` passed; all 182 tests in suite passed.
