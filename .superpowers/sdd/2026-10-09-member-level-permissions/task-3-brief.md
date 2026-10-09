# Task 3 Brief: Task Permission Resolver Updates (`taskPermissionResolver.ts`)

## Target Files
- Modify: `src/lib/taskPermissionResolver.ts`
- Modify: `src/lib/__tests__/taskPermissionResolver.test.ts`

## Requirements
1. In `src/lib/taskPermissionResolver.ts`:
   - Replace position string checks (`userPos.includes(...)`) with permission-based checks (`hasPerm(...)`).
   - Define role heuristics:
     - `isITStaff`: `hasPerm('take_repairs_it') || hasPerm('manage_repairs') || isAdmin`
     - `isTechStaff`: `hasPerm('take_repairs_general') || hasPerm('take_repairs_medical') || hasPerm('manage_repairs') || isAdmin`
     - `isPrStaff`: `hasPerm('produce_media') || hasPerm('manage_media_requests') || isAdmin`
   - **`canApprove`**:
     - `isCurrentAssignee || (isRepairTask && hasPerm('approve_repairs') && (task.status === 'PENDING' || task.status === 'IN_PROGRESS')) || (isMediaTask && hasPerm('approve_media') && (task.status === 'PENDING' || task.status === 'IN_PROGRESS'))`
   - **`canEdit`**:
     - Admin, OR
     - `hasPerm('manage_inbox')` / `hasPerm('view_all_work')`, OR
     - For repair tasks: `hasPerm('manage_repairs') || hasPerm('take_repairs_it') || hasPerm('take_repairs_general') || hasPerm('take_repairs_medical') || isTechnicianAssigned || isCoWorker`, OR
     - For media tasks: `hasPerm('manage_media_requests') || hasPerm('produce_media')`, OR
     - Requester: `isRequester && ['PENDING', 'SENT_BACK', 'IN_PROGRESS', 'ON_HOLD'].includes(task.status)`, OR
     - Direct assignee: `isCurrentAssignee && !hasPerm('approve_repairs') && !hasPerm('approve_media')` (Step signers approve via canApprove, but cannot edit ticket fields unless they have edit rights).
     - **CRITICAL:** A member having ONLY `approve_repairs` or `approve_media` MUST NOT receive `canEdit: true`.
   - **`canTakeJob`**:
     - For repair tasks: `isAdmin || hasPerm('manage_repairs') || hasPerm('take_repairs_it') || hasPerm('take_repairs_general') || hasPerm('take_repairs_medical') || isTechnicianAssigned || isCoWorker`
     - For media tasks: `isAdmin || hasPerm('manage_media_requests') || hasPerm('produce_media')`
   - **`canViewSpecificType`**:
     - `task.task_type === 'IT_REPAIR' && (hasPerm('view_it_repairs') || hasPerm('take_repairs_it') || hasPerm('manage_repairs'))`
     - `task.task_type === 'GENERAL_REPAIR' && (hasPerm('view_general_repairs') || hasPerm('take_repairs_general') || hasPerm('manage_repairs'))`
     - `task.task_type === 'MEDICAL_REPAIR' && (hasPerm('view_medical_repairs') || hasPerm('take_repairs_medical') || hasPerm('manage_repairs'))`
     - `task.task_type === 'MEDIA_REQUEST' && (hasPerm('view_media_requests') || hasPerm('produce_media') || hasPerm('manage_media_requests'))`
     - `hasPerm('view_department_tasks') && Boolean(userDept && task.requester_dept === userDept)`
     - `hasPerm('view_all_work')`
2. In `src/lib/__tests__/taskPermissionResolver.test.ts`:
   - Update and add comprehensive tests for all permutations.
   - Assert `approve_repairs` grants `canApprove: true` and `canEdit: false`.
   - Assert `take_repairs_it` grants `canTakeJob: true`, `canEdit: true`, `isITStaff: true`.
   - Assert `manage_repairs` grants `canEdit: true`, `canTakeJob: true`, `canHold: true`.
3. Run `cmd.exe /c "npx vitest run src/lib/__tests__/taskPermissionResolver.test.ts"`.
4. Commit changes: `git commit -m "feat(resolver): update task permission resolver to use member-level permissions"`.
5. Write report to `.superpowers/sdd/2026-10-09-member-level-permissions/task-3-report.md`.
