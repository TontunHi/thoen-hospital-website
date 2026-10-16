# 🏥 Thoen Hospital Web Application (ระบบเว็บไซต์และสารสนเทศโรงพยาบาลเถิน)

ยินดีต้อนรับสู่ระบบเว็บพอร์ทัลและสารสนเทศทางการแพทย์ของ **โรงพยาบาลเถิน อำเภอเถิน จังหวัดลำปาง**  
ระบบนี้ได้รับการออกแบบและพัฒนาด้วยเทคโนโลยีเว็บสมัยใหม่ เพื่อให้บริการประชาชนอย่างสะดวกรวดเร็ว ควบคู่ไปกับการเป็นแพลตฟอร์มบริหารจัดการงานภายในโรงพยาบาลสำหรับบุคลากรทางการแพทย์ โดยยึดมั่นในมาตรฐานความมั่นคงปลอดภัยระดับสูง การคุ้มครองข้อมูลส่วนบุคคล (PDPA) และความต่อเนื่องในการดูแลผู้ป่วย

---

## 📋 สารบัญ (Table of Contents)
- [✨ คุณลักษณะเด่นของระบบ (Key Features)](#-คุณลักษณะเด่นของระบบ-key-features)
  - [👥 บริการสำหรับประชาชน (Public Portal)](#-บริการสำหรับประชาชน-public-portal)
  - [🔐 บริการสำหรับบุคลากรโรงพยาบาล (Hospital Staff Portal)](#-บริการสำหรับบุคลากรโรงพยาบาล-hospital-staff-portal)
- [🏗️ สถาปัตยกรรมระบบและความปลอดภัย (Architecture & Security)](#️-สถาปัตยกรรมระบบและความปลอดภัย-architecture--security)
  - [ฐานข้อมูลแบบ Multi-Database](#ฐานข้อมูลแบบ-multi-database)
  - [ระบบตรวจสอบสิทธิ์และ Audit Trail 2 ระดับ](#ระบบตรวจสอบสิทธิ์และ-audit-trail-2-ระดับ)
  - [Unified Domain Seams](#unified-domain-seams)
  - [การคุ้มครองข้อมูลสุขภาพและข้อมูลส่วนบุคคล (PDPA / PHI Protection)](#การคุ้มครองข้อมูลสุขภาพและข้อมูลส่วนบุคคล-pdpa--phi-protection)
- [🛠️ เทคโนโลยีหลักที่ใช้พัฒนา (Tech Stack)](#️-เทคโนโลยีหลักที่ใช้พัฒนา-tech-stack)
- [📂 โครงสร้างโฟลเดอร์ของโครงการ (Directory Structure)](#-โครงสร้างโฟลเดอร์ของโครงการ-directory-structure)
- [🚀 ขั้นตอนการติดตั้งและเริ่มต้นใช้งาน (Getting Started)](#-ขั้นตอนการติดตั้งและเริ่มต้นใช้งาน-getting-started)
- [🧪 การทดสอบและการตรวจสอบคุณภาพ (Testing & Verification)](#-การทดสอบและการตรวจสอบคุณภาพ-testing--verification)
- [📜 สัญญาอนุญาตและลิขสิทธิ์ (License & Copyright)](#-สัญญาอนุญาตและลิขสิทธิ์-license--copyright)

---

## ✨ คุณลักษณะเด่นของระบบ (Key Features)

### 👥 บริการสำหรับประชาชน (Public Portal)

1. **ศูนย์ข่าวสารและภาพสไลด์ประชาสัมพันธ์ (News & Hero Slides CMS):**
   - ประชาสัมพันธ์ข่าวสาร กิจกรรมสุขภาพ ประกาศจัดซื้อจัดจ้าง และรับสมัครงาน
   - แบนเนอร์ภาพสไลด์ที่หน้าแรก รองรับภาพความละเอียดสูงและวิดีโอแบบ HTTP 206 Byte-Range Streaming
2. **ระบบตรวจสอบวันนัดหมายแพทย์ล่วงหน้า (`/check-date`):**
   - ผู้รับบริการสามารถตรวจสอบวันนัดหมายแพทย์ล่วงหน้าได้ด้วยตนเองผ่านเลขบัตรประชาชน 13 หลัก
   - เชื่อมต่อข้อมูลนัดหมายแบบ Read-Only จากฐานข้อมูล HOSxP
   - มีระบบ Rate Limiter ป้องกันการยิงสืบค้นซ้ำ และปกปิดชื่อ-นามสกุลตามมาตรฐาน PDPA
3. **ระบบคัดกรองสุขภาพเชิงรุกและคิวอ่านบัตรประชาชน (`/service/screening`):**
   - รองรับหน่วยแพทย์เคลื่อนที่และจุดคัดกรองสุขภาพนอกพื้นที่
   - เชื่อมต่อเครื่องอ่านบัตรประชาชน Smart Card Reader ผ่าน Web Bridge ดึงข้อมูลและรูปถ่ายหน้าบัตรแบบ Rapid Batch Kiosk
   - หน้าจอแสดงคิวรับบริการสดพร้อมระบบ Polling อัตโนมัติทุก 3 วินาที
4. **ศูนย์บทความคุณธรรมและความโปร่งใส ITA (`/ita`):**
   - เผยแพร่ผลการประเมินคุณธรรมและความโปร่งใส (ITA) แผนงาน และเอกสารสาธารณะ
5. **ศูนย์เอกสารชมรมจริยธรรม (`/ethics`):**
   - ศูนย์รวมเอกสาร แผนปฏิบัติการ และคำสั่งคณะทำงานชมรมจริยธรรม จำแนกตามปีงบประมาณและหัวข้อย่อย
6. **ข้อมูลบริการทางการแพทย์และแพ็กเกจสุขภาพ (`/package`):**
   - แนะนำคลินิกเฉพาะทาง แพ็กเกจคลอดบุตร ทันตกรรม ตรวจสุขภาพ และห้องพิเศษ VIP

---

### 🔐 บริการสำหรับบุคลากรโรงพยาบาล (Hospital Staff Portal)

เข้าใช้งานผ่านทาง `/member` ด้วยระบบความปลอดภัยแบบองค์กร:

1. **ระบบยืนยันตัวตนแบบไร้รหัสผ่าน (Passwordless OTP & ThaID Authentication):**
   - เข้าสู่ระบบด้วยเลขบัตรประชาชน 13 หลัก โดยระบบจะส่งรหัสผ่านใช้ครั้งเดียว (OTP 6 หลัก) ไปยังอีเมลของบุคลากร
   - รองรับการเชื่อมต่อและเข้าสู่ระบบผ่านแอปพลิเคชัน ThaID (DOPA OpenID Connect)
2. **ระบบบริหารสิทธิ์แบบยึดตามภารกิจงาน (Task-Centric Permission Management):**
   - จัดการสิทธิ์การเข้าถึงโมดูลตาม "บทบาทภารกิจงาน" (`View`, `Edit/Do`, `Approve`, `Manage`)
   - รองรับทั้งการมอบสิทธิ์รายบุคคล (`member_permissions`) และตามตำแหน่งงาน (`position_permissions`)
3. **กล่องงานกลางโรงพยาบาลและกระบวนการทำงานแบบดิจิทัล (`/member/inbox`):**
   - รองรับการขอรับบริการภายใน 4 สายงานหลัก:
     - 🎨 **ขอผลิตสื่อและประชาสัมพันธ์ (`MEDIA_REQUEST`):** กราฟิก, วิดีโอ, ไวนิล
     - 💻 **แจ้งซ่อมคอมพิวเตอร์และระบบสารสนเทศ (`IT_REPAIR`)**
     - 🔧 **แจ้งซ่อมบำรุงทั่วไป อาคารและสถานที่ (`GENERAL_REPAIR`)**
     - 🩺 **แจ้งซ่อมเครื่องมือและอุปกรณ์ทางการแพทย์ (`MEDICAL_REPAIR`)**
   - วงจรการทำงานครบวงจร: ยื่นคำขอ ➔ เสนอหัวหน้ากลุ่มงานอนุมัติ ➔ ช่าง/ผู้รับผิดชอบกดรับงาน ➔ ดำเนินการ ➔ ตรวจรับและปิดงาน
   - รองรับระบบลงลายมือชื่อดิจิทัล (Digital Signature) พร้อมตรวจสอบความถูกต้องของลายเซ็นด้วย HMAC-SHA256
   - สามารถส่งออกและพิมพ์ใบคำขอสั่งงานขนาด A4 สำหรับแนบเอกสารทางราชการ
4. **ระบบบริหารจัดการวงจรรายได้โรงพยาบาล Dashboard-RCM (`/service/dashboard-rcm`):**
   - นำเสนอสถิติทางการเงิน สิทธิเบิกชดเชย e-Claim และประสิทธิภาพการจัดเก็บรายได้
   - ครอบคลุม 4 โมดูลหลัก:
     - 🦷 **สรุปทันตกรรมประกันสังคม (`sss-dental`):** รายงานการให้บริการทันตแพทย์ เงินบำรุง สิทธิ UC และลูกหนี้
     - 👨‍⚕️ **สรุปค่าบริการผู้ป่วยนอกรายแพทย์ (`opd-doctor`):** รายงานค่าบริการแยกแพทย์ รายเดือน และกรองกลุ่มสิทธิ 37 สิทธิ
     - 🏥 **สรุปค่าบริการผู้ป่วยนอกจำแนกตามแผนก (`opd-dept-summary`):** วิเคราะห์ตาม 10 สาขาคลินิกหลัก (สูติฯ, กุมารฯ, ศัลยฯ, อายุรฯ, เวชปฏิบัติครอบครัว, ออร์โธฯ, ทันตฯ, ตา, หูคอจมูก, อื่นๆ)
     - 🛏️ **สรุปการให้บริการผู้ป่วยใน (`ipd`):** รายงานวันนอน (LOS), ค่ารักษา, ค่าน้ำหนักสัมพัทธ์ (AdjRW), ดัชนีความซับซ้อนของโรค (CMI) พร้อมระบบแจ้งเตือนชาร์ตค้างสรุปเข้า Telegram อัตโนมัติ
   - รองรับการเลือกช่วงปีงบประมาณไทยแบบไดนามิก (Dynamic Fiscal Year: 1 ต.ค. - 30 ก.ย.)
5. **ระบบกิจกรรมโรงพยาบาลและการเช็คอินผ่าน ThaID (`/member/events`):**
   - ปฏิทินและศูนย์กลางกิจกรรม อบรม สัมมนา และกิจกรรมจิตอาสา
   - ระบบลงทะเบียนเข้าร่วมกิจกรรมล่วงหน้า (Pre-registration)
   - **Static QR Code Check-in:** สแกนหน้างานผ่านกล้องมือถือเข้าสู่ ThaID OAuth เพื่อยืนยันตัวตนอัตโนมัติ โดยไม่ต้องล็อกอินเว็บล่วงหน้า
   - ตรวจสอบช่วงเวลาสแกน (`checkinOpenTime` ถึง `checkinCloseTime`) ตามเวลาท้องถิ่นไทย
   - กระดานคะแนนกิจกรรม (Dense Ranking Leaderboard) ทั้งระดับบุคคลและระดับแผนก (คะแนนรวมและคะแนนเฉลี่ยต่อคน)
6. **ระบบยืม-คืนอุปกรณ์และเบิกจ่ายพัสดุ (`/member/equipment-borrow`):**
   - ยืม-คืนครุภัณฑ์โรงพยาบาล (Loanable Assets) อ้างอิงตามทะเบียนเลขครุภัณฑ์
   - เบิกจ่ายวัสดุคลัง (Supplies/Materials) ทั้งประเภทใช้งานหมุนเวียน (Reusable) และสิ้นเปลือง (Consumable)
   - ฟอร์มเลือกยืมพัสดุหลายรายการพร้อมกัน (Multi-item Basket) และระบบตรวจรับสภาพเมื่อส่งคืน
7. **ระบบติดตามข้อมูลทางคลินิก (Clinical Monitors — Read-Only HOSxP):**
   - สืบค้นประวัติการตรวจรักษา รายการยา ผลการตรวจทางห้องปฏิบัติการ (LAB) และ X-Ray ทั้ง OPD/IPD (`/service/lab`)
   - ระบบติดตามผลตรวจ LAB รพ.สต. ในเครือข่ายแบบเรียลไทม์ (`/service/lab-tracker`)
   - ระบบติดตามการสั่งจ่ายยาลอราทาดีนสำหรับกลุ่มงานแพทย์แผนไทยฯ (`/service/loratadine-dispense`)
   - รายงานสถานะห้องฉุกเฉินสด (ER Live Status) พร้อมโหมดจอโทรทัศน์ (TV Mode)
   - ตรวจสอบการครองเตียงผู้ป่วยใน (Bed Occupancy) และสถานะห้องผ่าตัด (OR Status)
8. **ระบบทะเบียนหนังสือส่งออกทางราชการ (`/service/outgoing-document` & `/member/outgoing-document`):**
   - สืบค้นและเชื่อมโยงสมุดทะเบียนหนังสือส่งออกแยกตามปีงบประมาณเข้ากับ Google Sheets
9. **ระบบสลิปเงินเดือนและค่าตอบแทนออนไลน์ (`/salary` & `/member/upload-salary`):**
   - ตรวจสอบสลิปเงินเดือน ค่าจ้าง และค่าตอบแทน OT ย้อนหลังแบบเข้ารหัส
   - ระบบสำหรับเจ้าหน้าที่การเงินในการนำเข้าและตรวจสอบงวดการจ่ายเงินเดือน

---

## 🏗️ สถาปัตยกรรมระบบและความปลอดภัย (Architecture & Security)

### ฐานข้อมูลแบบ Multi-Database
ระบบแยกการเชื่อมต่อออกเป็น 3 ฐานข้อมูลอย่างอิสระเพื่อความมั่นคงปลอดภัยและประสิทธิภาพสูงสุด:
1. **Primary Database (MySQL / MariaDB):** จัดการผ่าน Prisma 6 ORM สำหรับตารางระบบ CMS, ผู้ใช้, สิทธิ์, กล่องงานกลาง, อุปกรณ์ยืมคืน, กิจกรรม, และ Audit Logs
2. **HOSxP Database (Read-Only Pool):** เชื่อมต่อไปยังฐานข้อมูลหลักของโรงพยาบาลเพื่ออ่านข้อมูลผู้ป่วย คิวนัดหมาย ผลแลป ข้อมูลห้องฉุกเฉิน และสถิติ RCM โดยไม่มีสิทธิ์เขียนหรือแก้ไขข้อมูลใดๆ
3. **Salary Database (Read-Only Pool):** เชื่อมต่อไปยังฐานข้อมูลระบบบัญชีเงินเดือนสำหรับการออกสลิปเงินเดือน

### ระบบตรวจสอบสิทธิ์และ Audit Trail 2 ระดับ
- **Defensive Server-side RBAC:** หน้าและ API ในส่วนของ `/member` ทุกเส้นทาง บังคับตรวจสอบ Session และ Role ที่ฝั่งเซิร์ฟเวอร์ (`verifyMemberSession()`) ก่อนเรนเดอร์เสมอ
- **Two-Tier Audit Architecture:**
  1. **Tier 1 (`audit_logs` ผ่าน `logAudit()`):** บันทึกการเข้าถึงและแก้ไขข้อมูลสุขภาพ (PHI), ประวัติการรักษา, สลิปเงินเดือน, กิจกรรม Auth, การตั้งค่าระบบ และการเปลี่ยนแปลง CMS
  2. **Tier 2 (`inbox_task_audit_logs`):** บันทึกสถานะ State Machine ของกล่องงาน, ลายมือชื่ออิเล็กทรอนิกส์ (HMAC-SHA256 Hash), และการเปลี่ยนแปลงฟิลด์ข้อมูลโดยละเอียด (Field-level Diffs)

### Unified Domain Seams
ซอร์สโค้ดถูกจัดระเบียบตามหลัก Domain-Driven Design (DDD) ผ่านโมดูลศูนย์กลาง เพื่อความสะดวกในการบำรุงรักษาและการทดสอบ:
* `DocumentStorage`: จัดการไฟล์ อ่าน/เขียน/สตรีมมิ่งไฟล์วิดีโอ (HTTP 206) โดยไม่นำเข้า `fs` ตรงใน API Route
* `MemberAuthService`: ศูนย์กลางวงจร Session, OTP, และการยืนยันตัวตน ThaID
* `TaskPermissionResolver` & `TaskInboxService`: การคำนวณสิทธิ์ตามภารกิจและการขับเคลื่อน Workflow
* `HospitalAssetService`: จัดการและจำแนกหมวดหมู่ครุภัณฑ์ตามรหัส FSN และ Gotowin
* `HospitalEventService` & `eventTimeUtils`: ระบบกิจกรรม การเปิดสแกน และกระดานคะแนน
* `EquipmentBorrowService`: ระบบคำขอยืมครุภัณฑ์ การตัดสต็อก และการตรวจรับคืน
* `RcmDashboardService`: วิเคราะห์รายได้ e-Claim และจัดกลุ่ม 10 สาขาคลินิก
* `EthicsDocumentService`: จัดการโครงสร้างเอกสารชมรมจริยธรรมแบบลำดับชั้น

### การคุ้มครองข้อมูลสุขภาพและข้อมูลส่วนบุคคล (PDPA / PHI Protection)
- **การปกปิดข้อมูล (Masking):** เลขบัตรประชาชน 13 หลักและ HN จะถูกบดบังเหลือเพียง 4 หลักท้าย (`x-xxxx-xxxxx-xx-1`) และชื่อผู้ป่วยจะถูกแสดงเพียง 3 ตัวแรกในการแสดงผลภายนอก
- **ห้ามบันทึก PHI ลง Log:** ข้อมูลสุขภาพ ผลแลป และผลวินิจฉัยโรค จะไม่ถูกบันทึกลงใน Console Log หรือ Server Log เป็น Plaintext เด็ดขาด
- **การแสดงผลวันที่:** ใช้ปฏิทินพุทธศักราช (พ.ศ.) ในเขตเวลา `Asia/Bangkok` (UTC+7) สำหรับทุกหน้าจอที่แสดงต่อบุคลากรและประชาชน

---

## 🛠️ เทคโนโลยีหลักที่ใช้พัฒนา (Tech Stack)

| ส่วนประกอบ | เทคโนโลยีที่เลือกใช้ | รายละเอียด |
|---|---|---|
| **Frontend & Backend** | [Next.js 16](https://nextjs.org/) + [React 19](https://react.dev/) | พัฒนาด้วย App Router และคอมไพล์ความเร็วสูงด้วย Turbopack |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | Type Safety เข้มงวด (`strict: true`) ไร้การใช้ `any` โดยไม่จำเป็น |
| **Styling** | Vanilla CSS Architecture | สไตล์ CSS ปรับแต่งเฉพาะ โหลดเร็ว ไม่พึ่งพา CSS Framework ขนาดใหญ่ |
| **Database ORM** | [Prisma 6](https://www.prisma.io/) | Schema Management, Migrations และ Type-safe Database Queries |
| **Databases** | MySQL / MariaDB | ระบบฐานข้อมูลหลัก และ Read-Only Replicas (HOSxP, Salary) |
| **Data Validation** | [Zod](https://zod.dev/) | ตรวจสอบ Schema ของ Request Body, Query Params และ Form Inputs |
| **Security & Auth** | Jose, Crypto (HMAC-SHA256) | การสร้าง Token, เข้ารหัส State, และตรวจสอบความถูกต้องของลายเซ็น |
| **Digital Signature** | Signature Pad + Sharp | วาดลายเซ็นบน Canvas หรืออัปโหลดไฟล์ พร้อมบันทึกภาพขนาดมาตรฐาน |
| **Email Service** | Nodemailer / Brevo SMTP | ส่งรหัส OTP และอีเมลแจ้งเตือนระบบงาน |
| **Testing** | [Vitest](https://vitest.dev/) + React Testing Library | ชุดทดสอบ Unit Tests และ Integration Tests มากกว่า 500+ เคส |

---

## 📂 โครงสร้างโฟลเดอร์ของโครงการ (Directory Structure)

```text
thoen-hospital-website/
├── prisma/                          # Prisma Schema และประวัติ Migration
├── public/                          # Static Assets (รูปภาพ โลโก้ ไอคอน Manifest)
├── storage/                         # พื้นที่จัดเก็บไฟล์ส่วนบุคคล (ลายเซ็น, เอกสารแนบ)
├── src/
│   ├── app/                         # Next.js App Router (Routes & Pages)
│   │   ├── api/                     # API Routes (Thin HTTP Adapters)
│   │   │   ├── auth/                # ThaID OAuth & Callback
│   │   │   ├── member/              # APIs สำหรับระบบงานบุคลากร (Inbox, Events, Assets, Borrow)
│   │   │   ├── service/             # APIs สำหรับสถิติและบริการคลินิก (RCM, Lab, ER, Screening)
│   │   │   └── ...                  # APIs อื่นๆ (News, Slides, Ethics, Health)
│   │   ├── check-date/              # หน้าบริการสืบค้นวันนัดหมายแพทย์
│   │   ├── ethics/                  # หน้ารวมเอกสารชมรมจริยธรรม
│   │   ├── ita/                     # หน้ารวมข้อมูลและบทความ ITA
│   │   ├── member/                  # ระบบบุคลากร (Dashboard, Inbox, Events, Borrow, Settings)
│   │   ├── news/                    # หน้าข่าวสารและรายละเอียดข่าว
│   │   ├── package/                 # ข้อมูลบริการและแพ็กเกจการรักษา
│   │   ├── salary/                  # หน้าสืบค้นสลิปเงินเดือนออนไลน์
│   │   └── service/                 # หน้าบริการคลินิก (Dashboard-RCM, Lab, ER Status, Screening)
│   ├── components/                  # Shared UI Components (Navbar, Footer, Slideshow, Status)
│   ├── config/                      # ค่าคงที่และการตั้งค่าระบบ
│   ├── lib/                         # Deep Domain Modules & Service Seams
│   │   ├── assets/                  # Hospital Asset Service
│   │   ├── auth/                    # Member Auth & ThaID Service
│   │   ├── clinical/                # RCM Dashboard & Clinical Services
│   │   ├── cms/                     # Ethics Document Service
│   │   ├── equipment/               # Equipment & Material Borrow Service
│   │   ├── events/                  # Hospital Event & Leaderboard Service
│   │   ├── screening/               # Smart Card Reader & Screening Queue Service
│   │   ├── storage/                 # Document Storage Seam
│   │   ├── audit.ts                 # Tier-1 Audit Logger
│   │   ├── cache.ts                 # In-Memory Cache Helper
│   │   ├── formatters.ts            # Canonical Formatters (e.g. getInitials)
│   │   ├── prisma.ts                # Prisma Client Singleton (utf8mb4 pinned)
│   │   └── taskPermissionResolver.ts# Task Permission Resolver (Single Source of Truth)
│   └── types/                       # TypeScript Interface และ Type Definitions
├── .env.example                     # แม่แบบตัวแปรแวดล้อม (Environment Variables)
├── AGENTS.md                        # กฎระเบียบและข้อกำหนดทางสถาปัตยกรรมสำหรับทีมพัฒนา
├── CLAUDE.md                        # สรุปคำสั่งสำคัญและบริบทโครงการสำหรับ AI Assistants
├── CONTEXT.md                       # พจนานุกรมศัพท์โดเมนโรงพยาบาล (Domain Glossary)
├── next.config.ts                   # การตั้งค่า Next.js, CSP และ Security Headers
└── package.json                     # รายการ Dependencies และ Script คำสั่ง
```

---

## 🚀 ขั้นตอนการติดตั้งและเริ่มต้นใช้งาน (Getting Started)

> [!NOTE]
> สำหรับสภาพแวดล้อม Windows / PowerShell กรุณาครอบคำสั่งด้วย `cmd.exe /c "..."` เพื่อหลีกเลี่ยงข้อจำกัดของ PowerShell Execution Policy

### 1. โคลนคลังโค้ดและติดตั้ง Dependencies
```bash
git clone https://github.com/TontunHi/thoen-hospital-website.git
cd thoen-hospital-website
cmd.exe /c "npm install"
```

### 2. กำหนดค่าตัวแปรแวดล้อม (Environment Variables)
คัดลอกไฟล์ `.env.example` เป็น `.env` และตั้งค่าการเชื่อมต่อฐานข้อมูลและบริการต่างๆ:
```bash
cmd.exe /c "copy .env.example .env"
```

ตัวแปรสำคัญที่ต้องกำหนดใน `.env`:
* `DATABASE_URL`: Connection string สำหรับฐานข้อมูลหลัก MySQL
* `HOS_DB_HOST`, `HOS_DB_PORT`, `HOS_DB_USER`, `HOS_DB_PASSWORD`, `HOS_DB_NAME`: การเชื่อมต่อ HOSxP (Read-Only)
* `SALARY_DB_HOST`, `SALARY_DB_USER`, `SALARY_DB_PASSWORD`, `SALARY_DB_NAME`: การเชื่อมต่อ Salary DB (Read-Only)
* `SESSION_SECRET`: รหัสลับสำหรับเซ็น HMAC Signature ของ Session
* `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: การตั้งค่าอีเมลสำหรับจัดส่ง OTP

### 3. เตรียมฐานข้อมูลและสร้าง Prisma Client
```bash
cmd.exe /c "npm run db:generate"
```

### 4. รันระบบในโหมดพัฒนา (Development Mode)
```bash
cmd.exe /c "npm run dev"
```
เปิดบราวเซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

### 5. บิลด์และรันในโหมดใช้งานจริง (Production Build)
```bash
cmd.exe /c "npm run build"
cmd.exe /c "npm run start"
```

---

## 🧪 การทดสอบและการตรวจสอบคุณภาพ (Testing & Verification)

โครงการนี้มีเกณฑ์คุณภาพระดับสูง (Zero-Tolerance Quality Gates) ก่อนขึ้น Production:

```bash
# 1. ตรวจสอบ Linting และรูปแบบโค้ด
cmd.exe /c "npm run lint"

# 2. ตรวจสอบ Type Safety ด้วย TypeScript Compiler
cmd.exe /c "npx tsc --noEmit"

# 3. รันชุดทดสอบ Vitest ครบทั้งหมด (500+ Tests)
cmd.exe /c "npm test"

# 4. ทดสอบคอมไพล์สำหรับ Production
cmd.exe /c "npm run build"
```

---

## 📜 สัญญาอนุญาตและลิขสิทธิ์ (License & Copyright)

สงวนลิขสิทธิ์ © 2026 **โรงพยาบาลเถิน อำเภอเถิน จังหวัดลำปาง**  
พัฒนาขึ้นเพื่อสนับสนุนงานบริการสุขภาพและการบริหารจัดการของโรงพยาบาลเถิน ข้อมูลผู้ป่วยและเวชระเบียนทางการแพทย์ทั้งหมดอยู่ภายใต้การคุ้มครองตามกฎหมาย พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
