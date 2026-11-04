# รายการงานรอพัฒนาต่อสำหรับ API Gateway (Gateway Refactoring TODOs)

บันทึกแผนงานและขั้นตอนการปรับปรุงสถาปัตยกรรม Thoen Hospital Unified API Gateway (รันบน Proxmox VM: `192.168.1.208:8443`) เพื่อยกระดับความปลอดภัย ความเป็นระเบียบ และการบำรุงรักษาในระยะยาว โดยไม่กระทบการทำงานของระบบปัจจุบัน (Zero-Downtime Refactoring)

> **สถานะปัจจุบัน (ณ พฤศจิกายน 2569):**
> * ขนาดไฟล์ `server.js` ปัจจุบัน: **3,021 บรรทัด**
> * จำนวน Endpoints ทั้งหมด: **61 เส้นทาง**
> * ครอบคลุม 3 ฐานข้อมูล: HOSxP (`192.168.1.4`), Salary (`192.168.1.4`), App/Website DB (`192.168.1.7`)
> * โมดูลใหม่ที่เพิ่มเข้ามา: Palliative Care (PC.1, PC.3, VN Clincal Popup, Registries), GTW Article Sync, Member Position Permissions

---

### [ ] 1. แยกโครงสร้างไฟล์ `server.js` เป็น Fastify Modular Plugins (ความสำคัญ: สูง / ปลอดภัยทำได้ทันที)
* **เป้าหมาย:** แตกไฟล์ก้อนเดี่ยว `server.js` (3,021 บรรทัด) ออกเป็นโมดูลย่อยตามโดเมนในโฟลเดอร์ `routes/` เพื่อให้อ่านง่าย ดูแลเฉพาะจุดได้สะดวก และลดความเสี่ยงเวลาแก้ไข
* **โครงสร้างเป้าหมาย:**
  ```text
  /home/thoen/thoen-api-gateway/
  ├── server.js               # Entry point: โหลด config, สร้าง DB pools, register plugins (~150 บรรทัด)
  ├── package.json
  ├── docker-compose.yml       # เพิ่ม volume mount: ./routes:/app/routes
  └── routes/
      ├── health.js           # GET /health (ตรวจสถานะ Uptime & Database Pools)
      ├── clinical.js         # /api/v1/clinical/* (ER, IPD, นัดหมาย, Lab, ยา, TB, RCM)
      ├── palliative.js       # /api/v1/clinical/rcm/palliative-care & /api/v1/app/palliative-care/*
      ├── salary.js           # /api/v1/salary/* (ระบบเงินเดือน, สลิป, งวดเงิน, นำเข้าข้อมูล)
      ├── app.js              # /api/v1/app/* (สมาชิก, สิทธิ์, ข่าว, สไลด์, งานซ่อม, ครุภัณฑ์, กิจกรรม)
      ├── gtw.js              # /api/v1/gtw/* (ซิงค์บทความ GTW)
      ├── audit.js            # /api/v1/audit/* (Audit Log ตามมาตรฐาน PDPA)
      └── rawSql.js           # /api/v1/{app,salary,clinical}/{query,execute,transaction} (กักกันชั่วคราว)
  ```
* **ขั้นตอนการดำเนินการ (Zero-Downtime & Safe Switch):**
  - [ ] 1.1 เขียนและแยกโค้ดลงใน `routes/*.js` ในคลังโค้ดท้องถิ่น และทดสอบ Syntax ด้วย `node --check`
  - [ ] 1.2 ปรับปรุง `docker-compose.yml` บนเซิร์ฟเวอร์ ให้ mount โฟลเดอร์ `./routes:/app/routes`
  - [ ] 1.3 สำรองไฟล์เดิมไว้เสมอ เช่น `cp server.js server.js.bak_$(date +%Y%m%d_%H%M%S)`
  - [ ] 1.4 รันคู่ขนานทดสอบบนพอร์ตสำรอง (เช่น 8444) หรือ dry-run จนแน่ใจว่า API ทุกเส้นตอบสถานะ 200 OK
  - [ ] 1.5 สลับมาใช้พอร์ต 8443 บน Production (ใช้เวลารีสตาร์ต Container เพียง 1-2 วินาที)

---

### [ ] 2. ทยอยแทนที่ Raw SQL Endpoints ด้วย Named APIs (ความสำคัญ: ปานกลาง-สูง)
* **เป้าหมาย:** เลิกส่งคำสั่ง SQL ดิบ (`/query`, `/execute`, `/transaction`) จาก Next.js ข้ามเครือข่าย เพื่อความปลอดภัยสูงสุด (Decoupled Data Architecture) และป้องกันความเสี่ยงจาก SQL Injection
* **สำรวจไฟล์ฝั่งเว็บที่ยังมีการเรียก Raw SQL:**
  - [ ] **`src/lib/memberDb.ts`**:
    - [ ] `apiGateway.app.query`
    - [ ] `apiGateway.app.transaction` (กรณีคำสั่ง INSERT/UPDATE/SET NAMES)
  - [ ] **`src/lib/salaryDb.ts`**:
    - [ ] `apiGateway.salary.query`
    - [ ] `apiGateway.salary.execute`
  - [ ] **`src/app/api/kpi/import/route.ts`**:
    - [ ] `apiGateway.app.transaction(chunk)` สำหรับนำเข้าข้อมูล KPI แบบ Batch
  - [ ] **`src/lib/clinical/palliativeRegistryService.ts`**:
    - [ ] `apiGateway.app.query` ในการดึงข้อมูลทะเบียนผู้ป่วยประคับประคองและตรวจสอบความซ้ำซ้อน
* **ขั้นตอนการปลดระวาง (Deprecation Roadmap):**
  - [ ] สร้าง Named API รองรับการทำงานของฟังก์ชันข้างต้นบน Gateway
  - [ ] ปรับโค้ดใน Next.js ให้เรียกผ่าน Named API แทน
  - [ ] เมื่อไม่มีส่วนใดในระบบเรียกใช้แล้ว ให้ปิดตาย (Disable) Endpoint `/api/v1/app/query`, `/execute`, `/transaction` และ `/api/v1/salary/execute`

---

### [ ] 3. ตรวจสอบความเสถียรและความปลอดภัยผ่าน Cloudflare Tunnel (ความสำคัญ: ทั่วไป)
* **เป้าหมาย:** ยืนยันความปลอดภัยและความถูกต้องเมื่อเว็บ Next.js สื่อสารกับ Gateway ผ่าน Cloudflare Tunnel (HTTPS)
* **รายการที่ต้องตรวจสอบ:**
  - [ ] ตรวจสอบว่า HTTP Header `x-api-key` ส่งผ่าน Tunnel ครบถ้วน ไม่ถูกตัดทอน
  - [ ] ตั้งค่า Header `Cache-Control: no-store, private` บน Gateway เพื่อป้องกัน Cloudflare CDN แอบแคชข้อมูลส่วนบุคคล (PDPA/PHI)
  - [ ] วัด Response Time และตรวจสอบการหลุดของ Connection ภายใต้คำขอปริมาณมาก (Stress Test เบื้องต้น)

---
*เอกสารอ้างอิง: [`docs/ZERO_DB_GATEWAY_PLAN.md`](file:///c:/Users/Tontun/Documents/thoen-hospital-website/docs/ZERO_DB_GATEWAY_PLAN.md) และ [`docs/gateway/server.js`](file:///c:/Users/Tontun/Documents/thoen-hospital-website/docs/gateway/server.js)*
