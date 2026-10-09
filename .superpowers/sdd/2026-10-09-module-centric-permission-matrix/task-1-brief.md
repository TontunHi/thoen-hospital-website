# Task 1 Brief: Batch Update API Endpoint

## Role: API Implementer

You are responsible for completing **Task 1** of the Module-Centric Permission Matrix project.

### Goals
1. Create `src/app/api/member/permissions/batch-update/route.ts` to allow updating permissions for multiple members in a single atomic transaction.
2. Create `src/app/api/member/permissions/__tests__/batchUpdateApi.test.ts` with comprehensive unit tests.

### Requirements & Rules
- Endpoint: `POST /api/member/permissions/batch-update`
- Authorization: Enforce admin session via `requireRole(['admin'])`. Return 401 if unauthenticated, 403 if not admin.
- Validation: Zod schema validating:
  ```typescript
  const batchSchema = z.object({
    updates: z.array(
      z.object({
        memberId: z.number().int().positive(),
        permissions: z.array(z.string().min(1))
      })
    ).min(1)
  })
  ```
- Database Operation:
  - Run inside a single Prisma `$transaction(async (tx) => { ... })`.
  - For each item in `updates`:
    - Delete existing `member_permissions` for `memberId` (`tx.memberPermission.deleteMany({ where: { memberId } })`).
    - Deduplicate and trim permission keys.
    - If `cleanPerms.length > 0`, insert new records (`tx.memberPermission.createMany({ data: cleanPerms.map(key => ({ memberId, permission_key: key, createdBy: session.username })) })`).
  - Return `{ success: true, updatedCount: updates.length }`.
- Audit Logging:
  - Call `logAudit('BATCH_UPDATE_MEMBER_PERMISSIONS', 'members', JSON.stringify({ updatedCount: updates.length, memberIds: updates.map(u => u.memberId) }), session.username)`.
- Error Handling:
  - Return 400 with `{ error: string }` on invalid JSON or Zod schema errors.
  - Return 500 with `{ error: 'Internal Server Error' }` on unexpected database exceptions.

### Verification Steps
1. Write failing tests in `src/app/api/member/permissions/__tests__/batchUpdateApi.test.ts`.
2. Implement `src/app/api/member/permissions/batch-update/route.ts`.
3. Run `cmd.exe /c "npx vitest run src/app/api/member/permissions/__tests__/batchUpdateApi.test.ts"`.
4. Run full suite `cmd.exe /c "npx vitest run"`.
5. Commit changes with message `feat(api): add batch update endpoint for member permissions`.
6. Write completion report to `c:\Users\Tontun\Downloads\thoen-hospital-website-dev\.superpowers\sdd\2026-10-09-module-centric-permission-matrix\task-1-report.md`.
7. Report status DONE.
