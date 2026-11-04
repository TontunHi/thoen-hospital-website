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
สร้าง Proxmox LXC Container (192.168.1.209) รัน MinIO S3-Compatible Storage
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
  - [ ] **`src/lib/memberDb.ts`** (Domain ถัดไป):
    - [ ] สำรวจและสร้าง Named API รองรับ Task Inbox, Member Profile, Permissions, Telegram Bot
    - [ ] เมื่อไม่มีส่วนใดในระบบเรียกใช้แล้ว ให้ปิดตาย (Disable) Endpoint `/api/v1/app/query`, `/execute`, `/transaction` และ `/api/v1/salary/execute` ในไฟล์ `routes/rawSql.js`

---

### [ ] Phase 3: ตรวจสอบความเสถียรและความปลอดภัยผ่าน Cloudflare Tunnel (ความสำคัญ: ปานกลาง)
* **เป้าหมาย:** ยืนยันความปลอดภัยและความถูกต้องเมื่อเว็บ Next.js สื่อสารกับ Gateway ผ่าน Cloudflare Tunnel (HTTPS)
* **รายการที่ต้องตรวจสอบ:**
  - [ ] ตรวจสอบว่า HTTP Header `x-api-key` ส่งผ่าน Tunnel ครบถ้วน ไม่ถูกตัดทอน
  - [ ] ตั้งค่า Header `Cache-Control: no-store, private` บน Gateway เพื่อป้องกัน Cloudflare CDN แอบแคชข้อมูลส่วนบุคคล (PDPA/PHI)
  - [ ] วัด Response Time และตรวจสอบการหลุดของ Connection ภายใต้คำขอปริมาณมาก (Stress Test เบื้องต้น)

---

### [ ] Phase 4: ยกระดับระบบจัดเก็บไฟล์สู่ MinIO Object Storage (ความสำคัญ: โครงสร้างพื้นฐานถัดไป)
* **เป้าหมาย:** แยกการจัดเก็บไฟล์อัปโหลด (รูปภาพข่าวสาร, สไลด์, เอกสารแนบกิจกรรม, ไฟล์แนบงานซ่อม, รูปโปรไฟล์) ออกจาก Disk ของ Web Server สู่ระบบ Object Storage มาตรฐาน S3 ช่วยให้เว็บเป็น Stateless 100% และลดความเสี่ยง Disk เต็มดึงให้ Gateway ล่ม
* **สเปก Proxmox LXC Container (CT):**
  * **OS Template:** Debian 12 Standard LXC หรือ Ubuntu 24.04 LTS
  * **vCPU:** 2 Cores
  * **RAM:** 2 GB (Swap: 1 GB)
  * **Disk:** 50 – 100 GB+ (แยก Volume ข้อมูลไว้ที่ `/mnt/data`)
  * **Network:** Static IP (เช่น `192.168.1.209/24`, Gateway: `192.168.1.1`)
  * **Ports:** `9000` (S3 API), `9001` (Web Console)
* **การเชื่อมต่อและการเขียนโค้ด (Next.js Integration):**
  - [ ] สร้าง Bucket สำหรับงานต่าง ๆ:
    - `public-assets` (รูปข่าว, สไลด์แบนเนอร์, โลโก้ — สิทธิ์ Public Read)
    - `private-documents` (เอกสารคำสั่ง, สลิป, ไฟล์แนบงานซ่อม — สิทธิ์ Private เข้าถึงผ่าน Presigned URL)
  - [ ] ติดตั้ง `@aws-sdk/client-s3` และ `@aws-sdk/s3-request-presigner` ในเว็บ Next.js
  - [ ] ปรับปรุงโมดูลกลาง [`src/lib/storage/documentStorage.ts`](file:///c:/Users/Tontun/Documents/thoen-hospital-website/src/lib/storage/documentStorage.ts) และ `src/app/uploads/[...path]/route.ts` ให้บันทึกและสตรีมไฟล์ผ่าน MinIO
  - [ ] เขียนสคริปต์ Migration เพื่อโอนย้ายไฟล์เดิมจากโฟลเดอร์ `public/uploads/` และ `storage/` ขึ้น MinIO Bucket ครั้งแรก

---
*เอกสารอ้างอิง: [`docs/ZERO_DB_GATEWAY_PLAN.md`](file:///c:/Users/Tontun/Documents/thoen-hospital-website/docs/ZERO_DB_GATEWAY_PLAN.md) และ [`docs/gateway/server.js`](file:///c:/Users/Tontun/Documents/thoen-hospital-website/docs/gateway/server.js)*
