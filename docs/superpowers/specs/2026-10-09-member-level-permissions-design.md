# Design Spec: Individual Member-Level Permissions System (สิทธิ์การใช้งานรายบุคคล)

- **Date:** 2026-10-09
- **Status:** Approved Draft
- **Target Route / Module:** `/member/settings`, `src/lib/taskPermissionResolver.ts`, `src/lib/memberAuth.ts`, `src/app/api/member/permissions/**`

---

## 1. Overview & Problem Statement

### 1.1 Context
Previously, permissions in the hospital intranet portal were mapped by job title strings (`position_permissions` mapped to `members.position`, e.g., "พยาบาลวิชาชีพ", "นักวิชาการคอมพิวเตอร์"). 

### 1.2 Problems
1. **Ambiguous Job Roles:** Staff sharing the same job title (e.g. "พยาบาลวิชาชีพ" or "เจ้าพนักงานธุรการ") often work in entirely different departments or hold different operational responsibilities. Mapping permissions to job title strings resulted in loose or inappropriate access.
2. **Lack of Approve-Only Distinction:** Supervisors and executives need the ability to review and sign/approve requests without having permission to alter ticket contents, reassign technicians, or edit system settings.

### 1.3 Solution
Migrate to **Direct Individual Member-Level Permissions (สิทธิ์รายบุคคล)**:
- Permissions are assigned directly to individual `member_id` records in a new `member_permissions` table.
- Permissions are strictly categorized by action (`take_*`, `approve_*`, `manage_*`, `view_*`).
- Authorization resolvers (`taskPermissionResolver.ts`) evaluate `member.permissions` directly, removing brittle position-string heuristics (`userPos.includes(...)`).
- UI in `/member/settings` provides an intuitive search/filter member interface with explicit categorized checkboxes (no presets/templates).

---

## 2. Database Schema Design

### 2.1 New Table: `member_permissions`
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

Add the relation to `Member` in `prisma/schema.prisma`:
```prisma
model Member {
  // ... existing fields ...
  member_permissions MemberPermission[]
  // ...
}
```

---

## 3. Permission Keys Matrix

| Category | Permission Key | Label (Thai) | Description & Access Scope |
|---|---|---|---|
| **งานซ่อมบำรุง** | `take_repairs_it` | รับงานซ่อมคอมพิวเตอร์และไอที | สิทธิ์รับงานและบันทึกผลซ่อมคอมพิวเตอร์/ไอที |
| | `take_repairs_general` | รับงานซ่อมบำรุงทั่วไป | สิทธิ์รับงานและบันทึกผลซ่อมทั่วไป/อาคารสถานที่ |
| | `take_repairs_medical` | รับงานซ่อมเครื่องมือแพทย์ | สิทธิ์รับงานและบันทึกผลซ่อมเครื่องมือทางการแพทย์ |
| | `approve_repairs` | ผู้อนุมัติงานซ่อม (Approve Only) | สิทธิ์ลงนามอนุมัติตรวจรับงาน/แทงชำรุด **ห้ามแก้ไขคำขอ** |
| | `manage_repairs` | ดูแลและบริหารงานซ่อม | หัวหน้างานช่าง มอบหมายงาน กำหนดช่าง พักงาน แก้ไขข้อมูล |
| | `view_it_repairs` | ดูงานซ่อมไอที (Read-Only) | สิทธิ์เปิดดูงานซ่อมไอทีทั้งหมดในระบบ |
| | `view_general_repairs` | ดูงานซ่อมทั่วไป (Read-Only) | สิทธิ์เปิดดูงานซ่อมทั่วไปทั้งหมดในระบบ |
| | `view_medical_repairs` | ดูงานซ่อมเครื่องมือแพทย์ (Read-Only) | สิทธิ์เปิดดูงานซ่อมเครื่องมือแพทย์ทั้งหมดในระบบ |
| | `view_all_work` | ดูงานช่างทุกสายงาน (Global View) | ดูงานช่างและคำขอทุกประเภทในระบบ |
| | `view_department_tasks` | ดูงานในหน่วยงานของตนเอง | ดูงานทั้งหมดที่สร้างโดยสมาชิกในหน่วยงานตนเอง |
| **งานสื่อ & ประชาสัมพันธ์** | `produce_media` | ผู้ผลิตสื่อประชาสัมพันธ์ | สิทธิ์รับงาน ดำเนินการผลิตสื่อ และอัปโหลดผลงาน |
| | `approve_media` | ผู้อนุมัติงานสื่อ (Approve Only) | สิทธิ์ลงนามอนุมัติคำขอผลิตสื่อ |
| | `manage_media_requests` | ดูแลระบบขอสื่อประชาสัมพันธ์ | มอบหมายงาน และตรวจสอบขั้นตอนคำขอสื่อทั้งหมด |
| | `manage_news` | จัดการข่าวประชาสัมพันธ์ | เขียน แก้ไข และเผยแพร่ข่าวหน้าเว็บไซต์ |
| **งานพัสดุ & สถานที่** | `manage_assets` | จัดการข้อมูลครุภัณฑ์ | จัดการทะเบียนครุภัณฑ์ ค้นหา และตรวจสอบสถานะ |
| | `manage_locations` | จัดการข้อมูลสถานที่ | จัดการข้อมูลตึก ชั้น และห้อง |
| **งานบริหาร & การเงิน** | `manage_inbox` | ดูแลระบบกล่องงานกลาง | ติดตามสถานะและจัดการขั้นตอนเอกสารภาพรวม |
| | `manage_ethics` | จัดการเอกสารจริยธรรม | จัดการหมวดหมู่และไฟล์จริยธรรม/ITA |
| | `upload_salary` | อัปโหลดข้อมูลสลิปเงินเดือน | เจ้าหน้าที่การเงินอัปโหลดข้อมูลเงินเดือนประจำเดือน |

---

## 4. UI / UX Design (`/member/settings`)

### 4.1 Layout & Navigation
In `/member/settings`, retain two main tabs:
1. **กำหนดสิทธิ์บุคลากร (Member Permissions):** จัดการสิทธิ์รายบุคคล
2. **ควบคุมโมดูลระบบ (System Modules):** เปิด/ปิดฟีเจอร์ของระบบสมาชิก

### 4.2 Member Permissions Management Component
- **Search & Filter Bar:**
  - Search input: ค้นหาด้วยชื่อ-นามสกุล, เลขบัตรประชาชน (Username), หรือกลุ่มงาน/ฝ่าย
  - Filter toggle: แสดงเฉพาะผู้ที่มีสิทธิ์พิเศษ (`Has Permissions`) / แสดงทุกคน
- **Member Selection List / Cards:**
  - แสดงชื่อ, ตำแหน่งเดิม, แผนก/ฝ่าย, จำนวนสิทธิ์ที่มี
  - แสดง Badges สิทธิ์ที่เปิดใช้งานอยู่
- **Permission Edit Modal / Drawer:**
  - แสดงข้อมูลบุคคลที่กำลังแก้ไข
  - แสดง Checkboxes แยกตามหมวดหมู่อย่างชัดเจน (งานซ่อมบำรุง, งานสื่อ, งานพัสดุ, งานบริหาร)
  - แต่ละ Checkbox มี Icon, Label ภาษาไทย, รหัสสิทธิ์ (Key), และคำอธิบายความรับผิดชอบ
  - ปุ่ม **"บันทึกสิทธิ์ (Save Changes)"** และปุ่ม **"ล้างสิทธิ์ทั้งหมด (Clear All)"**

---

## 5. Backend & Authorization Resolver

### 5.1 Hydrating Member Permissions (`src/lib/memberAuth.ts`)
Query permissions directly for the member:
```sql
SELECT permission_key FROM member_permissions WHERE member_id = ?
```
Populate `member.permissions` (`Set<string>`).

### 5.2 Permission Resolver Updates (`src/lib/taskPermissionResolver.ts`)
- Replace hardcoded string heuristics with direct permission checks:
  - `isITStaff` -> `hasPerm('take_repairs_it') || hasPerm('manage_repairs') || isAdmin`
  - `isTechStaff` -> `hasPerm('take_repairs_general') || hasPerm('take_repairs_medical') || hasPerm('manage_repairs') || isAdmin`
  - `isPrStaff` -> `hasPerm('produce_media') || hasPerm('manage_media_requests') || isAdmin`
- **Approval Rights (`canApprove`):**
  - Direct step assignee (`isCurrentAssignee`), OR
  - Has `approve_repairs` for repair tasks, OR
  - Has `approve_media` for media requests.
- **Editing Rights (`canEdit`):**
  - Admin, OR
  - Manager (`manage_repairs`, `manage_media_requests`, `manage_inbox`), OR
  - Assigned technician (`isTechnicianAssigned`, `isCoWorker`), OR
  - Operator with `take_repairs_*` / `produce_media`.
  - **Crucial Rule:** Users holding ONLY `approve_repairs` or `approve_media` are explicitly **DENIED `canEdit`**.

### 5.3 Audit Logging
All permission modifications via `/api/member/permissions/update` write Tier 1 compliance audit logs (`logAudit` with action `UPDATE_MEMBER_PERMISSIONS`).

---

## 6. Implementation Stages & Verification Plan

1. **Prisma & Migration:** Add `MemberPermission` model, execute `prisma db push` / `prisma generate`.
2. **API Endpoint:** Create `/api/member/permissions` (GET list, POST update with validation & audit).
3. **Auth & Resolver Updates:** Update `memberAuth.ts` and `taskPermissionResolver.ts`.
4. **UI Refactoring:** Overhaul `/member/settings` UI with member search, filter, and categorized checkboxes.
5. **Testing:** Run Vitest unit tests for permission resolvers and auth flow.
