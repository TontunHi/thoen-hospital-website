# รายการงานรอพัฒนาต่อสำหรับ API Gateway & Infrastructure (Gateway Refactoring & Storage Roadmap)

บันทึกแผนงานและขั้นตอนการปรับปรุงสถาปัตยกรรม Thoen Hospital Unified API Gateway (รันบน Proxmox VM: `192.168.1.208:8443`) และระบบโครงสร้างพื้นฐานจัดเก็บไฟล์ เพื่อยกระดับความปลอดภัย ความเป็นระเบียบ ความเสถียร และความสามารถในการบำรุงรักษาในระยะยาว โดยไม่กระทบการทำงานของระบบปัจจุบัน (Zero-Downtime & High Availability)

> **สถานะปัจจุบันของระบบ (ณ พฤศจิกายน 2569):**
> * ขนาดไฟล์ `server.js` ปัจจุบัน: **3,021 บรรทัด**
> * จำนวน Endpoints ทั้งหมด: **61 เส้นทาง**
> * เชื่อมโยง 3 ฐานข้อมูล: HOSxP (`192.168.1.4:3306`), Salary (`192.168.1.4:3306`), App/Website DB (`192.168.1.7:3306`)
> * สถาปัตยกรรม: **Zero-Database Next.js Architecture** (เว็บไม่ต่อฐานข้อมูลตรง ทุกคำขอผ่าน Gateway 100%)
> * โมดูลคลินิกและบริการล่าสุด: Palliative Care (PC.1, PC.3, VN Clinical Popup, Registries), GTW Article Sync, Member Position Permissions, Audit Log (PDPA)

---

## แผนภาพลำดับความสำคัญของงาน (Execution Roadmap)

```text
[ Phase 1: Gateway Modularization ]
แตก server.js (3,021 บรรทัด) เป็น Fastify plugins (routes/*.js)
  └── จัดระเบียบโค้ด / ไม่แก้ Logic / Zero-Downtime / ปลอดภัยทำได้ทันที ⭐ (เริ่มอันนี้ก่อน)
                 │
                 ▼
[ Phase 2: Raw SQL Deprecation & Named APIs ]
แทนที่การส่ง SQL ดิบจาก Next.js ด้วย Named APIs เฉพาะทาง
  └── ปิดตาย /query, /execute / ป้องกัน SQL Injection 100%
                 │
                 ▼
[ Phase 3: Cloudflare Tunnel & Security Hardening ]
ทดสอบเส้นทางสื่อสารภายนอก, ป้องกัน Cache รั่วไหล, ตรวจ Header x-api-key
  └── ตรวจสอบความปลอดภัยตามเกณฑ์ PDPA และความเสถียรของ Connection
                 │
                 ▼
[ Phase 4: Object Storage Evolution (MinIO Proxmox LXC) ]
สร้าง Proxmox LXC Container (192.168.1.24: root) รัน MinIO S3-Compatible Storage
  └── ปรับ documentStorage.ts ใช้ S3 SDK / เว็บไซต์กลายเป็น Stateless 100%
```

---

### [x] Phase 1: แยกโครงสร้างไฟล์ `server.js` เป็น Fastify Modular Plugins (สถานะ: สำเร็จสมบูรณ์แล้ว 100% ✅)
* **เป้าหมาย:** แตกไฟล์ก้อนเดี่ยว `server.js` (3,021 บรรทัด) ออกเป็นโมดูลย่อยตามโดเมนในโฟลเดอร์ `routes/` เพื่อให้อ่านง่าย ตรวจสอบง่าย ดูแลเฉพาะระบบได้สะดวก และลดความเสี่ยงเวลาแก้ไข
* **โครงสร้างเป้าหมาย:**
  ```text
  /home/thoen/thoen-api-gateway/
  ├── server.js               # Entry point: โหลด config, สร้าง DB pools, register plugins (~227 บรรทัด)
  ├── package.json
  ├── docker-compose.yml       # เพิ่ม volume mount: ./routes:/app/routes
  └── routes/
      ├── health.js           # GET /health (ตรวจสถานะ Uptime & Database Connection Pools)
      ├── clinical.js         # /api/v1/clinical/* (ER, IPD, นัดหมาย, Lab, คลังยา, TB, RCM)
      ├── palliative.js       # /api/v1/clinical/rcm/palliative-care & /api/v1/app/palliative-care/*
      ├── salary.js           # /api/v1/salary/* (ระบบเงินเดือน, สลิป, งวดเงิน, นำเข้าข้อมูล)
      ├── app.js              # /api/v1/app/* (สมาชิก, สิทธิ์, ข่าวสาร, สไลด์, งานซ่อม, ครุภัณฑ์, กิจกรรม)
      ├── gtw.js              # /api/v1/gtw/* (ซิงค์บทความ GTW Health Articles)
      ├── audit.js            # /api/v1/audit/* (Audit Log บันทึกการเข้าถึงข้อมูลตามมาตรฐาน PDPA)
      └── rawSql.js           # /api/v1/{app,salary,clinical}/{query,execute,transaction} (กักกันชั่วคราว)
  ```
* **ขั้นตอนการดำเนินการ (Zero-Downtime & Safe Switch Protocol):**
  - [x] 1.1 เขียนและแยกโค้ดลงใน `routes/*.js` ในคลังโค้ดท้องถิ่น และทดสอบ Syntax ด้วย `node --check` ผ่าน 100%
  - [x] 1.2 ปรับปรุง `docker-compose.yml` บนเซิร์ฟเวอร์ ให้ mount โฟลเดอร์ `./routes:/app/routes`
  - [x] 1.3 สำรองไฟล์เดิมไว้บนเซิร์ฟเวอร์เรียบร้อย (`server.js.bak_*`)
  - [x] 1.4 ทดสอบ Syntax และความเข้ากันได้ของ Container ก่อนรีสตาร์ต
  - [x] 1.5 อัปเดตขึ้น Production เรียบร้อย (Container recreate ใช้เวลาเพียง ~2 วินาที, `/health` สถานะ UP ทุก DB)

---

### [ ] Phase 2: ทยอยแทนที่ Raw SQL Endpoints ด้วย Named APIs (ความสำคัญ: ปานกลาง-สูง / อยู่ระหว่างดำเนินการ 🚀)
* **เป้าหมาย:** เลิกส่งคำสั่ง SQL ดิบ (`/query`, `/execute`, `/transaction`) จาก Next.js ข้ามเครือข่าย เพื่อความปลอดภัยสูงสุด (Decoupled Data Architecture) และป้องกันความเสี่ยงจาก SQL Injection
* **สำรวจและแทนที่ไฟล์ฝั่งเว็บที่เรียก Raw SQL (Progress Checklist):**
  - [x] **`src/lib/clinical/palliativeRegistryService.ts`**:
    - [x] สร้าง Named API: `GET /api/v1/app/palliative-care/registries/by-hn/:hn` บน Gateway
    - [x] เปลี่ยนการเรียกใน `lookupPatientDetails` และ `createRegistry` จาก `apiGateway.app.query` มาเป็น `apiGateway.app.getPalliativeRegistryByHn` (ตัด Raw SQL 100%)
  - [x] **`src/app/api/kpi/import/route.ts`**:
    - [x] สร้าง Named API: `POST /api/v1/app/kpi/import-batch` รองรับ Transaction Batch Insert บน Gateway
    - [x] เปลี่ยนจากการรัน `apiGateway.app.transaction(chunk)` ข้ามเครือข่าย มาเรียก Named API โดยตรง (ตัด Raw SQL 100%)
  - [x] **`src/lib/salary/salaryBatchService.ts`**:
    - [x] สร้าง Named API: `GET /api/v1/salary/batch/summary/:type` และ `DELETE /api/v1/salary/batch/latest/:type`
    - [x] ปรับ `getLatestBatchSummary` และ `deleteLatestBatch` ให้เรียกผ่าน Gateway Named API แทนการส่ง SQL ตรง
  - [x] **Salary Domain Migration (ตัด Raw SQL ออก 100% ครบทุก Route)**:
    - [x] `src/app/api/salary/periods/route.ts`: แปลง GET, POST, PUT, DELETE ทั้งหมดไปใช้ `apiGateway.salary.getPeriods`, `createPeriod`, `updatePeriod`, `deletePeriod`
    - [x] `src/app/api/member/sync-salary/route.ts`: เปลี่ยนมาใช้ `apiGateway.salary.getUsers()`
    - [x] `src/app/api/salary/login/route.ts`: ทั้ง POST (login form) และ GET (SSO) เปลี่ยนมาใช้ `apiGateway.salary.verifyLogin()`
    - [x] `src/app/api/salary/data/route.ts`: เปลี่ยนมาใช้ `apiGateway.salary.getRecords()` และ `apiGateway.salary.getCalendar()`
    - [x] `src/app/api/salary/all/statement/route.ts`: เปลี่ยนมาใช้ `apiGateway.salary.getRecords()`
    - [x] `src/lib/salary/salaryLedgerService.ts`: เปลี่ยนค่าเริ่มต้นมาใช้ `apiGateway.salary.getRecords()` และ `apiGateway.salary.getCalendar()`
  - [x] **Member & App Domain Migration (Named APIs แทนที่ Raw SQL)**:
    - [x] `POST /api/v1/app/members/auth-context`: รวม Member profile, permissions, position permissions, settings, telegram link ใน 1 atomic roundtrip
    - [x] `POST /api/v1/app/members/check-position-permission`: ตรวจสอบสิทธิ์ตามตำแหน่งงาน
    - [x] `GET /api/v1/app/news/published`: ข่าวประชาสัมพันธ์สถานะ published สำหรับหน้าหลัก
    - [x] `GET /api/v1/app/news/sitemap`: ดึงรายการข่าวสำหรับ Next.js sitemap generator
    - [x] `GET /api/v1/app/slides/active`: ดึงภาพ Hero Banner สไลด์ที่กำลังแสดงผล
    - [x] `POST /api/v1/audit/log`: บันทึก Audit Log (PDPA) ตรงสู่ Gateway
    - [x] `src/lib/memberAuth.ts`: ปรับ `fetchAuthenticatedMember` และ `checkPositionPermission` ให้ใช้ Named APIs 100%
    - [x] `src/lib/audit.ts`: ปรับ `logAudit` ให้ส่งตรงผ่าน Gateway Named API
    - [x] `src/app/page.tsx`, `src/app/sitemap.ts`, `src/lib/prisma.ts`: แปลงการดึงข้อมูลและ ping ให้ผ่าน Named APIs และ `apiGateway.health()`
  - [x] **Long-Term Care (LTC) Domain Migration (ตัด Raw SQL สู่ Named API 100%)**:
    - [x] สร้าง Named APIs บน Gateway: `GET /api/v1/app/ltc/hns`, `GET /api/v1/app/ltc/registries`, `GET /api/v1/app/ltc/registries/:id`, `GET /api/v1/app/ltc/registries/by-hn/:hn`, `POST /api/v1/app/ltc/registries`, `PUT /api/v1/app/ltc/registries/:id`, `DELETE /api/v1/app/ltc/registries/:id` ใน `docs/gateway/routes/app.js`
    - [x] เพิ่ม SDK Methods ใน `src/lib/apiGateway.ts`: `apiGateway.app.{getLtcHns, getLtcRegistries, getLtcRegistryById, getLtcRegistryByHn, createLtcRegistry, updateLtcRegistry, deleteLtcRegistry}`
    - [x] ปรับ `src/lib/clinical/ltcRegistryService.ts` ให้เรียกใช้ Named APIs พร้อมกลไก Graceful Fallback เพื่อความราบรื่นแบบ Zero-Downtime
  - [x] **Clinical RCM Domain Migration (แปลงเป็น Named APIs 100% ครบทุกระบบใน RCM)**:
    - [x] สร้าง Named APIs บน Gateway: `docs/gateway/routes/rcmFunds.js`
      - `GET /api/v1/clinical/rcm/funds/adp-mapping/:adpCode`
      - `GET /api/v1/clinical/rcm/funds/dental-implant`
      - `GET /api/v1/clinical/rcm/funds/fluoride-varnish`
      - `GET /api/v1/clinical/rcm/funds/oral-cancer`
      - `GET /api/v1/clinical/rcm/funds/streptokinase`
      - `GET /api/v1/clinical/rcm/funds/telemed-drug`
      - `GET /api/v1/clinical/rcm/funds/:fundKey` (Generic dynamic fund router with SWR cache)
      - `GET /api/v1/clinical/rcm/rep-funds/years` (ปีงบประมาณที่มีใน repdata)
      - `GET /api/v1/clinical/rcm/rep-funds/summary` (สรุปภาพรวม KPI, Fund Groups, Rep Statements)
      - `GET /api/v1/clinical/rcm/rep-funds/cases` (รายการเคสผู้ป่วยรายบุคคลตาม Rep/กองทุน)
      - `GET /api/v1/clinical/rcm/rep-funds/lookup` (ค้นหาประวัติการเคลมด้วย HN / ชื่อ / วันที่)
    - [x] เพิ่ม SDK Methods ใน `src/lib/apiGateway.ts`: `apiGateway.clinical.{getRcmFundData, getAdpMapping, getRepFundsYears, getRepFundsSummary, getRepFundsCases, lookupPatientClaims}`
    - [x] ปรับปรุง Next.js Clinical Services ทั้งหมด 28 กองทุนเฉพาะโรค/ยา และ Rep Funds Service พร้อมสถาปัตยกรรม Dual-Path Fallback (Zero-Downtime):
      - 1. `rcmDentalImplantService.ts` (รากฟันเทียม)
      - 2. `rcmFluorideVarnishService.ts` (ฟลูออไรด์วานิช)
      - 3. `rcmOralCancerService.ts` (มะเร็งช่องปาก)
      - 4. `rcmStreptokinaseService.ts` (ยา Streptokinase)
      - 5. `rcmTelemedDrugService.ts` (บริการส่งยาทางไปรษณีย์/Telemed)
      - 6. `rcmAnemiaScreeningService.ts` (คัดกรองภาวะซีด)
      - 7. `rcmIronSupplementsService.ts` (ยาน้ำเสริมธาตุเหล็ก)
      - 8. `rcmPostpartumService.ts` (บริการดูแลหลังคลอด)
      - 9. `rcmPregnancyTestService.ts` (ตรวจการตั้งครรภ์)
      - 10. `rcmT1dmGdmPdmService.ts` (เบาหวาน T1DM / GDM / PDM)
      - 11. `rcmThaiTraditionalMedicineService.ts` (แพทย์แผนไทย)
      - 12. `rcmThalassemiaService.ts` (ธาลัสซีเมีย)
      - 13. `rcmThalassemiaFundService.ts` (กองทุนธาลัสซีเมีย)
      - 14. `rcmViralHepatitisService.ts` (ไวรัสตับอักเสบ B)
      - 15. `rcmHepatitisCService.ts` (ไวรัสตับอักเสบ C)
      - 16. `rcmHealthScreeningService.ts` (คัดกรองสุขภาพกาย/จิต 12003, 12004)
      - 17. `rcmColorectalCancerService.ts` (คัดกรองมะเร็งลำไส้ใหญ่ Fit test)
      - 18. `rcmClopidogrelService.ts` (กองทุนยา Clopidogrel)
      - 19. `rcmCancerFundService.ts` (กองทุนมะเร็ง CANCER)
      - 20. `rcmWalkinFundService.ts` (กองทุน Walk-in)
      - 21. `rcmInstrumentFundService.ts` (อวัยวะเทียมและอุปกรณ์)
      - 22. `rcmImcService.ts` (ผู้ป่วยกึ่งเฉียบพลัน IMC)
      - 23. `rcmRehabilitationService.ts` (ฟื้นฟูสมรรถภาพ Disability)
      - 24. `rcmCervicalCancerService.ts` (มะเร็งปากมดลูก CCS)
      - 25. `rcmFamilyPlanningService.ts` & `rcmFamilyPlanning932Service.ts` (วางแผนครอบครัว 9.1-9.7)
      - 26. `rcmAncService.ts` (บริการฝากครรภ์ ANC 30011 & 2.3)
      - 27. `rcmAmedHomewardService.ts` (AMed & Home Ward)
      - 28. `rcmAdpSearchService.ts` (ค้นหาจากรหัส ADP)
    - [x] รัน Unit Tests ผ่าน 100% (43 test suites, 358 tests passed)
  - [x] **Clinical Queue, Drug, Lab, ER & Hospital Services Migration (ตัด Raw SQL สู่ Named API 100%)**:
    - [x] `src/app/api/health/route.ts`: แปลงจาก 3 คำสั่ง `SELECT 1` มาใช้ `apiGateway.health()` ดึงสถานะของทั้ง 3 DB ใน 1 atomic roundtrip พร้อม graceful fallback
    - [x] `src/lib/clinical/outpatientDrugService.ts`: เชื่อมต่อ `apiGateway.clinical.getDrugDispenseStatus()` ดึงคิวจ่ายยาห้องยา (รอจัดยา vs กำลังจัดยา) พร้อม masking ตามเกณฑ์ PDPA
    - [x] `src/lib/clinical/clinicalRecordsService.ts`:
      - [x] `getLoratadineDispenseSummary`: แปลงมาใช้ `apiGateway.clinical.getLoratadineMonitor(ageFilter)`
      - [x] `getLabTrackerDetails`: แปลงมาใช้ `apiGateway.clinical.getLabDetailByHn(hn)`
      - [x] `searchPatientVisits`: เชื่อมต่อ Named API `GET /api/v1/clinical/records/visits`
      - [x] `getVisitClinicalDetails`: เชื่อมต่อ Named API `GET /api/v1/clinical/records/visit-details`
    - [x] `src/lib/clinical/ipdWardService.ts`:
      - [x] `getWardSummary` และ `getWardPatientRoster`: แปลงมาใช้ `apiGateway.clinical.getIpdWardRoster()`
    - [x] `src/lib/clinicalDb.ts`:
      - [x] `fetchAppointmentMismatches`: แปลงมาใช้ `apiGateway.clinical.getAppointmentMismatches()`
    - [x] `src/app/api/appointment/route.ts`:
      - [x] สร้าง Named API: `GET /api/v1/clinical/appointments/by-cid/:cid` บน Gateway และเชื่อมต่อ `apiGateway.clinical.getAppointmentsByCid(cid)` พร้อม fallback
    - [x] `src/app/api/er/status/route.ts`:
      - [x] เชื่อมต่อ `apiGateway.clinical.getErStatus('tv')` ดึง active patients และ emergency level counts แบบเรียลไทม์
    - [x] รัน Unit Tests ผ่าน 100% (45 test suites, 364 tests passed)
  - [ ] **Task Inbox & Legacy CMS Queries in `src/lib/memberDb.ts`** (Domain ถัดไป - ดูแผนงานฉบับละเอียดที่ [`docs/gateway/TASK_INBOX_NAMED_API_PLAN.md`](TASK_INBOX_NAMED_API_PLAN.md)):
    - [ ] สำรวจและสร้าง Named API รองรับ Task Inbox workflows ใน `src/lib/taskInboxService.ts`
    - [ ] สลับ `ingestBatch` ใน `salaryBatchService.ts` ให้เรียก `apiGateway.salary.uploadBatch`
    - [ ] สำรวจและแปลงคำสั่ง SQL ดิบใน Legacy CMS & Peripheral Services (ITA, RDU, Outgoing Documents, Departments, Locations)
    - [ ] เมื่อไม่มีส่วนใดในระบบเรียกใช้แล้ว ให้ปิดตาย (Disable) Endpoint `/api/v1/app/query`, `/execute`, `/transaction` และ `/api/v1/salary/execute` ในไฟล์ `routes/rawSql.js`

---

### [x] Phase 3: ตรวจสอบความเสถียรและความปลอดภัยผ่าน Cloudflare Tunnel (สถานะ: สำเร็จและผ่านการทดสอบ 100% ✅)
* **เป้าหมาย:** ยืนยันความปลอดภัยและความถูกต้องเมื่อเว็บ Next.js สื่อสารกับ Gateway ผ่าน Cloudflare Tunnel (HTTPS)
* **รายการที่ตรวจสอบแล้ว:**
  - [x] ตรวจสอบว่า HTTP Header `x-api-key` ส่งผ่าน Tunnel ครบถ้วน ไม่ถูกตัดทอน (และ Reject 401 เมื่อไม่มี Key หรือ Key ไม่ถูกต้อง)
  - [x] ตั้งค่า Header `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, private`, `Pragma: no-cache`, `Expires: 0`, `X-Content-Type-Options: nosniff` บน Gateway สำเร็จเรียบร้อย เพื่อป้องกัน Cloudflare CDN แอบแคชข้อมูลส่วนบุคคล (PDPA/PHI)
  - [x] วัด Response Time และตรวจสอบการหลุดของ Connection ภายใต้คำขอปริมาณมาก (Stress Test 50 concurrent requests: สำเร็จ 100%, Min 4.1ms, Avg 21.1ms, Max 50.4ms)

---

### [x] Phase 4: ยกระดับระบบจัดเก็บไฟล์สู่ MinIO Object Storage (สถานะ: สำเร็จสมบูรณ์แล้ว 100% ✅)
* **เป้าหมาย:** แยกการจัดเก็บไฟล์อัปโหลด (รูปภาพข่าวสาร, สไลด์, เอกสารแนบกิจกรรม, ไฟล์แนบงานซ่อม, รูปโปรไฟล์) ออกจาก Disk ของ Web Server สู่ระบบ Object Storage มาตรฐาน S3 ช่วยให้เว็บเป็น Stateless 100% และลดความเสี่ยง Disk เต็มดึงให้ Gateway ล่ม
* **สเปก Proxmox LXC Container (CT):**
  * **OS Template:** Debian 12 Standard LXC หรือ Ubuntu 24.04 LTS
  * **SSH Access:** `root@192.168.1.24` (Port `22`)
  * **vCPU:** 2 Cores
  * **RAM:** 2 GB (Swap: 1 GB)
  * **Disk:** 50 – 100 GB+ (แยก Volume ข้อมูลไว้ที่ `/mnt/data`)
  * **Network:** Static IP `192.168.1.24/24`, Gateway: `192.168.1.1`
  * **Ports:** `9000` (S3 API), `9001` (Web Console)
* **การเชื่อมต่อและการเขียนโค้ด (Next.js Integration):**
  - [x] สร้าง Bucket สำหรับงานต่าง ๆ (สร้างและทดสอบเรียบร้อยแล้ว ✅):
    - `public-assets` (รูปข่าว, สไลด์แบนเนอร์, โลโก้ — สิทธิ์ Public Read)
    - `private-documents` (เอกสารคำสั่ง, สลิป, ไฟล์แนบงานซ่อม — สิทธิ์ Private เข้าถึงผ่าน Presigned URL)
  - [x] ติดตั้ง `@aws-sdk/client-s3` และ `@aws-sdk/s3-request-presigner` ในเว็บ Next.js ✅
  - [x] ปรับปรุงโมดูลกลาง [`src/lib/storage/documentStorage.ts`](file:///c:/Users/Tontun/Documents/thoen-hospital-website/src/lib/storage/documentStorage.ts) และ `src/app/uploads/[...path]/route.ts` ให้บันทึกและสตรีมไฟล์ผ่าน MinIO ✅
  - [x] เขียนสคริปต์ Migration เพื่อโอนย้ายไฟล์เดิมจากโฟลเดอร์ `public/uploads/` และ `storage/` ขึ้น MinIO Bucket ครั้งแรก (`scripts/migrateStorageToS3.ts` / `npm run storage:migrate`) ✅

---
*เอกสารอ้างอิง: [`docs/ZERO_DB_GATEWAY_PLAN.md`](file:///c:/Users/Tontun/Documents/thoen-hospital-website/docs/ZERO_DB_GATEWAY_PLAN.md) และ [`docs/gateway/server.js`](file:///c:/Users/Tontun/Documents/thoen-hospital-website/docs/gateway/server.js)*
