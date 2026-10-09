# Task 5 Brief: Settings UI Refactor for Member-level Permissions

## Role: UI Implementer

You are responsible for completing **Task 5** of the Member-level Permissions project.

### Context & Goals
1. Replace the position-based permission mapping UI in `/member/settings` with a direct **Member-Level Permissions Management UI**.
2. Staff members are loaded from `GET /api/member/permissions/members?search=&hasPermissionsOnly=`.
3. Updating a member's permissions is sent to `POST /api/member/permissions/update` with `{ memberId, permissions: string[] }`.
4. **CRITICAL USER CONSTRAINT:** **DO NOT** include quick preset/template buttons (e.g., "Preset หัวหน้ากลุ่มงาน", "Preset ช่าง", "One-Click Templates"). Keep the interface direct, manual, clean, and explicit with categorized checkboxes.

### Target Files to Modify
1. `src/app/member/settings/SettingsClient.tsx`
2. `src/app/member/settings/settings.css`

### Detailed Requirements

#### 1. Permissions Metadata
Include all granular permissions with clear Thai labels, descriptions, categories, and icons:
- **Repairs & Maintenance (`repairs`)**:
  - `manage_inbox`: ดูแลระบบกล่องงานและสายการอนุมัติ
  - `manage_repairs`: ดูแลระบบแจ้งซ่อมและกล่องงานช่าง (หัวหน้าช่าง)
  - `approve_repairs`: อนุมัติ/ตรวจรับงานแจ้งซ่อมบำรุง (Approve-Only / สำหรับผู้บริหาร/หัวหน้างาน)
  - `take_repairs_general`: รับงานซ่อมบำรุงทั่วไป/ช่างซ่อม
  - `take_repairs_medical`: รับงานซ่อมเครื่องมือแพทย์
  - `view_all_work`: ดูแลระบบ/ดูงานช่างทั้งหมด (Read-only)
  - `view_it_repairs`: ดูงานแจ้งซ่อมคอมพิวเตอร์และไอที
  - `view_general_repairs`: ดูงานแจ้งซ่อมบำรุงทั่วไป
  - `view_medical_repairs`: ดูงานแจ้งซ่อมเครื่องมือแพทย์
  - `view_department_tasks`: ดูงานทั้งหมดในหน่วยงานของตนเอง
- **Media & PR (`media`)**:
  - `manage_media_requests`: ดูแลระบบขอสื่อประชาสัมพันธ์ (หัวหน้างานสื่อ)
  - `approve_media`: อนุมัติคำขอผลิตสื่อประชาสัมพันธ์ (Approve-Only / สำหรับผู้บริหาร/หัวหน้างาน)
  - `produce_media`: รับผิดชอบผลิตสื่อ/กราฟิก/วิดีโอ
  - `view_media_requests`: ดูงานขอสื่อประชาสัมพันธ์ทั้งหมด (Read-only)
  - `manage_news`: จัดการและลงข่าวประชาสัมพันธ์
- **Facility & Assets (`facility`)**:
  - `manage_assets`: จัดการข้อมูลครุภัณฑ์และพัสดุ
  - `manage_locations`: จัดการข้อมูลสถานที่ ตึก-ชั้น-ห้อง
- **Finance & HR (`finance`)**:
  - `upload_salary`: อัปโหลดเงินเดือน/ค่าตอบแทน
  - `view_all_salary`: ดูสลิปเงินเดือนบุคลากรทุกคน
- **Governance & Ethics (`governance`)**:
  - `manage_ita`: จัดการข้อมูลและบทความ ITA
  - `manage_rdu`: จัดการข้อมูลและเอกสาร RDU
  - `manage_ethics`: จัดการเอกสารชมรมจริยธรรม
  - `manage_outgoing_doc`: จัดการหนังสือส่งออก Online

#### 2. Tab Navigation & Statistics
- Tab 1: "เปิด-ปิดระบบบริการทั่วไป" (Feature toggles, keep as is).
- Tab 2: "จัดการสิทธิ์รายบุคคล" (Member Permissions).
- Stat Cards:
  - โมดูลระบบบริการ (Active modules / 7)
  - บุคลากรที่ได้รับสิทธิ์พิเศษ (Count of members having permissions.length > 0)
  - กฎสิทธิ์ที่มอบหมาย (Total sum of permissions assigned across all members)

#### 3. Member Search & Filter Bar
- Search input: by full name, CID/username, department.
- Filter toggle: Checkbox / Chip "เฉพาะผู้ที่มีสิทธิ์พิเศษ" (`hasPermissionsOnly`).
- Category tabs/chips to filter members by who has permissions in that category.
- Total members counter.

#### 4. Member List Display
- Clean card / row layout for each staff member:
  - Avatar or name initial badge
  - Full Name (`member.name`)
  - Department (`member.department || 'ไม่ระบุกลุ่มงาน'`)
  - Masked Citizen ID/Username (show last 4 digits per PDPA masking rule: `x-xxxx-xxxxx-xx-1` or `***1234`)
  - List of active permission tags/badges (with category color and icon)
  - If no special permissions: subtle text "สิทธิ์สมาชิกทั่วไป"
  - Action Button: "กำหนดสิทธิ์" / "แก้ไขสิทธิ์" (opens Edit Modal)

#### 5. Edit Permissions Modal / Dialog
- Modal header: Target member's name and department.
- Body: Categorized accordion or grouped sections with checkboxes for each permission.
- Special visual badge for "อนุมัติอย่างเดียว (Approve-Only)" permissions (`approve_repairs`, `approve_media`) to clearly indicate they only grant approval without edit capability.
- Category Quick Actions: "เลือกทั้งหมดในหมวดนี้", "ล้างในหมวดนี้" (pure utility, NOT preset templates).
- Bottom Action buttons:
  - "ล้างสิทธิ์ทั้งหมดของสมาชิกนี้" (Clear all)
  - "ยกเลิก" (Cancel)
  - "บันทึกการเปลี่ยนแปลง" (Save -> calls `POST /api/member/permissions/update`)
- Loading spinner while saving and disabled states.

#### 6. API Integration & Feedback
- Fetch members list with `GET /api/member/permissions/members?search=...&hasPermissionsOnly=...`.
- On save, POST to `/api/member/permissions/update`.
- On success: Toast notification, update local member permissions state, close modal.
- On error: Toast error message.

#### 7. Verification Steps
- Run `cmd.exe /c "npx vitest run"` to make sure existing tests remain green.
- Run `cmd.exe /c "npx prisma validate"` and Next.js lint or build checks if needed.
- Commit changes to git with message `feat(ui): overhaul member permissions management UI in settings`.
- Write completion report to `c:\Users\Tontun\Downloads\thoen-hospital-website-dev\.superpowers\sdd\2026-10-09-member-level-permissions\task-5-report.md`.
- Report status DONE.
