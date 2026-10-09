# Task 2 Brief: Module-Centric Matrix Table Component & State Management

## Role: UI Implementer

You are responsible for completing **Task 2** of the Module-Centric Permission Matrix project.

### Target Files to Modify
- `src/app/member/settings/SettingsClient.tsx`

### Goals & Features to Implement
1. **Module Selector Pills/Tabs**:
   - `[🛠️ งานแจ้งซ่อมบำรุง]`, `[🎨 สื่อ & ประชาสัมพันธ์]`, `[📦 พัสดุ & สถานที่]`, `[📋 ธรรมาภิบาล & สารบรรณ]`, `[💰 การเงิน & บุคลากร]`, `[📊 ภาพรวมทุกสิทธิ์ (All)]`
2. **Filter & Search Bar**:
   - Real-time search by staff name, masked citizen ID (`x-xxxx-xxxx1-23-4`), or department.
   - Department dropdown select (populated from unique `member.department` values + "ทุกกลุ่มงาน").
   - Toggle switch / filter chip: "แสดงเฉพาะผู้มีสิทธิ์ในโมดูลนี้".
   - Visible staff counter.
3. **Interactive Matrix Table**:
   - Clean tabular display with columns:
     - `[บุคลากร]` (Avatar circle, Name, Department, Masked Username/CID)
     - `[👁️ View (ดูข้อมูล)]` (Checkbox)
     - `[🔧 Edit/Do (ปฏิบัติงาน)]` (Checkbox)
     - `[✍️ Approve (อนุมัติ)]` (Checkbox with distinct gold/emerald Approve-Only styling)
     - `[👑 Manage (ผู้ดูแลโมดูล)]` (Checkbox with distinct purple/indigo styling)
     - `[สิทธิ์รวม]` (Badge showing active permissions count + detailed edit button)
4. **Fast Inline Checkbox Toggling & Dirty State**:
   - Maintain `stagedPermissions: Record<number, string[]>` tracking uncommitted changes.
   - Toggling any checkbox immediately updates the staged state with zero lag.
   - If a member's staged permissions match their original server state, remove them from `stagedPermissions`.
5. **Bulk Department Actions**:
   - "เลือกสิทธิ์ View ทั้งหมดในกลุ่มงานที่แสดง", "เลือกสิทธิ์ Edit ทั้งหมด...", "ล้างสิทธิ์ทั้งหมดในกลุ่มงานที่แสดง".
6. **Sticky Batch Save Bar**:
   - Floats at the bottom when `Object.keys(stagedPermissions).length > 0`.
   - Displays number of modified staff (e.g., "มีการปรับปรุงสิทธิ์ 3 คนที่ยังไม่ได้บันทึก").
   - "ยกเลิกการเปลี่ยนแปลง" (Discard changes).
   - "บันทึกการเปลี่ยนแปลงทั้งหมด (X คน)" (Calls `POST /api/member/permissions/batch-update`).
   - Loading indicator while saving.
7. **Verification**:
   - Run `cmd.exe /c "npx tsc --noEmit"`.
   - Run `cmd.exe /c "npx vitest run"`.
   - Write report to `.superpowers/sdd/2026-10-09-module-centric-permission-matrix/task-2-report.md`.
   - Report status DONE.
