# Task 4 Brief: API Endpoints for Member Permissions Management

## Target Files
- Create: `src/app/api/member/permissions/members/route.ts`
- Create: `src/app/api/member/permissions/update/route.ts`
- Create: `src/app/api/member/permissions/__tests__/permissionsApi.test.ts`

## Requirements
1. **`GET /api/member/permissions/members/route.ts`**:
   - Check admin session (return 401 if unauthenticated, 403 if not admin).
   - Read search query params: `search` (optional string), `hasPermissionsOnly` (optional 'true'/'false'/'1'/'0').
   - Query members (id, username, name, department, position, role) joined or mapped with their `member_permissions` (`permission_key`).
   - Filter by search string across `name`, `username`, `department`.
   - Filter `hasPermissionsOnly` if set.
   - Return `{ success: true, data: { members: [...] } }`.

2. **`POST /api/member/permissions/update/route.ts`**:
   - Check admin session (return 401 / 403).
   - Validate body using Zod schema:
     ```typescript
     const updateSchema = z.object({
       memberId: z.number().int().positive(),
       permissions: z.array(z.string().max(100)),
     })
     ```
   - Atomic replacement: delete existing `member_permissions` for `memberId`, then insert new rows for each key with `created_by: session.username`.
   - Call `logAudit('UPDATE_MEMBER_PERMISSIONS', 'members', `Updated permissions for member ${memberId}`, { memberId, permissions, admin: session.username })`.
   - Return `{ success: true, message: 'บันทึกสิทธิ์เรียบร้อยแล้ว' }`.

3. **`src/app/api/member/permissions/__tests__/permissionsApi.test.ts`**:
   - Test GET members endpoint: 401 unauthorized, 403 non-admin, 200 with members and permissions.
   - Test POST update endpoint: 401/403 checks, validation errors on invalid body, 200 success with audit logging called.

4. Run `cmd.exe /c "npx vitest run src/app/api/member/permissions/__tests__/permissionsApi.test.ts"`.
5. Commit changes: `git commit -m "feat(api): create member permissions list and update API endpoints"`.
6. Write report to `.superpowers/sdd/2026-10-09-member-level-permissions/task-4-report.md`.
