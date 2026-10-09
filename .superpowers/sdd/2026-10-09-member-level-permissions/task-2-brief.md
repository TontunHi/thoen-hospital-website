# Task 2 Brief: Auth Hydration Layer (`memberAuth.ts`)

## Target Files
- Modify: `src/lib/memberAuth.ts`
- Modify: `src/lib/__tests__/memberAuth.test.ts`

## Requirements
1. In `src/lib/memberAuth.ts`, in `fetchAuthenticatedMember`:
   - Replace the query from `position_permissions` with a query against `member_permissions`:
     ```typescript
     queryMemberDb('SELECT permission_key FROM member_permissions WHERE member_id = ?', [user.id])
     ```
   - Ensure `user.id` is passed correctly and permissions are stored in `permissions` (`Set<string>`).
2. In `src/lib/__tests__/memberAuth.test.ts`:
   - Update mock queries and assertions to verify `member_permissions` is queried by `member_id` instead of `position_name`.
   - Ensure all tests in `memberAuth.test.ts` pass.
3. Run `cmd.exe /c "npx vitest run src/lib/__tests__/memberAuth.test.ts"`.
4. Commit changes: `git commit -m "feat(auth): hydrate member permissions from member_permissions table"`.
5. Write report to `.superpowers/sdd/2026-10-09-member-level-permissions/task-2-report.md`.
