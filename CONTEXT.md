# Context & Domain Model — Thoen Hospital Website

This document serves as the canonical domain glossary, ubiquitous language dictionary, and architectural context for the **Thoen Hospital** web portal and hospital management platform (โรงพยาบาลเถิน จังหวัดลำปาง). It captures domain terms, business rules, clinical workflows, and bounded contexts to ensure consistency across code, tests, and AI agent operations.

---

## 1. Domain Glossary

### Outgoing Document (หนังสือส่งออก)
- **Definition:** ทะเบียนหนังสือส่งออกทางราชการของโรงพยาบาลเถิน ซึ่งจัดเก็บและติดตามตามปีงบประมาณ พ.ศ. (เช่น ปีงบประมาณ 2561 - 2569) โดยเอกสารตารางจริงถูกบันทึกผ่าน Google Sheets ภายนอก
- **Properties:**
  - `year`: ปีงบประมาณ พ.ศ. (เช่น "2569")
  - `label`: ชื่อหัวข้อแสดงผลทางการ (เช่น "ปีงบประมาณ 2569")
  - `note`: หมายเหตุประกอบรอบปี (เช่น "เริ่มใช้วันที่ 1 ตุลาคม 2568")
  - `url`: ลิงก์ภายนอก Google Sheets สำหรับเปิดดู/บันทึกงาน
  - `status`: สถานะการใช้งานของเอกสารประจำปี (`ล่าสุด`, `เสร็จสิ้น`, `เปิดใช้งาน`, `ปิดใช้งาน`)
  - `displayOrder`: ลำดับความสำคัญในการจัดเรียงการ์ดบนหน้าจอ
  - `isActive`: แฟล็กเปิด/ปิดการเผยแพร่
  - `createdBy`, `updatedBy`: ผู้บันทึก/แก้ไขข้อมูลล่าสุด

---

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
  - **งานยืม-คืนอุปกรณ์และพัสดุ (`EQUIPMENT_BORROW`):** View (`view_borrow_requests`), Manage/Approve/Return (`manage_borrow`)
  - **งานชมรมจริยธรรม (`ETHICS`):** Manage (`manage_ethics`)
  - **งานข้อมูล ITA (`ITA`):** Manage (`manage_ita`)
  - **งานเอกสาร RDU (`RDU`):** Manage (`manage_rdu`)

---

### Task Permission Resolver (การคำนวณสิทธิ์กล่องงานแบบศูนย์กลาง)
- **Definition:** โมดูลศูนย์กลาง (`@/lib/taskPermissionResolver.ts`) ในการประเมินสิทธิ์ระดับแถว (Row-Level Security) ของภารกิจกล่องงานตามบริบทผู้ใช้
- **Computed Flags:**
  - `canView`: ตรวจสอบสิทธิ์เปิดดูรายละเอียด (ผู้สร้าง, ผู้รับมอบหมาย, เจ้าหน้าที่หน่วยงานปลายทาง, ผู้จัดการระบบ)
  - `canEdit`: ตรวจสอบสิทธิ์แก้ไขข้อมูลภารกิจ (ผู้สร้างแก้ไขได้ในสถานะร่าง/รออนุมัติ, ผู้จัดการระบบแก้ไขได้ตลอดวงจรงานพร้อมบันทึก Diff)
  - `canApprove`: ตรวจสอบสิทธิ์ลงนามอนุมัติ/รับทราบตามสายการบังคับบัญชา
  - `canTakeJob`: ตรวจสอบสิทธิ์เจ้าหน้าที่ช่าง/ผู้ผลิตสื่อในการกดรับงาน
  - `canCancel`: ตรวจสอบสิทธิ์ยกเลิกภารกิจ

---

### Media Request & Repair Tasks (คำขอผลิตสื่อและงานซ่อม 4 สายงาน)
- **Definition:** กระบวนการแจ้งซ่อมและขอผลิตสื่อภายในโรงพยาบาลเถิน ผ่านกล่องงานกลาง (`inbox_tasks`)
- **4 สายงานหลัก:**
  1. `MEDIA_REQUEST`: ขอสื่อประชาสัมพันธ์ กราฟิก ไวนิล วิดีโอ
  2. `IT_REPAIR`: แจ้งซ่อมคอมพิวเตอร์ อุปกรณ์ไอที และระบบเครือข่าย
  3. `GENERAL_REPAIR`: แจ้งซ่อมบำรุงอาคาร สถานที่ ประปา และไฟฟ้าทั่วไป
  4. `MEDICAL_REPAIR`: แจ้งซ่อมเครื่องมือและอุปกรณ์ทางการแพทย์
- **Workflow Steps:**
  - `Step 1`: ยื่นคำขอ (`DRAFT` / รอหัวหน้างานรับทราบ)
  - `Step 2`: หัวหน้างานรับทราบ/อนุมัติ (บันทึกลายมือชื่ออิเล็กทรอนิกส์)
  - `Step 3`: จัดสรรงาน/มอบหมายช่างผู้รับผิดชอบ
  - `Step 4`: ช่างกดรับงาน (`IN_PROGRESS`) บันทึกการดำเนินการ และอัปโหลดภาพก่อน-หลังซ่อม
  - `Step 5`: ตรวจรับงานและปิดงานสมบูรณ์ (`COMPLETED`)
- **Audit & Notification:**
  - บันทึกลายมือชื่อและสถานะผ่าน `inbox_task_audit_logs` (HMAC-SHA256)
  - แจ้งเตือนความคืบหน้าเข้า Telegram Bot ของกลุ่มงานโดยอัตโนมัติ

---

### Revenue Cycle Management (ระบบบริหารจัดการวงจรรายได้โรงพยาบาลเถิน — RCM Analytics)
- **Definition:** ศูนย์กลางกำกับและติดตามรายได้โรงพยาบาล สิทธิเบิกชดเชย e-Claim และลูกหนี้ค่ารักษาพยาบาล รพ.เถิน เชื่อมต่อ HOSxP MySQL ผ่าน Unified API Gateway (`@/lib/clinicalDb.ts` และ `@/lib/clinical/rcmDashboardService.ts`):
- **10 แผนกคลินิกหลัก (Clinical Department Classification):**
  - ฟังก์ชันมาตรฐาน: `buildDepartmentSqlCase()` และ `classifySpecialty()`
  1. `01. อายุรกรรม` (`medicine`): spclty 01, 21 หรือชื่อมี 'อายุร'
  2. `02. ศัลยกรรม` (`surgery`): spclty 02 หรือชื่อมี 'ศัลยกรรม' (ไม่รวมกระดูก/ออร์โธ)
  3. `03. สูตินารีเวชกรรม` (`obgyn`): spclty 03, 04 หรือชื่อมี 'สูติ' หรือ 'นรีเวช'
  4. `04. กุมารเวชกรรม` (`pediatrics`): spclty 05 หรือชื่อมี 'กุมาร'
  5. `05. ออร์โธปิติกส์` (`orthopedics`): spclty 08 หรือชื่อมี 'กระดูก' หรือ 'ออร์โธ'
  6. `06. ENT` (`ent`): spclty 06 หรือชื่อมี 'ENT' หรือ 'โสต'
  7. `07. จักษุ` (`eye`): spclty 07 หรือชื่อมี 'จักษุ'
  8. `08. ทันตกรรม` (`dental`): spclty 11 หรือชื่อมี 'ทันต'
  9. `09. จิตเวช` (`psychiatry`): spclty 09 หรือชื่อมี 'จิตเวช'
  10. `10. ฉุกเฉินและอื่นๆ` (`emergency_other`): แผนกและคลินิกบริการอื่นๆ
- **รายงานหลักใน RCM:**
  - `2.1.1.1 สรุปทันตกรรมประกันสังคม`: ยอดเงินบำรุง สิทธิเบิกชดเชย (UC) และลูกหนี้ค้างชำระรายทันตแพทย์
  - `2.1.1.2 สรุปค่าบริการผู้ป่วยนอกรายแพทย์`: ค่ารักษาพยาบาล OPD จำแนกรายแพทย์และ 37 สิทธิมาตรฐาน
  - `2.1.1.3 สรุปค่าบริการผู้ป่วยนอก OPD`: สรุปจำนวนผู้ป่วย Visit และค่าเฉลี่ยต่อราย
  - `2.1.2.1 รายงานผู้ป่วยใน IPD`: วันนอน (LOS), ค่ารักษาพยาบาล, ค่าน้ำหนักสัมพัทธ์ (AdjRW), และดัชนีความซับซ้อนโรค (CMI)
  - `5.2.2.1 สรุปรายรับ Invoice`: ใบแจ้งหนี้และรายรับโรงพยาบาล

---

### RCM 28 Specific Disease & Drug Funds (28 กองทุนเฉพาะโรค/ยา)
- **Definition:** รายงานและระบบติดตามการเรียกเก็บชดเชยเฉพาะทาง 28 กองทุนภายใต้ RCM (`/service/dashboard-rcm/funds/*`):
  1. `T1DM / GDM / PDM`: ทะเบียนและติดตามผู้ป่วยเบาหวาน พร้อมระบบ Batch Import Workspace เชื่อม HOSxP PID/HN
  2. `Dental Implant`: บริการรากฟันเทียม
  3. `Fluoride Varnish`: บริการทาฟลูออไรด์วานิชเด็ก
  4. `Oral Cancer`: การคัดกรองมะเร็งช่องปาก
  5. `Streptokinase`: รายการยาละลายลิ่มเลือดในผู้ป่วยหลอดเลือดหัวใจ
  6. `Telemed Drug`: บริการจัดส่งยาทางไปรษณีย์และบริการพบแพทย์ทางไกล
  7. `Anemia Screening`: บริการตรวจคัดกรองภาวะซีด
  8. `Iron Supplements`: ยาน้ำเสริมธาตุเหล็ก
  9. `Postpartum 30016`: บริการดูแลมารดาหลังคลอด
  10. `Pregnancy Test 1`: การตรวจยืนยันการตั้งครรภ์
  11. `Thai Traditional Medicine`: บริการแพทย์แผนไทยและการนวดประคบสมุนไพร
  12. `Thalassemia`: ผู้ป่วยและหญิงตั้งครรภ์ตรวจคัดกรองธาลัสซีเมีย
  13. `Thalassemia Fund`: กองทุนชดเชยการรักษาธาลัสซีเมีย
  14. `Viral Hepatitis B`: ไวรัสตับอักเสบ บี
  15. `Hepatitis C`: ไวรัสตับอักเสบ ซี
  16. `Health Screening 12003/12004`: การคัดกรองสุขภาพกายและสุขภาพจิต
  17. `Colorectal Cancer`: การคัดกรองมะเร็งลำไส้ใหญ่ด้วย Fit Test
  18. `Clopidogrel`: กองทุนยาป้องกันการแข็งตัวของเลือด Clopidogrel
  19. `Cancer Fund`: กองทุนผู้ป่วยโรคมะเร็ง (CANCER)
  20. `Walk-in Fund`: กองทุนบริการปฐมภูมิรักษาทุกที่ (OP Walk-in)
  21. `Instrument Fund`: อวัยวะเทียมและอุปกรณ์ในการบำบัดรักษาโรค
  22. `Subacute & IMC`: บริการผู้ป่วยกึ่งเฉียบพลันและการฟื้นฟูสมรรถภาพระยะกลาง
  23. `Disability Rehabilitation`: กองทุนฟื้นฟูสมรรถภาพคนพิการ
  24. `Cervical Cancer Screening (CCS)`: การคัดกรองมะเร็งปากมดลูก
  25. `Family Planning 9.1 - 9.7`: การวางแผนครอบครัว (ยาคุมฉุกเฉิน, ยาคุมเม็ด, ยาฉีด, ห่วงอนามัย)
  26. `Antenatal Care (ANC)`: บริการฝากครรภ์คุณภาพ (รหัส 30011 และ 2.3)
  27. `AMed & Home Ward`: บริการดูแลผู้ป่วยที่บ้านผ่าน AMed Telehealth
  28. `ADP Search & Mapping`: เครื่องมือค้นหาและเทียบเคียงรหัสค่าบริการทางการแพทย์ (ADP Code)

---

### Rep-Funds Waterfall Ledger & Claims Reconciliation
- **Definition:** ระบบกระทบยอดเงินบำรุงและลูกหนี้ค่ารักษาพยาบาลตามใบแจ้งยอด (Statement / Rep Number) จาก สปสช.
- **Key Terms:**
  - `Rep Number (เลขที่ใบแจ้งยอด)`: รหัส Statement รอบการจัดสรรเงิน เช่น 2568-12-PAYM-01
  - `WaterFall Ledger`: บัญชีแยกประเภทเปรียบเทียบ ยอดเรียกเก็บ (`totalIncome`) ➔ ยอดที่ได้รับชดเชยจริง (`totalCompensated`) ➔ ส่วนต่าง/หนี้สูญ (`netDiff`) ➔ อัตราการจ่ายชดเชย (`reimbursementRate %`)
  - `Patient Claim Lookup`: ระบบสืบค้นประวัติการเคลมและผลการอุทธรณ์ (Appeal) ระดับรายบุคคลตาม HN และชื่อผู้ป่วย

---

### Palliative Care & LTC Registry (การดูแลผู้ป่วยประคับประคองและผู้มีภาวะพึ่งพิง)
- **Definition:** ระบบบริหารจัดการทะเบียนและการดูแลผู้ป่วยระยะประคับประคอง รพ.เถิน (`/service/dashboard-rcm/palliative-care`):
- **Core Workflows:**
  - `PC.1 (แบบคัดกรองผู้ป่วยประคับประคอง)`: แบบประเมินแรกรับ บันทึก ICD-10 หลัก, ICD-10 Palliative (Z51.5) และ PPS Score
  - `PC.3 (แบบบันทึกการเยี่ยมและติดตาม)`: บันทึกการติดตามอาการ Visit 1 ถึง 4, ผลการเยียวยา, การดูแลต่อเนื่องที่บ้าน
  - `VN Clinical Details Popup`: การเชื่อมโยงดึงประวัติการมารับบริการราย Visit (`ovst`, `opdscreen`, `drug_opd`) จาก HOSxP แสดงผลสด
  - `LTC Registry Integration`: ระบุสถานะผู้ป่วยระยะยาว (Long-Term Care) กลุ่มติดบ้าน/ติดเตียงและ Care Plan ร่วม

---

### MOK (มาตรการองค์กร / คลินิกผู้ป่วยเรื้อรัง)
- **Definition:** ระบบมอนิเตอร์และบริหารจัดการกลุ่มผู้ป่วยโรคเรื้อรังและคลินิกเฉพาะ (`mokService.ts`)
- **Key Dimensions:**
  - `Catchment Area`: การจำแนกผู้ป่วยในเขตรับผิดชอบ (`in_catchment`) และนอกเขตรับผิดชอบ (`out_catchment`)
  - `Clinic Tracking`: คลินิกเบาหวาน (DM), ความดัน (HT), โรคไต (CKD), การส่งต่อ รพ.สต. (`send_to_pcu`), และสถานะการติดตามต่อเนื่อง (Type Area)

---

### Equipment Borrowing System (ระบบยืม-คืนอุปกรณ์และเบิกจ่ายวัสดุ)
- **Definition:** ระบบบริหารจัดการยืม-คืนอุปกรณ์และเบิกใช้วัสดุของโรงพยาบาลเถิน
- **Key Domain Terms:**
  - `Loanable Asset (ครุภัณฑ์พร้อมให้ยืม)`: ครุภัณฑ์จากฐานข้อมูล `hospital_assets` ที่เจ้าหน้าที่/Admin กำหนดให้สามารถยืมได้ ติดตามเป็นรายชิ้นด้วยเลขครุภัณฑ์ (Article Number)
  - `Supply / Material (วัสดุคลัง)`: วัสดุที่มีการจัดการจำนวนคงเหลือ (Stock Quantity) แยกเป็น 2 ประเภท:
    - *Reusable (ยืม-คืน)*: วัสดุใช้งานหมุนเวียนที่ต้องนำกลับมาส่งคืน เช่น สายต่อพ่วง, ปลั๊กไฟ, ตัวแปลงสัญญาณ
    - *Consumable (วัสดุสิ้นเปลือง)*: วัสดุเบิกใช้แล้วตัดสต็อกทันที ไม่ต้องส่งคืน เช่น เทปกาว, ถ่านไฟฉาย, กระดาษ
  - `Borrow Request (คำขอยืม)`: ใบขอยืมที่รองรับการเลือกรายการหลายชนิดพร้อมกันใน 1 คำขอ (Multi-item Basket)
  - `Return Inspection (การตรวจรับคืน)`: ตรวจสอบสภาพ (ปกติ, ชำรุด, สูญหาย) พร้อมบันทึกหมายเหตุ และปรับยอดสต็อกคืนคลัง

---

### Hospital Event & ThaID Attendance System (ระบบกิจกรรมโรงพยาบาลเถินและเช็คอิน ThaID)
- **Definition:** ระบบบริหารจัดการกิจกรรมของโรงพยาบาลเถิน การเผยแพร่ เปิดรับลงทะเบียนล่วงหน้า และเช็คอินหน้างานด้วย Static QR ผ่าน ThaID
- **Key Domain Terms:**
  - `Hospital Event (กิจกรรมโรงพยาบาล)`: มีผู้รับผิดชอบหลัก (`headOrganizerId`), ผู้รับผิดชอบร่วม (`coOrganizers`), วันที่จัดงาน, และช่วงเวลาเปิดรับสแกน (`checkinOpenTime` ถึง `checkinCloseTime`)
  - `ThaID Event Check-in`: สแกน QR Code หน้างาน ➔ เข้าสู่ ThaID OAuth (DOPA) ➔ ตรวจสอบ Member ➔ บันทึกการเข้าร่วม (`event_attendances`) 1 คน ต่อ 1 ครั้ง ต่อ 1 งาน
  - `Participation Points`: กิจกรรมละ 1 คะแนนถ้วน เมื่อสแกนเช็คอินสำเร็จ
  - `Dense Ranking Leaderboard`: ระบบจัดอันดับคะแนน (หากคะแนนเท่ากันครองอันดับเดียวกัน เช่น 1, 2, 2, 3) จัดกลุ่มตามปีงบประมาณ พ.ศ. หรือรายเดือน
  - `Department Leaderboard`: การจัดอันดับระดับแผนก แสดงทั้งคะแนนรวม (Total Score) และคะแนนเฉลี่ยต่อคน (Avg Score/Person)

---

### Screening Queue System (ระบบคิวคัดกรองบัตรประชาชน Smart Card)
- **Definition:** ระบบคัดกรองสุขภาพเชิงรุกและบริการตรวจนอกสถานที่ ผ่านการอ่านบัตร Smart Card Reader
- **Sub-pages:**
  - `/service/screening`: Dashboard แสดงคิวผู้รับบริการวันนี้ (Polling 3s)
  - `/service/screening/scan`: จุดอ่านบัตรประชาชน (Rapid Batch Flow) เสียบบัตร ➔ อ่านข้อมูล ➔ เคลียร์หน้าจอพร้อมรับคนถัดไป
- **Queue Statuses:**
  - `WAITING`: รอคัดกรอง / รอตรวจสอบการเปิด Visit ใน HOSxP
  - `VISIT_OPENED`: ตรวจสอบพบว่ามีการเปิด Visit เรียบร้อยแล้ว (ซ่อนจากคิวที่ต้องดำเนินการ)
  - `CANCELLED`: ยกเลิกรายการ

---

### Annual Budget Tracker (ระบบติดตามงบประมาณประจำปี)
- **Sub-routes:**
  - `/service/budget-tracker/rh1`: เปรียบเทียบผลงานชดเชย 10 หมวด เทียบเคียง 103 หน่วยบริการในเขตสุขภาพที่ 1
  - `/service/budget-tracker/smt`: ดึงข้อมูลการโอนเงินจริงจาก Smart Monitoring & Tracking (SMT) สปสช.
  - `/service/budget-tracker/mishos`: ระบบกลาง MIS HOS สปสช. โครงสร้าง 10 หมวดหลัก (0 ถึง 9)

---

### Official Salary & Income Statement (ระบบสลิปและหนังสือรับรองเงินได้ — `/member/all-salary`)
- **Staff Search:** ค้นหาด้วยเลขบัตรประชาชน 13 หลักจาก Salary DB
- **Statement Standards:**
  - ภาษาไทยล้วน พิมพ์ขาวดำสำหรับยื่นธุรกรรมการเงินและสินเชื่อ
  - เลือกระยะเวลา: ปุ่มลัด (1, 3, 6 เดือน, 1 ปี) หรือกำหนดงวดเอง
  - รายการเคลื่อนไหว: ลำดับ, วันที่, รายการ, ถอน/หัก, ฝาก/รับ, ยอดคงเหลือสุทธิ (Running Balance)
  - การพิมพ์ Multi-page A4: กำหนด `@page { margin: 0; }` บรรจุ 22 รายการต่อหน้า พร้อมตราโรงพยาบาลและเลขหน้ามุมขวาบน

---

### MinIO S3 Object Storage Seam (ระบบจัดเก็บเอกสารและไฟล์สื่อ)
- **Definition:** สถาปัตยกรรมการจัดเก็บไฟล์อัปโหลดทั้งหมดผ่าน MinIO S3 บน Proxmox LXC (`192.168.1.24:9000`)
- **Bucket Classification:**
  - `public-assets`: รูปภาพข่าวสาร, สไลด์ประชาสัมพันธ์, โลโก้, รูปโปรไฟล์ (Public Read)
  - `private-documents`: เอกสารคำสั่งราชการ, ไฟล์แนบกิจกรรม, เอกสารงานซ่อม, สลิปเงินเดือน (Private เข้าถึงผ่าน Presigned URL ที่มีอายุจำกัด)
- **Video Delivery:** การสตรีมไฟล์วิดีโอ (Hero Slide MP4) ต้องรองรับ HTTP 206 Partial Content (Byte Range Requests) ผ่าน `/api/stream?path=...` เสมอ

---

## 2. Access Rules & Bounded Contexts

### การเข้าถึงหน้าบริการ Dashboard-RCM (`/service/dashboard-rcm`):
- บุคลากรโรงพยาบาลทุกคนที่ผ่านการล็อกอิน (`verifyMemberSession()`) ในบทบาท `member`, `staff` หรือ `admin` สามารถเข้าถึงได้ (จำกัดสิทธิ์ไม่ให้ผู้ใช้กลุ่ม `subdistrict` รพ.สต. เข้าถึง)
- แสดงข้อมูลเลขบัตรประชาชน (CID) เต็ม 13 หลักสำหรับการใช้งานภายใน Intranet ของบุคลากรทางการแพทย์และการเงิน
- มีระบบ Audit Log (`logAudit()`) บันทึกการเข้าอ่านข้อมูลผู้ป่วยและสถิติการเงินตามเกณฑ์ PDPA

### การเข้าถึงหน้าระบบยืม-คืนอุปกรณ์ (`/member/equipment-borrow`):
- บุคลากรทั่วไป: ดูรายการของ, ยื่นขอยืม, ดูประวัติตัวเอง
- ผู้ดูแลระบบ (`manage_borrow` / Admin): อนุมัติคำขอ, จ่ายของ, ตรวจรับคืน, ปรับปรุงสต็อกคลังพัสดุ

### การเข้าถึงหน้าบริการและจัดการชมรมจริยธรรม (`/ethics` & `/member/ethics`):
- หน้าดูเอกสาร (`/ethics`): Public Read เปิดให้ประชาชนดาวน์โหลด PDF ได้โดยไม่ต้องล็อกอิน
- หน้าจัดการ (`/member/ethics`): เฉพาะ `admin` หรือตำแหน่งที่มีสิทธิ์ `manage_ethics`

### การเข้าถึงระบบกิจกรรมและการเช็คอิน ThaID (`/member/events`):
- การสร้างและแก้ไขกิจกรรม: ผู้จัดงาน (`headOrganizerId`), ผู้รับผิดชอบร่วม (`coOrganizers`), และ Admin
- การเช็คอินหน้างาน: สแกนผ่านมือถือเข้าสู่ระบบ ThaID OAuth (DOPA) ตรวจสอบช่วงเวลา `checkinOpenTime <= now <= checkinCloseTime` มอบ 1 คะแนนต่อกิจกรรม

---

## 3. Permanent Deletions & Security Boundaries

1. **ระบบรับเรื่องร้องเรียนและฟอร์มติดต่อสอบถาม:** ถูกถอดถอนออกจากระบบอย่างถาวร (ทั้ง UI หน้าเว็บและ API Routes) ห้ามสร้าง route หรือ form สำหรับ contact inquiries กลับมา
2. **Zero Direct Database Sockets:** ตัวเว็บแอปพลิเคชันไม่มีการเปิด connection ไปยัง MySQL พอร์ต 3306 ทุกการสืบค้นและบันทึกข้อมูลต้องส่งผ่าน Thoen Hospital Unified API Gateway (`@/lib/apiGateway`) เท่านั้น
3. **Strict PHI Masking:** แสดงผลข้อมูลผู้ป่วยและเลขบัตรประชาชนในส่วนสาธารณะด้วยการ Mask (แสดงเฉพาะ 4 หลักท้าย) เสมอ
