# Spec: Module-Centric Permission Matrix for Hospital Staff

**Status:** APPROVED  
**Date:** 2026-10-09  
**Author:** Antigravity (Senior Software Engineer & Solution Architect)  
**Target System:** Thoen Hospital Web Application (`/member/settings`)  
**Database:** `thoen_hos_web_dev` (`192.168.1.7:3306`)

---

## 1. Problem Statement & Motivation
In a hospital with hundreds of staff members across dozens of departments, managing elevated individual permissions via single-person modal dialogs is slow, repetitive, and cognitively overwhelming. Administrators need an intuitive, fast, and structured **Permission Matrix Grid** that allows viewing and toggling roles directly inline in a clean tabular format with instant search, department filtering, and batch saving.

---

## 2. Architecture & Design

### 2.1 Four-Column Action Mapping per Module
Each hospital system module provides 4 clear, non-confusing action columns mapped to database permission keys:

| Module | 👁️ View (ดูข้อมูล) | 🔧 Edit/Do (ปฏิบัติงาน) | ✍️ Approve (อนุมัติอย่างเดียว) | 👑 Manage (ผู้ดูแลระบบ) |
|---|---|---|---|---|
| **🛠️ งานแจ้งซ่อมบำรุง (`repairs`)** | `view_all_work` / `view_it_repairs` / `view_general_repairs` / `view_medical_repairs` | `take_repairs_general` / `take_repairs_medical` | `approve_repairs` (*Approve-Only, canEdit: false*) | `manage_repairs` / `manage_inbox` |
| **🎨 สื่อ & ประชาสัมพันธ์ (`media`)** | `view_media_requests` | `produce_media` | `approve_media` (*Approve-Only, canEdit: false*) | `manage_media_requests` / `manage_news` |
| **📦 พัสดุ & ครุภัณฑ์ (`facility`)** | สมาชิกทั่วไป | `manage_assets` | - | `manage_locations` |
| **📋 ธรรมาภิบาล & สารบรรณ (`governance`)** | สมาชิกทั่วไป | `manage_ita`, `manage_rdu`, `manage_ethics` | - | `manage_outgoing_doc` |
| **💰 การเงิน & เงินเดือน (`finance`)** | สมาชิกทั่วไป | `upload_salary` | `view_all_salary` | `upload_salary` |

---

### 2.2 User Interface & Interaction Flow

```
+----------------------------------------------------------------------------------------------------+
| [Tab 1: เปิด-ปิดระบบบริการทั่วไป]   | [Tab 2: เมทริกซ์กำหนดสิทธิ์ (Permission Matrix)] *                |
+----------------------------------------------------------------------------------------------------+
| โมดูล: [🛠️ งานแจ้งซ่อมบำรุง] [🎨 สื่อประชาสัมพันธ์] [📦 พัสดุ&ครุภัณฑ์] [📋 ธรรมาภิบาล] [💰 การเงิน] [📊 ภาพรวม]  |
+----------------------------------------------------------------------------------------------------+
| ค้นหา: [________________________]  กลุ่มงาน: [ทุกกลุ่มงาน ▾]   [x] แสดงเฉพาะผู้มีสิทธิ์ในโมดูลนี้         |
+----------------------------------------------------------------------------------------------------+
| บุคลากร                  กลุ่มงาน            👁️ View     🔧 Edit     ✍️ Approve   👑 Manage   สิทธิ์รวม |
|----------------------------------------------------------------------------------------------------|
| 👤 นพ.สมชาย ใจดี         กลุ่มงานบริหาร        [x]         [ ]          [x] (ทอง)    [ ]         2 สิทธิ์ |
| 👤 นายสมศักดิ์ ช่างซ่อม     ฝ่ายซ่อมบำรุง        [x]         [x]          [ ]          [x] (ม่วง)   3 สิทธิ์ |
| 👤 นางสาวดวงใจ มีสุข     กลุ่มงานการพยาบาล      [ ]         [ ]          [ ]          [ ]         -       |
+----------------------------------------------------------------------------------------------------+
| (Sticky Save Bar เมื่อมีการแก้ไข)  [!] มีการแก้ไข 2 คน   [ยกเลิก]   [💾 บันทึกการเปลี่ยนแปลงทั้งหมด (2)]   |
+----------------------------------------------------------------------------------------------------+
```

1. **Top Module Switcher:** Fast pills to switch between hospital subsystems.
2. **Filter & Search Toolbar:**
   - Real-time search across Name, Masked Thai Citizen ID, and Department.
   - Department dropdown select.
   - Toggle switch: "แสดงเฉพาะผู้ที่มีสิทธิ์ในโมดูลนี้" (shows only staff with active permissions).
3. **Inline Interactive Matrix Table:**
   - Checkboxes for `View`, `Edit`, `Approve`, `Manage`.
   - Distinct color indicators:
     - `Approve` is highlighted with an Amber/Emerald badge indicating **Approve-Only** behavior.
     - `Manage` is highlighted with an Indigo/Purple badge.
   - Toggling any checkbox immediately stages the change in a local `dirtyMap: Record<number, string[]>`.
4. **Sticky Batch Save Bar:**
   - Renders at the bottom of the viewport as soon as `Object.keys(dirtyMap).length > 0`.
   - Shows total pending modifications.
   - "ยกเลิกการเปลี่ยนแปลง" (Discard) & "บันทึกการเปลี่ยนแปลงทั้งหมด" (Batch Save).

---

### 2.3 Batch API Specification

#### `POST /api/member/permissions/batch-update`
- **Request Headers:** `Content-Type: application/json`
- **Session:** Verified via `requireRole(['admin'])`.
- **Request Body:**
  ```json
  {
    "updates": [
      {
        "memberId": 12,
        "permissions": ["view_all_work", "approve_repairs"]
      },
      {
        "memberId": 45,
        "permissions": ["take_repairs_general", "manage_repairs"]
      }
    ]
  }
  ```
- **Execution:** Runs inside a Prisma `$transaction` deleting previous records and inserting new ones for all specified `memberId`s.
- **Audit Logging:** Calls `logAudit('BATCH_UPDATE_MEMBER_PERMISSIONS', 'members', ...)` with affected member IDs and counts.
- **Response:** `{ "success": true, "updatedCount": 2 }`

---

## 3. Security, PDPA & Reliability
1. **Defensive Session Check:** Server-side admin verification in all endpoints.
2. **PDPA Masking:** Citizen IDs masked as `x-xxxx-xxxx1-23-4` or `***1234` in the UI.
3. **Audit Trails:** Every batch and single modification is recorded in `audit_logs`.
4. **Approve-Only Safety:** `taskPermissionResolver.ts` enforces `canEdit: false` for pure approvers.

---

## 4. Verification & Testing
- Unit tests for batch update API route with mock transactions and auth rejection tests.
- Full Vitest regression suite pass (28+ test files).
- Next.js TypeScript typecheck (`tsc --noEmit`).
