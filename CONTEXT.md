# Context & Domain Model — Thoen Hospital Website

This document serves as the canonical domain glossary and architectural context for the Thoen Hospital portal and management platform. It captures ubiquitous domain terms, business rules, and bounded contexts.

---

## 1. Domain Glossary

### Outgoing Document (หนังสือส่งออก)
- **Definition:** ทะเบียนหนังสือส่งออกทางราชการของโรงพยาบาลเถิน ซึ่งจัดเก็บและติดตามตามปีงบประมาณ (เช่น ปีงบประมาณ 2561 - 2569) โดยเอกสารตารางจริงถูกบันทึกผ่าน Google Sheets ภายนอก
- **Properties:**
  - `year`: ปีงบประมาณ พ.ศ. (เช่น "2569")
  - `label`: ชื่อหัวข้อแสดงผลทางการ (เช่น "ปีงบประมาณ 2569")
  - `note`: หมายเหตุประกอบรอบปี (เช่น "เริ่มใช้วันที่ 1 ตุลาคม 2568")
  - `url`: ลิงก์ภายนอก Google Sheets สำหรับเปิดดู/บันทึกงาน
  - `status`: สถานะการใช้งานของเอกสารประจำปี (`ล่าสุด`, `เสร็จสิ้น`, `เปิดใช้งาน`, `ปิดใช้งาน`)
  - `displayOrder`: ลำดับความสำคัญในการจัดเรียงการ์ดบนหน้าจอ
  - `isActive`: แฟล็กเปิด/ปิดการเผยแพร่
  - `createdBy`, `updatedBy`: ผู้บันทึก/แก้ไขข้อมูลล่าสุด

### Task-Centric Permission Management (ระบบกำหนดสิทธิ์แบบยึดตามภารกิจงาน)
- **Definition:** สถาปัตยกรรมและส่วนประสานงานผู้ดูแลระบบ (`/member/settings`) สำหรับบริหารจัดการสิทธิ์การเข้าถึงและควบคุมภารกิจงาน (Workflow & System Modules) โดยจัดกลุ่มตาม "ภารกิจงาน" แทนการเลือกตามรายชื่อบุคคล
- **Role Archetypes (4 บทบาทมาตรฐาน):**
  - `View`: สิทธิ์ดูและติดตามงานในสายงานนั้น (Read-only)
  - `Edit / Do`: สิทธิ์ปฏิบัติงาน (รับงาน, ดำเนินการผลิต/ซ่อม, บันทึกผล, แก้ไข)
  - `Approve`: สิทธิ์ลงนามอนุมัติและตรวจรับงาน (Approve-only)
  - `Manage`: สิทธิ์หัวหน้าสายงาน/ผู้ดูแลระบบ (มอบหมายงาน, จัดคิว, กำกับดูแล)
- **Assignment Modes (การกำหนดผู้รับผิดชอบ):**
  - `Member-based (รายบุคคล)`: มอบสิทธิ์เจาะจงให้แก่สมาชิกรายคน บันทึกลงตาราง `member_permissions`
  - `Position-based (ตามตำแหน่ง)`: มอบสิทธิ์ให้แก่ทุกคนที่ครองตำแหน่งงานนั้นๆ บันทึกลงตาราง `position_permissions`
- **Permission Keys Canonical Mapping:**
  - **งานขอสื่อประชาสัมพันธ์ (`MEDIA_REQUEST`):** View (`view_media_requests`), Edit (`produce_media`), Approve (`approve_media`), Manage (`manage_media_requests`)
  - **งานซ่อมคอมพิวเตอร์/ไอที (`IT_REPAIR`):** View (`view_it_repairs`), Edit (`take_repairs_it`), Approve (`approve_repairs`), Manage (`manage_repairs`)
  - **งานซ่อมบำรุงทั่วไป (`GENERAL_REPAIR`):** View (`view_general_repairs`), Edit (`take_repairs_general`), Approve (`approve_repairs`), Manage (`manage_repairs`)
  - **งานซ่อมเครื่องมือแพทย์ (`MEDICAL_REPAIR`):** View (`view_medical_repairs`), Edit (`take_repairs_medical`), Approve (`approve_repairs`), Manage (`manage_repairs`)
  - **กล่องงานกลาง & ภาพรวม (`INBOX_CENTRAL`):** View (`view_all_work`, `view_department_tasks`), Manage (`manage_inbox`)
  - **งานข่าวสารและสไลด์ (`NEWS`):** Manage/Edit (`manage_news`)
  - **งานสลิปเงินเดือน (`SALARY`):** View (`view_all_salary`), Edit/Upload (`upload_salary`)
  - **งานพัสดุและสถานที่ (`FACILITY_ASSET`):** Locations (`manage_locations`), Assets (`manage_assets`)
  - **งานหนังสือส่งออก (`OUTGOING_DOC`):** Manage (`manage_outgoing_doc`)
  - **งานชมรมจริยธรรม (`ETHICS`):** Manage (`manage_ethics`)
  - **งานข้อมูล ITA (`ITA`):** Manage (`manage_ita`)
  - **งานเอกสาร RDU (`RDU`):** Manage (`manage_rdu`)

### Ethics Document (เอกสารชมรมจริยธรรม)
- **Definition:** ศูนย์รวมเอกสาร แผนปฏิบัติการส่งเสริมคุณธรรม คำสั่งคณะทำงาน และรายงานผลการดำเนินงานของชมรมจริยธรรมโรงพยาบาลเถิน จัดเก็บตามปีงบประมาณ และรองรับหัวข้อย่อย (เช่น รายงานรอบ 6 เดือน, รอบ 12 เดือน)
- **Properties:**
  - `EthicsYear`: ปีงบประมาณ พ.ศ. (เช่น "2569", "2568"), ลำดับการแสดงผล, สถานะเปิดใช้งาน
  - `EthicsDocument`: หัวข้อเอกสาร, พาธไฟล์ PDF, ขนาดไฟล์, ลำดับแสดงผล, เอกสารแม่ (`parentId`) สำหรับจัดกลุ่มข้อย่อย

### Media Request (คำขอผลิตสื่อและประชาสัมพันธ์)
- **Definition:** กระบวนการขอผลิตสื่อกราฟิก วิดีโอ ไวนิล และประชาสัมพันธ์ของหน่วยงานภายในโรงพยาบาลเถิน ผ่านกล่องงานกลาง (`inbox_tasks` ประเภท `media_request`)
- **Workflow Steps:**
  - Step 1: ยื่นคำขอ (`DRAFT` / รอหัวหน้างานรับทราบ)
  - Step 4: ดำเนินการผลิตสื่อโดยทีมประชาสัมพันธ์/สารสนเทศ (รับงาน, กำหนดผู้รับผิดชอบ, อัปโหลดไฟล์ผลงาน)
  - Step 5: ตรวจรับงานและปิดงานสมบูรณ์
- **Audit & History:** บันทึกการเปลี่ยนแปลงแก้ไขข้อมูล (`MANAGER_EDIT_TASK`) และการลงนามอิเล็กทรอนิกส์ใน `inbox_task_audit_logs`

### Task Permission Resolver (การคำนวณสิทธิ์กล่องงานแบบศูนย์กลาง)
- **Definition:** โมดูลศูนย์กลาง (`@/lib/taskPermissionResolver.ts`) ในการประเมินสิทธิ์ระดับแถว (Row-Level Security) ของภารกิจกล่องงานตามบริบทผู้ใช้
- **Computed Flags:**
  - `canView`: ตรวจสอบสิทธิ์เปิดดูรายละเอียด (ผู้สร้าง, ผู้รับมอบหมาย, เจ้าหน้าที่หน่วยงานปลายทาง, ผู้จัดการระบบ)
  - `canEdit`: ตรวจสอบสิทธิ์แก้ไขข้อมูลภารกิจ (ผู้สร้างแก้ไขได้ในสถานะร่าง/รออนุมัติ, ผู้จัดการระบบแก้ไขได้ตลอดวงจรงานพร้อมบันทึก Diff)
  - `canApprove`: ตรวจสอบสิทธิ์ลงนามอนุมัติ/รับทราบตามสายการบังคับบัญชา
  - `canTakeJob`: ตรวจสอบสิทธิ์เจ้าหน้าที่ช่าง/ผู้ผลิตสื่อในการกดรับงาน
  - `canCancel`: ตรวจสอบสิทธิ์ยกเลิกภารกิจ

---

## 2. Access Rules & Bounded Contexts

### การเข้าถึงหน้าบริการ (`/service/outgoing-document`):
- บุคลากรทุกคนที่ผ่านการล็อกอินเข้าสู่ระบบ (`verifyMemberSession()`) สามารถเปิดดูและคลิกลิงก์ Google Sheets ได้ทั้งหมด
- หากผู้ใช้มีตำแหน่งที่ได้รับสิทธิ์ `manage_outgoing_doc` หรือเป็น `role = 'admin'` ระบบจะแสดงปุ่มลัด `จัดการลิงก์ Sheet ⚙️` เพื่อเข้าสู่หน้าหลังบ้านได้ทันที

### การเข้าถึงหน้าบริการชมรมจริยธรรม (`/ethics`):
- เป็น Public Read Context: ประชาชนทั่วไปและบุคลากรสามารถเข้าชมและดาวน์โหลดไฟล์ PDF เอกสารจริยธรรมได้ทั้งหมดโดยไม่ต้องล็อกอิน
- หากเจ้าหน้าที่เข้าชมและมีสิทธิ์ `manage_ethics` หรือ `admin` จะมีปุ่มทางลัด `จัดการเอกสารจริยธรรม ⚙️` แสดงขึ้นมาเพื่อนำทางไปสู่ CMS

### การเข้าถึงหน้าจัดการ (`/member/outgoing-document` & `/member/ethics`):
- บังคับการตรวจสอบสิทธิ์ Server-side RBAC: เฉพาะ `role = 'admin'` หรือตำแหน่งที่ผูกสิทธิ์ที่เกี่ยวข้อง (`manage_outgoing_doc`, `manage_ethics`) เท่านั้น
- มีฟังก์ชันเพิ่ม แก้ไข ลบ จัดลำดับ และอัปโหลดไฟล์
- บันทึก `logAudit()` ทุกการเปลี่ยนแปลง


```
┌────────────────────────────────────────────────────────────────────────┐
│                        Hospital Portal Context                         │
│                                                                        │
│  [ บุคลากรโรงพยาบาลทุกคนที่ Login ]                                   │
│        │                                                               │
│        ▼                                                               │
│  /service/outgoing-document (ดูและเปิดลิงก์ Google Sheets)             │
│        │                                                               │
│        │ (เฉพาะตำแหน่งที่ได้สิทธิ์ 'manage_outgoing_doc' หรือ Admin)    │
│        ▼                                                               │
│  /member/outgoing-document (CMS จัดการลิงก์ Google Sheets แต่ละปี)     │
│        ▲                                                               │
│        │                                                               │
│  /member/settings (Admin กำหนดตำแหน่งที่ได้รับสิทธิ์ 'manage_outgoing_doc')│
└────────────────────────────────────────────────────────────────────────┘
```
