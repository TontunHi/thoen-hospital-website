# รายการงานรอพัฒนาต่อสำหรับ API Gateway (Gateway Refactoring TODOs)

บันทึกข้อเสนอแนะจากการตรวจระบบ (Ponytail Review) เพื่อนำมาปรับปรุงต่อในภายหลัง โดยไม่กระทบการทำงานของระบบปัจจุบัน

---

### [ ] 1. ทยอยแทนที่ Raw SQL Endpoints ด้วย Named APIs (ความสำคัญ: ปานกลาง-สูง)
* **เป้าหมาย:** เลิกส่งคำสั่ง SQL ดิบ (`/query`, `/execute`) จาก Next.js ไปยัง Gateway เพื่อความปลอดภัยระดับสูงสุด (Decoupled Data Architecture)
* **รายการที่ต้องทำ:**
  - [ ] สำรวจและเปลี่ยนการเรียกใน [`src/lib/memberDb.ts`](file:///c:/Users/Tontun/Documents/thoen-hospital-website/src/lib/memberDb.ts) ให้เรียกผ่าน Named API เฉพาะทาง
  - [ ] สำรวจและเปลี่ยนการเรียกใน [`src/lib/salaryDb.ts`](file:///c:/Users/Tontun/Documents/thoen-hospital-website/src/lib/salaryDb.ts) ให้เรียกผ่าน Named API เฉพาะทาง
  - [ ] สำรวจการเรียก transaction ใน [`src/app/api/kpi/import/route.ts`](file:///c:/Users/Tontun/Documents/thoen-hospital-website/src/app/api/kpi/import/route.ts)
  - [ ] เมื่อไม่มีส่วนใดในเว็บเรียก Raw SQL แล้ว ให้ปิดการทำงานของ Endpoint `/api/v1/app/query`, `/execute` และ `/api/v1/salary/execute`

---

### [ ] 2. แยกโครงสร้างไฟล์ `server.js` เป็น Fastify Modular Plugins (ความสำคัญ: ปานกลาง)
* **เป้าหมาย:** แตกไฟล์ `server.js` (ความยาว ~2,400 บรรทัด) ออกเป็นโมดูลย่อยตามหน้าที่ เพื่อให้อ่านและดูแลง่าย
* **โครงสร้างเป้าหมาย:**
  ```text
  /home/thoen/thoen-api-gateway/
  ├── server.js            # Entry point: โหลด config, สร้าง connection pools, register plugins
  └── routes/
      ├── health.js        # GET /health
      ├── clinical.js      # /api/v1/clinical/* (HOSxP)
      ├── salary.js        # /api/v1/salary/* (ระบบเงินเดือน)
      ├── app.js           # /api/v1/app/* (ระบบเว็บและสมาชิก)
      └── audit.js         # /api/v1/audit/* (Audit Log)
  ```
* **ขั้นตอนเตรียมการ:**
  - [ ] ปรับปรุง `docker-compose.yml` บนเซิร์ฟเวอร์ ให้ mount โฟลเดอร์ `./routes:/app/routes`
  - [ ] ทดสอบรันคู่ขนานบนพอร์ตสำรอง (เช่น 8444) เพื่อยืนยันว่าไม่มี syntax error ก่อนสลับบน production

---

### [ ] 3. ทดสอบการเชื่อมต่อผ่าน Cloudflare Tunnel (ความสำคัญ: ทั่วไป)
* **เป้าหมาย:** ตรวจสอบความถูกต้องของการยิง API จากภายนอกเครือข่ายโรงพยาบาลผ่าน Cloudflare Tunnel (HTTPS)
* **รายการที่ต้องทำ:**
  - [ ] ทดสอบยิง `GET /health` ผ่าน URL โดเมนภายนอกของ Gateway
  - [ ] ตรวจสอบว่า header `x-api-key` ส่งผ่าน Tunnel ได้ถูกต้องและไม่มีการแคชที่ไม่ต้องการ (Cache-Control)

---
*เอกสารอ้างอิง: [`docs/ZERO_DB_GATEWAY_PLAN.md`](file:///c:/Users/Tontun/Documents/thoen-hospital-website/docs/ZERO_DB_GATEWAY_PLAN.md) และ [`docs/gateway/server.js`](file:///c:/Users/Tontun/Documents/thoen-hospital-website/docs/gateway/server.js)*
