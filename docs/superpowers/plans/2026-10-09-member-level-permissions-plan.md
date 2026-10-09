# Member-Level Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement individual member-level permissions (`member_permissions`), decoupling authorizations from job-title strings and cleanly separating `canApprove` from `canEdit`.

**Architecture:** A new Prisma model `MemberPermission` links granular permission keys directly to `members.id`. `memberAuth.ts` hydrates `member.permissions` from this table. `taskPermissionResolver.ts` enforces role/action separation (Approve-Only vs Edit/Manager). A modernized UI in `/member/settings` allows administrators to search staff and assign checkboxes per action.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma ORM, MySQL (thoen_hos_web_dev), Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-member-level-permissions-design.md`

## Global Constraints

- Never query raw DB in API routes; keep routes thin (~20-40 lines) delegating to domain services.
- Never hardcode database credentials; load from `DATABASE_URL`.
- Log all permission mutations to `audit_logs` via `logAudit('UPDATE_MEMBER_PERMISSIONS', 'members', ...)`.
- Buddhist calendar (พ.ศ.) for UI date formatting.
- `canApprove` must never implicitly grant `canEdit` for approval-only keys (`approve_repairs`, `approve_media`).

## Review Focus

1. **Approve-only user attempting to edit:** Ensure `resolveTaskPermissions` returns `canApprove: true` and `canEdit: false` for a user holding only `approve_repairs`.
2. **Admin override:** Ensure `role: 'admin'` or `isAdmin: true` retains unrestricted permissions (`canView: true`, `canEdit: true`, `canApprove: true`).
3. **Empty / Non-existent permissions:** Ensure members without rows in `member_permissions` gracefully receive base user access without crashing.
4. **Member deletion cascade:** Ensure deleting a member cascades to their records in `member_permissions`.
5. **Session cache / freshness:** Ensure permission changes take effect immediately on subsequent page loads / token re-hydrations.

---

### Task 1: Database Model & Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `src/lib/__tests__/memberPermissionDb.test.ts`

**Interfaces:**
- Produces: `prisma.memberPermission` (`findMany`, `createMany`, `deleteMany`)

- [ ] **Step 1: Write the test verifying MemberPermission queries**

```typescript
// src/lib/__tests__/memberPermissionDb.test.ts
import { describe, it, expect } from 'vitest'
import prisma from '@/lib/prisma'

describe('MemberPermission Database Schema', () => {
  it('should allow querying member permissions by memberId', async () => {
    const permissions = await prisma.memberPermission.findMany({
      where: { memberId: 1 }
    })
    expect(Array.isArray(permissions)).toBe(true)
  })
})
```

- [ ] **Step 2: Add `MemberPermission` model to `prisma/schema.prisma`**

```prisma
model MemberPermission {
  id            Int      @id @default(autoincrement())
  memberId      Int      @map("member_id")
  permissionKey String   @map("permission_key") @db.VarChar(100)
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamp(0)
  createdBy     String?  @map("created_by") @db.VarChar(100)

  member        Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([memberId, permissionKey], map: "uq_member_permission")
  @@index([memberId], map: "idx_member_perm_id")
  @@index([permissionKey], map: "idx_member_perm_key")
  @@map("member_permissions")
}
```
And add `member_permissions MemberPermission[]` inside `model Member`.

- [ ] **Step 3: Run db push & prisma generate**

Run: `cmd.exe /c "npx prisma db push && npx prisma generate"`
Expected: Generated Prisma Client and synchronized schema with `thoen_hos_web_dev`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run src/lib/__tests__/memberPermissionDb.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/lib/__tests__/memberPermissionDb.test.ts
git commit -m "feat(db): add MemberPermission model and schema migration"
```

---

### Task 2: Auth Hydration Layer (`memberAuth.ts`)

**Files:**
- Modify: `src/lib/memberAuth.ts`
- Modify: `src/lib/__tests__/memberAuth.test.ts`

**Interfaces:**
- Consumes: `member_permissions` table
- Produces: `fetchAuthenticatedMember(username, email)` with `member.permissions` populated from `member_permissions`.

- [ ] **Step 1: Write failing test for memberAuth fetching member_permissions**

Update `src/lib/__tests__/memberAuth.test.ts` to expect permissions queried from `member_permissions WHERE member_id = ?`.

- [ ] **Step 2: Update `fetchAuthenticatedMember` in `src/lib/memberAuth.ts`**

Change query from `position_permissions` to `SELECT permission_key FROM member_permissions WHERE member_id = ?`.

- [ ] **Step 3: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run src/lib/__tests__/memberAuth.test.ts"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/memberAuth.ts src/lib/__tests__/memberAuth.test.ts
git commit -m "feat(auth): hydrate member permissions from member_permissions table"
```

---

### Task 3: Task Permission Resolver Updates (`taskPermissionResolver.ts`)

**Files:**
- Modify: `src/lib/taskPermissionResolver.ts`
- Modify: `src/lib/__tests__/taskPermissionResolver.test.ts`

**Interfaces:**
- Consumes: `member.permissions` (`Set<string>` or `string[]`)
- Produces: `resolveTaskPermissions(member, task, options): TaskPermissionsResult`

- [ ] **Step 1: Write failing tests in `taskPermissionResolver.test.ts`**

Cover:
- User with `approve_repairs` has `canApprove: true` and `canEdit: false`
- User with `take_repairs_it` has `isITStaff: true`, `canTakeJob: true`, `canEdit: true`
- User with `approve_media` has `canApprove: true` and `canEdit: false`
- User with `manage_repairs` has `canEdit: true`, `canTakeJob: true`, `canHold: true`

- [ ] **Step 2: Update `resolveTaskPermissions` in `src/lib/taskPermissionResolver.ts`**

Remove string-matching heuristics (`userPos.includes(...)`), rely strictly on permission keys:
- `isITStaff`: `hasPerm('take_repairs_it') || hasPerm('manage_repairs') || isAdmin`
- `isTechStaff`: `hasPerm('take_repairs_general') || hasPerm('take_repairs_medical') || hasPerm('manage_repairs') || isAdmin`
- `isPrStaff`: `hasPerm('produce_media') || hasPerm('manage_media_requests') || isAdmin`
- `canApprove`: `isCurrentAssignee || (isRepairTask && hasPerm('approve_repairs')) || (isMediaTask && hasPerm('approve_media'))`
- `canEdit`: Enforce that `approve_repairs` alone does NOT grant `canEdit`.

- [ ] **Step 3: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run src/lib/__tests__/taskPermissionResolver.test.ts"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/taskPermissionResolver.ts src/lib/__tests__/taskPermissionResolver.test.ts
git commit -m "feat(resolver): update task permission resolver to use member-level permissions"
```

---

### Task 4: API Endpoints for Member Permissions Management

**Files:**
- Create: `src/app/api/member/permissions/members/route.ts`
- Create: `src/app/api/member/permissions/update/route.ts`
- Create: `src/app/api/member/permissions/__tests__/permissionsApi.test.ts`

**Interfaces:**
- `GET /api/member/permissions/members?search=&hasPermissionsOnly=` -> `{ success: true, data: { members: MemberPermissionDto[] } }`
- `POST /api/member/permissions/update` -> `{ memberId: number, permissions: string[] }` -> `{ success: true }`

- [ ] **Step 1: Write failing tests for permissions API endpoints**

Test GET members list and POST update permissions with audit logging.

- [ ] **Step 2: Implement `GET /api/member/permissions/members/route.ts`**

Admin session verification -> query members with their associated `member_permissions` -> return JSON.

- [ ] **Step 3: Implement `POST /api/member/permissions/update/route.ts`**

Admin session verification -> validate input with Zod -> execute transaction to replace `member_permissions` for `memberId` -> call `logAudit('UPDATE_MEMBER_PERMISSIONS', 'members', ...)` -> return JSON.

- [ ] **Step 4: Run tests to verify API endpoints pass**

Run: `cmd.exe /c "npx vitest run src/app/api/member/permissions/__tests__/permissionsApi.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/member/permissions/
git commit -m "feat(api): create member permissions list and update API endpoints"
```

---

### Task 5: Refactor Settings UI in `/member/settings`

**Files:**
- Modify: `src/app/member/settings/SettingsClient.tsx`
- Modify: `src/app/member/settings/settings.css`

**Interfaces:**
- Consumes: `/api/member/permissions/members`, `/api/member/permissions/update`

- [ ] **Step 1: Update `PERMISSIONS_METADATA` and UI State**

Define the 19 granular permission keys categorized under Repairs, Media, Facility, Governance.

- [ ] **Step 2: Build Searchable Member List Component**

Search by name / citizen ID / department, filter toggle for special permissions, card showing active badges.

- [ ] **Step 3: Build Permission Edit Modal / Drawer**

Categorized checkboxes with clear Thai labels and descriptions, Save Changes button, Clear All button. (No presets/templates).

- [ ] **Step 4: Connect API & Toast Feedback**

Wire up `fetchMembers` on mount/search and `saveMemberPermissions` on modal save.

- [ ] **Step 5: Verify UI in browser / build check**

Run: `cmd.exe /c "npx next lint"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/member/settings/SettingsClient.tsx src/app/member/settings/settings.css
git commit -m "feat(ui): overhaul member permissions management UI in settings"
```

---

### Task 6: Full Regression & Verification

**Files:**
- All tests across test suite

- [ ] **Step 1: Run complete test suite**

Run: `cmd.exe /c "npm run test"`
Expected: ALL PASS

- [ ] **Step 2: Run Prisma validation & Next build check**

Run: `cmd.exe /c "npx prisma validate && npm run build"`
Expected: Build succeeds with zero errors.

- [ ] **Step 3: Final Commit & Summary**

```bash
git commit -m "chore: verify full test suite and build for member permissions system"
```
