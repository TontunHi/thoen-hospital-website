# Task 3 Report: Task Permission Resolver Updates

## Summary of Changes
1. **Updated `src/lib/taskPermissionResolver.ts`**:
   - Replaced all brittle position string checks (`userPos.includes(...)`) with explicit member permission keys (`hasPerm(...)`).
   - Derived role heuristics strictly from granular permissions:
     - `isITStaff`: `hasPerm('take_repairs_it') || hasPerm('manage_repairs') || isAdmin`
     - `isTechStaff`: `hasPerm('take_repairs_general') || hasPerm('take_repairs_medical') || hasPerm('manage_repairs') || isAdmin`
     - `isPrStaff`: `hasPerm('produce_media') || hasPerm('manage_media_requests') || isAdmin`
   - Separated `canApprove` from `canEdit`:
     - `canApprove`: Evaluated when task is in `PENDING` or `IN_PROGRESS` status for `isCurrentAssignee`, `approve_repairs` (repair tasks), and `approve_media` (media tasks).
     - `canEdit`: Strictly enforces that members with only `approve_repairs` or `approve_media` receive `canEdit: false` (even if they are a step assignee).
   - Refined `canTakeJob` for repair tasks (scoped by repair subtype: `take_repairs_it`, `take_repairs_general`, `take_repairs_medical`, or global `manage_repairs`) and media tasks (`produce_media`, `manage_media_requests`).
   - Updated `canHold` and `canResume` to respect `manage_repairs` and `manage_media_requests`.
   - Updated `canViewSpecificType` and `canView` for granular permission matching.

2. **Expanded Tests in `src/lib/__tests__/taskPermissionResolver.test.ts`**:
   - Added 15 comprehensive unit tests covering:
     - Null / undefined guards
     - Admin full capabilities
     - Requester permissions & status transitions (PENDING vs COMPLETED)
     - `approve_repairs` granting `canApprove: true` and `canEdit: false`
     - `approve_repairs` assigned user retaining `canEdit: false`
     - `approve_media` granting `canApprove: true` and `canEdit: false`
     - `take_repairs_it` granting `canTakeJob: true`, `canEdit: true`, `isITStaff: true`
     - `manage_repairs` granting `canEdit: true`, `canTakeJob: true`, `canHold: true`, `canResume: true`
     - `produce_media` and `manage_media_requests`
     - Subtype isolation (`take_repairs_general` cannot take or edit `MEDICAL_REPAIR`)
     - Assigned technician and co-worker permissions
     - Department-level task visibility (`view_department_tasks`)

## Verification
- Unit test execution:
  - `cmd.exe /c "npx vitest run src/lib/__tests__/taskPermissionResolver.test.ts"`: **15 / 15 PASS**
- Full test suite:
  - `cmd.exe /c "npx vitest run"`: **27 test files, 189 tests PASS**

## Status
DONE
