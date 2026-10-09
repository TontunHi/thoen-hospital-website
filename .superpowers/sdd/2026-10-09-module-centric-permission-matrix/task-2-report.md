# Task 2 Report: Module-Centric Matrix Table Component & State Management

## Summary of Completed Work
- **Module Selector Tabs**:
  - Implemented 6 interactive module tabs: `[🛠️ งานแจ้งซ่อมบำรุง & กล่องงาน]`, `[🎨 สื่อ & ประชาสัมพันธ์]`, `[📦 พัสดุ & สถานที่]`, `[📋 ธรรมาภิบาล & สารบรรณ]`, `[💰 การเงิน & บุคลากร]`, and `[📊 ภาพรวมทุกสิทธิ์ (All)]`.
  - Displayed live active staff count badges on each tab pill.
- **Filter & Search Bar**:
  - Real-time search across staff names, citizen IDs (with PDPA masking `x-xxxx-xxxx1-23-4`), departments, positions, and permission keywords.
  - Department dropdown filter dynamically populated from unique sorted departments in the loaded member dataset.
  - Toggle filter chip for "แสดงเฉพาะผู้มีสิทธิ์ในโมดูลนี้" / "เฉพาะผู้มีสิทธิ์พิเศษ".
  - Visible vs total staff counter (`แสดง X จาก Y คน`).
- **Interactive Matrix Table**:
  - Implemented structured matrix table with responsive horizontal scroll and distinct role archetype columns:
    - `[บุคลากร (Staff Member)]`: Avatar circle with initials, Name, Admin/Staff badge, Department, Position, Masked CID, and unsaved "แก้ไขแล้ว" badge.
    - `[👁️ View (ดูข้อมูล)]`: Interactive checkbox pills for view-only permissions.
    - `[🔧 Edit/Do (ปฏิบัติงาน)]`: Interactive checkbox pills for operational/taking-job permissions.
    - `[✍️ Approve (อนุมัติ)]`: Checkbox pills with distinctive Approve-Only styling and tags.
    - `[👑 Manage (ผู้ดูแล)]`: Checkbox pills with distinctive Manage/Crown styling and tags.
    - `[สิทธิ์รวม / การจัดการ]`: Total permissions count badge, "แก้ไขละเอียด" modal button, and inline reset button.
  - For `all` mode, renders categorized summary badges for each module per staff member.
- **Fast Inline Toggling & Dirty State Management**:
  - Implemented `stagedPermissions: Record<number, string[]>` tracking uncommitted modifications.
  - Toggling inline checkboxes updates `stagedPermissions` instantaneously with zero lag.
  - Automatically cleans up `stagedPermissions` when a member's state returns to original server permissions.
  - Highlighted modified rows with amber accents (`matrixRowDirty`).
- **Bulk Department Actions**:
  - Implemented one-click bulk tools: "เลือก View ทั้งหมด", "เลือก Edit ทั้งหมด", and "ล้างสิทธิ์ในโมดูลนี้" for all currently visible/filtered staff members.
- **Sticky Batch Save Bar**:
  - Floating action bar appears at the bottom whenever `stagedPermissions` contains modified members.
  - Displays count of modified members with glowing indicator.
  - "ยกเลิกการเปลี่ยนแปลง" (Discard changes) resets `stagedPermissions` to empty.
  - "บันทึกการเปลี่ยนแปลงทั้งหมด (X คน)" sends `POST /api/member/permissions/batch-update` and updates local state upon success.
- **Verification**:
  - `npx tsc --noEmit`: Passed with 0 errors.
  - `npx vitest run`: 29/29 test suites passed (209/209 tests passed).
- **Git Commit**: Committed with message `feat(ui): implement module-centric permission matrix grid and batch state` (commit `c6b7834`).

## Status
DONE
