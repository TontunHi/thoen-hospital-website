# Module-Centric Permission Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a fast, intuitive **Module-Centric Permission Matrix** in `/member/settings` with a 4-action checkbox grid (`View`, `Edit`, `Approve`, `Manage`), instant search, department filtering, and batch updates.

**Architecture:** A module-segmented matrix interface backed by a new batch API endpoint (`/api/member/permissions/batch-update`) that updates multiple members' permissions inside a single Prisma transaction with full audit logging. The UI maintains a staged `dirtyMap` and renders a sticky batch-save bar.

**Tech Stack:** Next.js 16 (React 19, Turbopack), TypeScript, Prisma ORM, Tailwind/CSS modules, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-module-centric-permission-matrix-design.md`

## Global Constraints
- Database: `thoen_hos_web_dev` on `192.168.1.7:3306`.
- Windows / PowerShell environment: Wrap all npm/npx commands in `cmd.exe /c "..."`.
- Strict PDPA Citizen ID masking in UI (`x-xxxx-xxxx1-23-4` or last 4 digits visible).
- `approve_repairs` and `approve_media` must strictly retain Approve-Only behavior (`canApprove: true`, `canEdit: false` in resolver).
- All batch updates must log an audit entry via `logAudit('BATCH_UPDATE_MEMBER_PERMISSIONS', 'members', ...)`.
- Zero preset template buttons.

## Review Focus
1. Atomic Batch Transaction: If one member update in a batch fails, the entire transaction must roll back cleanly.
2. Filter & Dirty State Preservation: Switching search queries or department dropdown filters must NOT discard staged uncommitted edits in `dirtyMap`.
3. Approve-Only Safety: Toggling `Approve` must not silently grant `Edit` or `Manage` rights.
4. Department Bulk Check: Checking all members in a filtered department must correctly update staged permissions for only the matching members.
5. Large Staff Volume Performance: Table rendering must be fast and responsive for 100+ to 500+ hospital staff members.

---

### Task 1: Batch Update API Endpoint

**Files:**
- Create: `src/app/api/member/permissions/batch-update/route.ts`
- Create: `src/app/api/member/permissions/__tests__/batchUpdateApi.test.ts`

**Interfaces:**
- Consumes: `requireRole` from `@/lib/memberAuth`, `prisma` from `@/lib/prisma`, `logAudit` from `@/lib/audit`
- Produces: `POST /api/member/permissions/batch-update` -> `{ success: true, updatedCount: number }`

- [ ] **Step 1: Write failing unit tests for batch update API**

```typescript
// Test unauthorized, invalid schema, empty updates array, successful transaction replacement, and audit logging
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npx vitest run src/app/api/member/permissions/__tests__/batchUpdateApi.test.ts"`  
Expected: FAIL (route does not exist)

- [ ] **Step 3: Implement `src/app/api/member/permissions/batch-update/route.ts`**

Zod validation schema:
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
Run atomic `$transaction` mapping over all `updates`: delete existing permissions for `memberId` and create new records with `createdBy: session.username`. Call `logAudit`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run src/app/api/member/permissions/__tests__/batchUpdateApi.test.ts"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/member/permissions/
git commit -m "feat(api): add batch update endpoint for member permissions"
```

---

### Task 2: Module-Centric Matrix Table Component & State Management

**Files:**
- Modify: `src/app/member/settings/SettingsClient.tsx`

**Interfaces:**
- Consumes: `GET /api/member/permissions/members`, `POST /api/member/permissions/batch-update`
- Produces: Interactive Matrix UI with 4 action checkboxes per module, department selector, instant search, dirty state tracker, and sticky save bar.

- [ ] **Step 1: Define Module Action Mappings & Metadata**

Map `View`, `Edit`, `Approve`, `Manage` for each of the 5 modules: `repairs`, `media`, `facility`, `governance`, `finance`, plus an `all` overview mode.

- [ ] **Step 2: Implement Department Filter & Real-Time Search**

Extract unique departments from loaded members list. Provide search input and department select dropdown. Add toggle "แสดงเฉพาะผู้มีสิทธิ์ในโมดูลนี้".

- [ ] **Step 3: Implement Interactive Matrix Grid Table**

Render staff rows with Avatar, Full Name, Department, Masked Username, and inline Checkboxes for `View`, `Edit`, `Approve`, `Manage`. Checking any box updates staged state `dirtyMap: Record<number, string[]>`.

- [ ] **Step 4: Implement Bulk Action Helpers & Sticky Batch Save Bar**

Add "เลือกทั้งหมดในกลุ่มงานนี้" / "ล้างทั้งหมดในกลุ่มงานนี้" helper. Render floating sticky save bar when `Object.keys(dirtyMap).length > 0` with Save and Discard actions.

- [ ] **Step 5: Verify with Vitest & Typecheck**

Run: `cmd.exe /c "npx tsc --noEmit"`  
Expected: PASS with 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/app/member/settings/SettingsClient.tsx
git commit -m "feat(ui): implement module-centric permission matrix grid and batch state"
```

---

### Task 3: Matrix Grid Styling & Visual Feedback

**Files:**
- Modify: `src/app/member/settings/settings.css`

**Interfaces:**
- Produces: Clean, modern styling for the Matrix table, department selector toolbar, action checkbox cells, Approve-Only gold highlight, Manage purple highlight, and floating sticky batch save bar.

- [ ] **Step 1: Add Matrix Table & Fixed Header Styles**

Table layout with sticky headers, zebra striping, row hover effects, and responsive scrolling for small screens.

- [ ] **Step 2: Style Action Checkboxes & Role Badges**

Distinct colors:
- View: Teal / Sky Blue
- Edit: Blue / Emerald
- Approve: Gold / Amber with shield icon (Approve-Only)
- Manage: Purple / Indigo (Administrator)

- [ ] **Step 3: Style Floating Sticky Save Bar**

Bottom fixed action bar with slide-up animation, dirty count badge, discard button, and primary save button with loading spinner.

- [ ] **Step 4: Verify with Vitest & Lint**

Run: `cmd.exe /c "npx vitest run"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/member/settings/settings.css
git commit -m "feat(styles): add responsive styles for module-centric permission matrix"
```

---

### Task 4: Full Regression & Verification

**Files:**
- All test suites across the project

- [ ] **Step 1: Run complete Vitest suite**

Run: `cmd.exe /c "npx vitest run"`  
Expected: All 29+ test suites passed.

- [ ] **Step 2: Run TypeScript & Prisma validation**

Run: `cmd.exe /c "npx tsc --noEmit && npx prisma validate"`  
Expected: PASS

- [ ] **Step 3: Verify dev server in browser**

Verify `http://localhost:3000/member/settings` loads fast and all matrix actions work seamlessly.
