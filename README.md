# 🏥 Thoen Hospital Web Application (ระบบเว็บไซต์โรงพยาบาลเถิน)

ยินดีต้อนรับสู่ระบบสารสนเทศและเว็บไซต์หลักของ **โรงพยาบาลเถิน อำเภอเถิน จังหวัดลำปาง** 
ระบบนี้พัฒนาขึ้นเพื่อให้บริการประชาชนและบุคลากรภายในโรงพยาบาลด้วยเทคโนโลยีที่ทันสมัย ปลอดภัย และมีประสิทธิภาพสูงตามมาตรฐานระบบสารสนเทศโรงพยาบาล

---

## 🚀 คุณลักษณะสำคัญของระบบ (Key Features)

### 👥 บริการสำหรับประชาชน (Public Services)
* **ข่าวสารและประชาสัมพันธ์ (CMS):** ติดตามข่าวสาร กิจกรรมสุขภาพ และประกาศรับสมัครงาน พร้อมแบนเนอร์ภาพและวิดีโอสไลด์โชว์ที่หน้าแรก (รองรับการสตรีมมิ่งไฟล์วิดีโอแบบ HTTP 206 Partial Content)
* **ระบบตรวจสอบวันนัดหมายแพทย์ (/check-date):** ตรวจสอบวันนัดแพทย์ล่วงหน้าได้ด้วยตนเองโดยใช้เลขบัตรประจำตัวประชาชน 13 หลัก
  * *ความปลอดภัยด้านข้อมูล (Data Privacy):* ระบบปกปิดข้อมูลอ่อนไหว (บดบังตัวอักษรของชื่อและนามสกุลตามหลัก PDPA แสดงเฉพาะอักษรส่วนท้าย) พร้อมจำกัดอัตราการสืบค้น (Rate Limiter)
* **ระบบลงทะเบียนบุคลากรใหม่ (/register):** ระบบกรอกข้อมูลและส่งคำขอขึ้นทะเบียนบุคลากรโรงพยาบาล 5 ขั้นตอน (ข้อมูลส่วนตัว, กลุ่มงาน/ตำแหน่งตามโครงสร้าง Gotowin, สิทธิ์ระบบ HOSxP & Member Portal, ข้อมูลสวัสดิการที่พักอาศัย/แฟลต เช่น แฟลตพวงชมพู และยานพาหนะเข้าออก, ข้อมูลการติดต่อ)
  * *PDPA Consent Modal:* หน้าต่างป๊อปอัปนโยบายคุ้มครองข้อมูลส่วนบุคคลดีไซน์ใหม่แบบ Structured Cards 5 หมวดหมู่ พร้อมฟังก์ชันทำความเข้าใจและยินยอมอัตโนมัติ
* **คลังความรู้การใช้ยาอย่างสมเหตุผล (/rdu - Rational Drug Use):** เผยแพร่คู่มือ แนวทางเวชปฏิบัติการใช้ยาอย่างสมเหตุผล และเอกสารความรู้เภสัชกรรมสำหรับบุคลากรทางการแพทย์และประชาชน
* **ศูนย์เอกสารจริยธรรมและการกำกับดูแล (/ethics):** เผยแพร่เอกสารจริยธรรมทางการแพทย์ ธรรมาภิบาล และคู่มือการปฏิบัติงานแยกตามปีงบประมาณ
* **ศูนย์บทความคุณธรรมและความโปร่งใส (/ita):** เผยแพร่บทความการประเมินคุณธรรมและความโปร่งใส (ITA) ผลการดำเนินงาน และรายงานประจำปีสู่สาธารณชน
* **ศูนย์รวมระบบสารสนเทศและแดชบอร์ดสาธารณสุข (/systems):** รวบรวมลิงก์บริการกระทรวงสาธารณสุข (MOPH) และ Power BI Dashboards

---

### 🔐 บริการสำหรับบุคลากร (Staff Portal & Internal Systems)
* **ระบบล็อกอินแบบไร้รหัสผ่าน (Passwordless OTP & ThaID):** เข้าสู่ระบบผ่านเลขบัตรประชาชน โดยรหัส OTP (6 หลัก) จะถูกส่งตรงไปยังอีเมลส่วนตัวของบุคลากรอย่างปลอดภัย และรองรับการยืนยันตัวตนผ่าน ThaID
* **ระบบจัดการคำขอลงทะเบียนบุคลากร (/member/registrations):** พื้นที่สำหรับผู้ดูแลระบบและฝ่ายบุคคลในการตรวจสอบประวัติ คัดกรองตามกลุ่มงาน และอนุมัติ/ปฏิเสธคำขอเปิดใช้งานระบบ
* **ระบบศูนย์รับแจ้งงานและงานซ่อมบำรุง (/member/inbox & /member/repairs):** บริหารจัดการ Ticket งานแจ้งซ่อม มอบหมายงานช่าง การเปลี่ยนสถานะงาน (Approve/Reject/Send Back) ผ่าน Unified Task Permission Resolver พร้อมบันทึกประวัติการเปลี่ยนสถานะแบบ 2-Tier Audit
* **ระบบบริหารจัดการครุภัณฑ์และสถานที่ (/member/assets & /member/locations):** บันทึกและเชื่อมโยงครุภัณฑ์โรงพยาบาลเข้ากับรหัสห้อง/อาคาร Gotowin พร้อมระบบอนุมานหมวดหมู่อัตโนมัติจากรหัส FSN (IT, เครื่องมือแพทย์, ทั่วไป)
* **ระบบคลังความรู้ RDU (/member/rdu):** บริหารจัดการโครงสร้างโฟลเดอร์เอกสาร RDU และอัปโหลดไฟล์แนวทางเวชปฏิบัติการใช้ยาอย่างสมเหตุผล
* **ระบบจัดการเอกสารจริยธรรม (/member/ethics):** จัดการเอกสารจริยธรรมแบบลำดับชั้น (Hierarchy Tree) อัปโหลดไฟล์ และจัดการปีงบประมาณ
* **ระบบแจ้งเตือนผ่าน Telegram ทันที (Telegram Instant Alerts):** แจ้งเตือนข้อความอัตโนมัติเข้ากลุ่มงานหรือส่วนตัวผ่าน Telegram Bot ทันทีที่มีการแจ้งซ่อมใหม่หรืองานที่รอการอนุมัติ
* **สืบค้นประวัติการรักษาและผลแลป (/service/lab):** ค้นหาประวัติการตรวจรักษา รายการยา ผลการตรวจทางห้องปฏิบัติการ (LAB) และ X-Ray ทั้ง OPD/IPD จากฐานข้อมูล HOSxP พร้อมระบบบันทึกประวัติการเข้าถึงข้อมูล (Audit Trail)
* **ระบบติดตามผลแลป รพ.สต. (/service/lab-tracker):** แสดงสถานะการส่งตรวจและรายงานผล LAB ประจำวันแบบเรียลไทม์ จำแนกตามรายชื่อแพทย์และเจ้าหน้าที่ผู้สั่งตรวจสำหรับเครือข่าย รพ.สต.
* **ระบบติดตามการจ่ายยาลอราทาดีน (/service/loratadine-dispense):** ตรวจสอบรายชื่อและสถิติผู้ป่วยที่ได้รับการสั่งจ่ายยาลอราทาดีนทั้งโรงพยาบาลแบบเรียลไทม์ พร้อมตัวกรองอายุ > 19 ปี และระบบ Auto Refresh
* **สลิปเงินเดือนออนไลน์ (Salary Slip SSO):** เชื่อมโยงระบบบุคลากรเข้ากับฐานข้อมูลบัญชีเงินเดือน ช่วยให้บุคลากรตรวจสอบสลิปเงินเดือนและค่าตอบแทน OT ย้อนหลังได้อย่างสะดวกและปลอดภัย
* **ระบบนำเข้าข้อมูลการเงิน (/member/upload-salary):** ระบบสำหรับเจ้าหน้าที่การเงินในการอัปโหลดไฟล์ Excel/CSV และจัดการงวดจ่ายเงินเดือน
* **ระบบแสดงผลห้องฉุกเฉินเรียลไทม์ (ER Live Status):** แสดงสถานะผู้ป่วยฉุกเฉินปัจจุบัน จำแนกตามระดับความเร่งด่วน (Triage Colors) พร้อมโหมดแสดงผลบนหน้าจอทีวี (TV Mode)
* **ระบบอนุมัติเอกสารและลงนามดิจิทัล (Digital Signature):** หัวหน้ากลุ่มงานและผู้อำนวยการสามารถตรวจสอบใบขอสั่งผลิตสื่อ ลงลายเซ็นดิจิทัลผ่านหน้าจอ และแปลงเป็นใบอนุมัติสั่งงานขนาด A4 สำหรับพิมพ์ได้ทันที
* **ระบบจัดการบทความ ITA (/member/ita):** ระบบเขียนและจัดการบทความ ITA พร้อม Text Editor สำหรับเจ้าหน้าที่ผู้ได้รับมอบหมาย
* **ระบบลงทะเบียนหนังสือส่งออก Online (/service/outgoing-document):** สืบค้นและลงทะเบียนหนังสือส่งออกทางราชการแยกตามปีงบประมาณ

---

## 🛠️ สถาปัตยกรรมและเทคโนโลยีหลัก (Tech Stack & Architecture)

* **Framework:** [Next.js (App Router)](https://nextjs.org/) + TypeScript (Next.js 16+ พร้อม React 19 และ Turbopack)
* **High-Performance Go Backend Service:** [Go / Gin](https://gin-gonic.com/) ทำหน้าที่เป็น Strangler Fig Service รองรับงานที่มี Concurrency สูง (ER Live Status, Lab Tracker, Clinical Visit History, IPD Ward Status, Bed Occupancy, Drug Queue, Appointment Search & Zero-copy HTTP 206 Media Streaming) ช่วยลด RAM (~25 MB) และลดภาระ Event Loop ของ Node.js
* **Database ORM:** [Prisma Client](https://www.prisma.io/) (Prisma 6)
* **Database Architecture (Multi-Database):**
  * **Primary DB (MySQL/MariaDB):** เก็บข้อมูลโครงสร้างระบบ CMS, ข่าวสาร, สมาชิก, งานซ่อม, ลายมือชื่อดิจิทัล, และบันทึก Audit Logs โดยมีการกำหนด **Composite Indexes** เช่น `members(department, role)` และ `audit_logs(actionType, timestamp)` เพื่อคงประสิทธิภาพระดับ $O(\log N)$ เมื่อข้อมูลขยายตัว
  * **HOSxP Database (Read-Only Pool):** เชื่อมโยงข้อมูลผู้ป่วย, นัดหมาย, ห้องฉุกเฉิน, และผลแลปผ่าน Connection Pool ที่ปลอดภัย
  * **Salary Database (Read-Only Pool):** เชื่อมโยงฐานข้อมูลสลิปเงินเดือนและค่าตอบแทน OT
* **Unified Domain Services:**
  * `DocumentStorage`: จัดการไฟล์ อัปโหลด ดาวน์โหลด และสตรีมมิ่ง HTTP 206
  * `MemberAuthService`: ควบคุม Lifecycle ของ Session บุคลากร, OTP, และ ThaID
  * `RegistrationService`: จัดการ Workflow การลงทะเบียนและอนุมัติบุคลากร
  * `HospitalAssetService`: จัดการครุภัณฑ์และสถานที่
  * `RduService`: จัดการโครงสร้างคลังความรู้การใช้ยาอย่างสมเหตุผล
  * `EthicsDocumentService`: จัดการเอกสารจริยธรรมและลำดับชั้นปีงบประมาณ
  * `ItaBlogService`: จัดการบทความ ITA
  * `TaskInboxService` & `TaskPermissionResolver`: ควบคุมการเปลี่ยนสถานะ Workflow งานซ่อมและสิทธิ์การอนุมัติ
* **Messaging & Alerts:** Telegram Bot API (`@/lib/telegramService.ts`)
* **Validation & Security:** Zod schemas, HMAC-SHA256 Token Signatures, Rate Limiting, RBAC & Defensive Server-side Guards
* **Testing:** [Vitest](https://vitest.dev/) สำหรับการทดสอบ Unit และ Integration Tests แบบ Dependency Injection ครอบคลุมกว่า 300 tests พร้อม Go Unit Tests สำหรับไมโครเซอร์วิส

---

## 🔒 มาตรฐานความปลอดภัยและการปกป้องข้อมูล (Security & Privacy)

1. **การป้องกันเส้นทางที่ฝั่งเซิร์ฟเวอร์ (Defensive Server-side Protection):** ทุกเพจและ API ภายในระบบสมาชิก (Member Portal) และระบบผู้ดูแลระบบ มีการตรวจสอบเซสชันและสิทธิ์ (RBAC) ที่ฝั่งเซิร์ฟเวอร์ หากไม่มีสิทธิ์จะถูก Redirect ทันที
2. **การปกป้องข้อมูลสุขภาพส่วนบุคคล (PHI & PDPA):** หมายเลขบัตรประชาชน, HN, และข้อมูลสุขภาพจะได้รับการปกปิด (Masking) แสดงเฉพาะ 4 หลักท้ายใน UI และ Logs รวมถึงมี Popup นโยบาย PDPA แจ้งสิทธิของเจ้าของข้อมูลอย่างชัดเจน
3. **สถาปัตยกรรมบันทึกประวัติการใช้งานสองระดับ (Two-Tier Audit Architecture):**
   * *Tier 1 (Hospital Compliance Audit Logs):* บันทึกทุกการเข้าถึงและแก้ไขข้อมูลสุขภาพ (Lab, ER, IPD, นัดหมาย), ข้อมูลการเงิน และ CMS
   * *Tier 2 (Workflow Audit Logs):* บันทึกการเปลี่ยนสถานะของ Ticket งานแจ้งซ่อมและงานอนุมัติ พร้อมค่าแฮชดิจิทัลและ Field-level Diffs
4. **ความปลอดภัยของไฟล์และลายมือชื่อดิจิทัล:** ลายเซ็นอิเล็กทรอนิกส์และเอกสารแนบจะถูกจัดเก็บนอก Public Web Root ตรวจสอบ MIME Type และขนาดไฟล์ที่ฝั่งเซิร์ฟเวอร์ และเข้าถึงได้เฉพาะผ่าน Signed/Expiring URLs หรือ Session Guards เท่านั้น
5. **การป้องกันข้อผิดพลาดรั่วไหล (Zero Stack Trace Leak):** Backend Logging ทำงานผ่าน `pino` (@/lib/logger) โดยไม่มีการส่ง Stack Trace หรือ SQL Queries ดิบกลับไปยังเบราว์เซอร์ผู้ใช้งาน

---

## 📂 โครงสร้างโฟลเดอร์โครงการ (Directory Structure)

```text
├── backend-go/                # Go High-Performance Microservice (Strangler Fig Pattern)
│   ├── cmd/server/            # Entrypoint (HTTP Server, Router & Graceful Shutdown)
│   ├── internal/
│   │   ├── cache/             # Thread-safe In-Memory Cache (TTL)
│   │   ├── config/            # Environment Configuration
│   │   ├── database/          # sqlx Connection Pool to HOSxP
│   │   ├── handlers/          # Clinical, ER, Lab, Ward, Drug & Stream Handlers
│   │   ├── middleware/        # HMAC-SHA256 Auth & IP Rate Limiting
│   │   └── models/            # Domain Structs & DTOs
│   └── README.md              # คู่มือการใช้งานและเอกสารสถาปัตยกรรม Go
├── prisma/                    # สคีมาและฐานข้อมูลหลัก (Prisma Database Schema & Migrations)
├── public/                    # ไฟล์ Static ทั่วไป (โลโก้ ภาพพื้นหลัง เอกสารสาธารณะ)
├── storage/                   # พื้นที่จัดเก็บไฟล์ส่วนบุคคลและเอกสารแนบ (แยกโฟลเดอร์รายบุคคล)
├── src/
│   ├── app/                   # Next.js App Router (Pages & API Route Adapters)
│   │   ├── api/               # Thin HTTP Route Adapters (auth, rdu, ethics, assets, tasks, etc.)
│   │   ├── check-date/        # บริการสืบค้นวันนัดหมายแพทย์สำหรับประชาชน
│   │   ├── ethics/            # หน้าแสดงเอกสารจริยธรรมและธรรมาภิบาล
│   │   ├── ita/               # หน้าแสดงบทความ ITA และสาระความโปร่งใส
│   │   ├── member/            # Portal บุคลากร (inbox, repairs, assets, registrations, rdu, ethics, salary)
│   │   ├── news/              # ข่าวสารและประกาศประชาสัมพันธ์
│   │   ├── rdu/               # หน้าคลังความรู้การใช้ยาอย่างสมเหตุผล (Rational Drug Use)
│   │   ├── register/          # หน้าลงทะเบียนบุคลากรใหม่ 5 ขั้นตอน พร้อม PDPA Modal
│   │   ├── salary/            # หน้าสลิปเงินเดือนออนไลน์สำหรับบุคลากร
│   │   ├── service/           # บริการผลแลป, ติดตามแลป รพ.สต., ER Live Status, หนังสือส่งออก
│   │   └── systems/           # รวมลิงก์ระบบ MOPH และ Power BI Dashboards
│   ├── components/            # UI Components ส่วนกลาง (Navbar, Footer, Slideshow, Video Player)
│   ├── config/                # ค่าคงที่ระบบและที่อยู่หน่วยงาน
│   ├── features/              # วิดเจ็ตและฟีเจอร์ย่อย
│   ├── lib/                   # Deep Domain Modules & Utilities
│   │   ├── assets/            # HospitalAssetService & Gotowin location binding
│   │   ├── auth/              # MemberAuthService, OTP, ThaID OAuth
│   │   ├── clinical/          # Clinical Records, IPD Ward, Lab Query Services
│   │   ├── cms/               # EthicsDocumentService, ItaBlogService
│   │   ├── rdu/               # RduService (คลังความรู้ RDU)
│   │   ├── registration/      # RegistrationService & Registration Constants
│   │   ├── salary/            # SalaryBatchService & Slip Decryption
│   │   ├── storage/           # DocumentStorage (Unified File I/O & HTTP 206 Streaming)
│   │   ├── audit.ts           # Two-Tier Audit Logger
│   │   ├── cache.ts           # In-Memory Cache สำหรับผลสืบค้นความถี่สูง
│   │   ├── logger.ts          # Structured Pino Logger
│   │   ├── taskInboxService.ts# Workflow State Engine สำหรับงานแจ้งซ่อมและอนุมัติ
│   │   ├── taskPermissionResolver.ts # ศูนย์กลางประเมินสิทธิ์ Workflow
│   │   └── telegramService.ts # Telegram Bot Notification Service
│   └── types/                 # TypeScript Types & Domain Interfaces
├── next.config.ts             # การตั้งค่า Next.js, Security Headers และ CSP
└── tsconfig.json              # กำหนดค่าการคอมไพล์ภาษา TypeScript
```

---

## ⚙️ ขั้นตอนการติดตั้งและทดสอบ (Getting Started)

### 1. ติดตั้ง Package และ Dependencies
รันคำสั่งต่อไปนี้ที่ไดเรกทอรีหลักของโปรเจกต์:
```bash
npm install
```

### 2. ตั้งค่าไฟล์ Environment (.env)
คัดลอกไฟล์ต้นแบบ `.env.example` ไปสร้างเป็นไฟล์ใหม่ในชื่อ `.env` และกำหนดค่าต่าง ๆ ให้ถูกต้อง:
```bash
cp .env.example .env
```
*ระบุค่าการเชื่อมต่อฐานข้อมูลหลัก (`DATABASE_URL`), ฐานข้อมูลอ่านอย่างเดียว (Salary, HOSxP), ข้อมูลโฮสต์อีเมลสำหรับการส่ง OTP (SMTP), ข้อมูลบอท Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) และรหัสความปลอดภัยสำหรับการเข้ารหัสเซสชัน*

### 3. เตรียมฐานข้อมูลและสร้าง Prisma Client
ซิงค์โครงสร้างตารางข้อมูลและสร้าง Client สำหรับเชื่อมต่อฐานข้อมูล:
```bash
npx prisma generate
```

### 4. สตาร์ทระบบในโหมดพัฒนา (Development Mode)
```bash
npm run dev
```
เปิดใช้งานระบบและเข้าทดสอบผ่านทางเบราว์เซอร์ได้ที่ [http://localhost:3000](http://localhost:3000)

### 5. รันชุดการทดสอบอัตโนมัติ (Automated Tests)
รันชุดการทดสอบ Vitest เพื่อตรวจสอบความถูกต้องของ Domain Services, Auth, และ Permission Resolvers:
```bash
npm test
```

### 6. ทำการ Build และเปิดบริการจริง (Production Mode)
```bash
npm run build
npm run start
```

---
*© 2026 โรงพยาบาลเถิน จังหวัดลำปาง. สงวนลิขสิทธิ์ทั้งหมด.*
