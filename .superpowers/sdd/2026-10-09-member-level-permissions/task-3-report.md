# Task 3 Report: Task Permission Resolver Updates (`taskPermissionResolver.ts`)

- **Status:** DONE
- **Files Modified:**
  - `src/lib/taskPermissionResolver.ts` (Refactored to check `member.permissions` instead of job-title strings, separating `canApprove` and `canEdit` for Approve-Only roles)
  - `src/lib/__tests__/taskPermissionResolver.test.ts` (Expanded to 15 unit tests covering all action combinations)
- **Key Invariants Verified:**
  - `approve_repairs` / `approve_media` users have `canApprove: true` and `canEdit: false`
  - `take_repairs_it` grants `canTakeJob: true`, `canEdit: true`, `isITStaff: true`
  - `manage_repairs` grants `canEdit: true`, `canTakeJob: true`, `canHold: true`
  - Admin retains full rights.
- **Tests:** 15/15 tests in `taskPermissionResolver.test.ts` passed; 189/189 tests across entire suite passed.
