# Thoen Hospital Web Portal

ระบบเว็บพอร์ทัลบริการประชาชนและระบบสารสนเทศบริหารจัดการภายใน **โรงพยาบาลเถิน จังหวัดลำปาง** พัฒนาด้วย **Next.js 16 (App Router / Turbopack)**, **React 19**, **TypeScript (Strict Mode)** ภายใต้สถาปัตยกรรม **Zero-Database Unified API Gateway** และ **MinIO S3 Object Storage**

---

## สารบัญ

- [ภาพรวมระบบ](#ภาพรวมระบบ)
- [โครงสร้างโมดูลและเส้นทางใช้งาน](#โครงสร้างโมดูลและเส้นทางใช้งาน)
- [สถาปัตยกรรมระบบ (Zero-DB Architecture)](#สถาปัตยกรรมระบบ-zero-db-architecture)
- [มาตรฐานทางวิศวกรรม (Engineering Principles)](#มาตรฐานทางวิศวกรรม-engineering-principles)
- [เทคโนโลยีหลัก](#เทคโนโลยีหลัก)
- [วิธีติดตั้งและเริ่มพัฒนาระบบ](#วิธีติดตั้งและเริ่มพัฒนาระบบ)
- [คำสั่งและสคริปต์ในระบบ](#คำสั่งและสคริปต์ในระบบ)
- [การทดสอบคุณภาพระบบ](#การทดสอบคุณภาพระบบ)
- [นโยบายความมั่นคงปลอดภัยและ PDPA](#นโยบายความมั่นคงปลอดภัยและ-pdpa)

---

## ภาพรวมระบบ

ระบบถูกแบ่งออกเป็น 2 ส่วนหลัก เพื่อความปลอดภัยสูงสุดและการแยกสิทธิ์อย่างเด็ดขาด:

1. **Public Portal (บริการประชาชน & ข้อมูลสาธารณะ):** 
   - ค้นหาวันนัดหมายแพทย์ล่วงหน้าแบบเรียลไทม์ (เชื่อม HOSxP Read-Only ผ่าน Gateway พร้อม Rate Limiter และมาสก์ชื่อ-นามสกุลตาม PDPA)
   - ระบบคัดกรองสุขภาพเชิงรุกและจัดคิวผ่านเครื่องอ่านบัตรประชาชน Smart Card
   - ข่าวสารสุขภาพ ประกาศจัดซื้อจัดจ้าง สมัครงาน และเอกสารธรรมาภิบาล ITA / ชมรมจริยธรรม
2. **Staff Portal (`/member` — ระบบงานบุคลากรโรงพยาบาล):**
   - เข้าสู่ระบบแบบไร้รหัสผ่าน (Passwordless) ด้วย Email OTP หรือ ThaID OpenID Connect พร้อมระบบต่ออายุ Session อัตโนมัติ (`/api/member/auth/refresh`)
   - กล่องงานกลาง 4 สายงาน (`MEDIA_REQUEST`, `IT_REPAIR`, `GENERAL_REPAIR`, `MEDICAL_REPAIR`) รองรับสิทธิ์แบบ Task-Centric, Workflow อนุมัติหลายระดับ, ลายมือชื่อดิจิทัล (HMAC-SHA256) และพิมพ์ใบคำขอมาตรฐาน A4
   - ระบบยืม-คืนครุภัณฑ์ (ผูกหมวดหมู่อัตโนมัติจากรหัส FSN และห้อง Gotowin) และเบิกจ่ายวัสดุสิ้นเปลือง
   - แดชบอร์ดบริหารรายได้และติดตามกองทุน (RCM Clinical Analytics): ครอบคลุม 10 แผนกคลินิก, 28 กองทุนเฉพาะโรค/ยา, การนำเข้าผู้ป่วยเบาหวาน (T1DM/GDM/PDM), ทะเบียนการดูแลประคับประคอง (Palliative Care), ระบบติดตามการส่งยาทางไปรษณีย์ (Telemed), และ Rep-Funds Waterfall Ledger
   - ปฏิทินกิจกรรมโรงพยาบาล, เช็คอินหน้างานด้วย Static QR ผ่าน ThaID (ตรวจสอบ Scan Window ตามเวลาประเทศไทย) และตารางคะแนนสะสม (Leaderboard)
   - สลิปเงินเดือนและค่าตอบแทน OT ย้อนหลังแบบเข้ารหัสความปลอดภัยสูง
   - จอแสดงผลสถานะห้องฉุกเฉินสด (ER Live TV Mode) และระบบติดตามคิวแล็บ / ผลตรวจเอกซเรย์

---

## โครงสร้างโมดูลและเส้นทางใช้งาน

### 1. บริการประชาชน (Public Routes)

| เส้นทาง (Route) | รายละเอียดการทำงาน |
|---|---|
| `/` | หน้าหลัก แบนเนอร์สไลด์ประชาสัมพันธ์ และวิดีโอสตรีมมิ่ง (HTTP 206 Partial Content) |
| `/check-date` | ค้นหาวันนัดตรวจแพทย์ด้วยเลขบัตรประชาชน 13 หลัก (เชื่อมต่อ HOSxP ผ่าน API Gateway พร้อม Rate Limiter) |
| `/service/screening` | ระบบคัดกรองสุขภาพเชิงรุก เชื่อมต่อเครื่องอ่านบัตรประชาชน Smart Card และแสดงคิวตรวจแบบเรียลไทม์ |
| `/news` | ศูนย์รวมข่าวสารสุขภาพ ประกาศจัดซื้อจัดจ้าง และรับสมัครงาน |
| `/package` | ข้อมูลคลินิกเฉพาะทางและแพ็กเกจบริการทางการแพทย์ |
| `/ita`, `/ethics` | เอกสารประเมินคุณธรรมและความโปร่งใส (ITA) และเอกสารชมรมจริยธรรมจัดกลุ่มตามปีงบประมาณ |

### 2. ระบบงานบุคลากร (`/member`)

| เส้นทาง (Route) | รายละเอียดการทำงาน |
|---|---|
| `/member/login` | เข้าสู่ระบบด้วย Email OTP หรือ ThaID OpenID Connect (ไม่ใช้รหัสผ่านถาวร) |
| `/member/inbox` | กล่องงานกลางและติดตามงานซ่อม/ขอสื่อ จัดการสิทธิ์ด้วย `TaskPermissionResolver` และเปลี่ยนสถานะผ่าน `TaskInboxService` |
| `/member/equipment-borrow` | ระบบยืม-คืนครุภัณฑ์และเบิกจ่ายวัสดุสิ้นเปลือง พร้อมจัดการสต็อกและประวัติการคืน |
| `/member/events` | ปฏิทินกิจกรรมโรงพยาบาลและระบบเช็คอิน ThaID QR Code พร้อมลีดเดอร์บอร์ดสรุปแต้ม |
| `/member/settings` | จัดการสิทธิ์การทำงานระดับโมดูลและภารกิจงาน (Task-Centric Permissions) |
| `/salary` | ค้นหาสลิปเงินเดือนและค่าตอบแทน OT ย้อนหลัง เชื่อมต่อ Salary DB ผ่าน Gateway Named APIs |

### 3. บริการคลินิกและสารสนเทศรายได้ (`/service`)

| เส้นทาง (Route) | รายละเอียดการทำงาน |
|---|---|
| `/service/dashboard-rcm` | ศูนย์กลาง RCM Analytics: ผู้ป่วยนอก OPD แยก 10 แผนกคลินิก, ผู้ป่วยใน IPD (LOS, CMI, AdjRW), ทันตกรรมประกันสังคม, และ Rep-Funds Waterfall Ledger |
| `/service/dashboard-rcm/funds/*` | รายงานและติดตาม 28 กองทุนเฉพาะโรค/ยา (เช่น T1DM/GDM/PDM, มะเร็ง, ไวรัสตับอักเสบ B/C, Streptokinase, ฟลูออไรด์, Telemed ยา, ผู้ป่วยกึ่งเฉียบพลัน IMC, ฝากครรภ์ ANC) |
| `/service/dashboard-rcm/palliative-care` | ทะเบียนและการติดตามผู้ป่วยประคับประคอง (PC.1, PC.3, Clinical VN Details) |
| `/service/budget-tracker/*` | ระบบติดตามงบประมาณ NHSO SMT และงบ MISHOS Central |
| `/service/lab`, `/service/lab-tracker` | ระบบมอนิเตอร์คิวตรวจแล็บและค้นหารายละเอียดผลการตรวจตาม HN |
| `/service/er-in-status` | มอนิเตอร์สถานะห้องฉุกเฉินสดสำหรับจอทีวี ER (Emergency Triage Live Board) |

---

## สถาปัตยกรรมระบบ (Zero-DB Architecture)

```text
[ Client: ผู้รับบริการ / บุคลากร ]
                │
                ▼
[ Next.js 16 Web Application (React 19 / Turbopack) ]
        ├── Domain Services (@/lib/clinical/*, @/lib/auth/*, @/lib/assets/*)
        ├── Storage Seam (DocumentStorage ➔ MinIO S3 SDK)
        ├── Auth Seam (MemberAuthService ➔ OTP / ThaID OIDC / JWT Refresh)
        └── Centralized Gateway Client (@/lib/apiGateway)
                │ (HTTP/2 + API-Key Encrypted Communication)
                ▼
[ Thoen Hospital Unified API Gateway ]
        ├── Named APIs (/api/v1/app/*, /clinical/*, /salary/*, /tasks/*)
        ├── Primary Database (App CMS, Members, Tasks, Permissions, Audit Logs)
        ├── HOSxP Clinical DB (Read-Only Replica: Appointments, Lab, ER, Wards)
        └── Salary DB (Read-Only Replica: Payroll, Statements, Batch Ingest)
                │
                ▼
[ Proxmox File Storage LXC ]
        └── MinIO S3 Compatible Storage (public-assets & private-documents)
```

### ข้อกำหนดทางสถาปัตยกรรมที่สำคัญ (Architectural Rules)

1. **100% Zero Direct Database Sockets:** ตัวเว็บแอปพลิเคชันไม่มีการเปิด connection ตรงไปยังพอร์ต MySQL 3306 ทุกการสืบค้นและการบันทึกข้อมูลต้องส่งผ่าน **Thoen Hospital Unified API Gateway** (`@/lib/apiGateway`)
2. **Strict Fail-Closed Policy:** หาก API Gateway ขัดข้องหรือไม่สามารถเข้าถึงได้ ระบบจะตัดการทำงานและส่งกลับ `GatewayUnavailableError` (HTTP 503) ทันที เพื่อป้องกันข้อมูลรั่วไหล
3. **MinIO Object Storage Seam:** ห้ามใช้ Node `fs` ดิบใน Route Handlers ทุกการบันทึก/อ่าน/สตรีมไฟล์ (รวมทั้ง HTTP 206 byte-range สำหรับวิดีโอ) ต้องผ่าน `@/lib/storage/documentStorage` (`DocumentStorage`) ซึ่งเชื่อมโยงกับ MinIO S3
4. **Two-Tier Audit Architecture:**
   - **Tier 1 (Hospital Compliance `audit_logs` ผ่าน `@/lib/audit`):** บันทึกการเข้าถึงข้อมูลสุขภาพ (PHI), เวชระเบียน, ผลแล็บ, เงินเดือน, การล็อกอิน และการแก้ไขการตั้งค่า
   - **Tier 2 (Workflow Audit `inbox_task_audit_logs` ผ่าน `@/lib/taskInboxService`):** บันทึกการเปลี่ยนสถานะของ Ticket, ลายมือชื่ออิเล็กทรอนิกส์ (HMAC), และ Field-level diffs
5. **การแสดงผลเวลาและปฏิทิน:** เก็บข้อมูลเวลาแบบ UTC/ISO String และแสดงผลบนหน้าจอในเขตเวลาประเทศไทย (`Asia/Bangkok`, UTC+7) โดยใช้ **ปีพุทธศักราช (พ.ศ.)** เสมอ

---

## มาตรฐานทางวิศวกรรม (Engineering Principles)

โปรเจกต์นี้ผสานแนวปฏิบัติจาก **pstack** และ **Clean Architecture**:

- **Boundary Discipline:** วาง Validation (Zod) และ Auth Checks อย่างรัดกุมที่ System Boundaries (API Routes, Form Actions) ขณะที่ Domain Logic ภายในเป็น Pure Functions ที่เชื่อถือ Typings
- **Thin Route Adapters:** API Routes (`src/app/api/**`) ต้องมีความยาวสั้น (~20–40 บรรทัด) ทำหน้าที่เป็น HTTP Adapter เท่านั้น ไม่ฝัง Business Logic หรือการประมวลผลข้อมูลลงใน Route
- **Model the Domain:** ตัดลด Boolean flags ซับซ้อนด้วย State Machine หรือ Discriminated Unions เพื่อให้สถานะที่ไม่ถูกต้องทางกฎหมาย (Invalid State) ไม่สามารถคอมไพล์ผ่านได้
- **Dependency Injection:** Domain Services ทุกตัวรับพารามิเตอร์ `QueryExecutor` เพื่อให้สามารถรัน Unit Tests บน Vitest ได้ 100% โดยไม่ต้องเชื่อมต่อฐานข้อมูลจริง
- **Fix Root Causes & Prove It Works:** สืบหาและแก้ไขข้อผิดพลาดที่ต้นตอของข้อมูล พร้อมพิสูจน์ด้วยชุดทดสอบ Vitest และหลักฐาน Runtime เสมอ

---

## เทคโนโลยีหลัก

- **Framework:** Next.js 16 (App Router / Turbopack), React 19
- **Language:** TypeScript 5 (Strict Mode)
- **Data & Gateway Layer:** Unified API Gateway Client (`@/lib/apiGateway`), Prisma 6 (Schema & Typings)
- **Object Storage:** MinIO S3 SDK (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- **Authentication:** Jose (JWT), ThaID OpenID Connect (OIDC), Brevo / Nodemailer (OTP)
- **Validation:** Zod
- **Testing:** Vitest 5, React Testing Library
- **Security & Media:** Sharp (`^0.35.4`), deepmerge-ts (`^8.0.2`), Signature Pad, Web Crypto HMAC-SHA256
- **Styling:** Tailwind CSS / OpenDesigner Craft

---

## วิธีติดตั้งและเริ่มพัฒนาระบบ

### ข้อกำหนดเบื้องต้น
- **Node.js 24+**
- บนระบบปฏิบัติการ **Windows** แนะนำให้รันคำสั่ง `npm` หรือ `npx` ผ่าน `cmd.exe /c "..."` เพื่อหลีกเลี่ยงข้อจำกัดของ PowerShell Execution Policy

### 1. โคลนคลังโค้ดและติดตั้ง Dependencies

```bash
git clone https://github.com/TontunHi/thoen-hospital-website.git
cd thoen-hospital-website
cmd.exe /c "npm install"
```

### 2. ตั้งค่าไฟล์สภาพแวดล้อม (.env)

คัดลอกไฟล์ตัวอย่าง:
```bash
cmd.exe /c "copy .env.example .env"
```

ตั้งค่าตัวแปรสำคัญใน `.env` (ดูรายละเอียดตัวแปรทั้งหมดใน `.env.example`):
```ini
# Centralized API Gateway (Zero-DB Architecture)
API_GATEWAY_URL="http://gateway.internal:8443"
API_GATEWAY_KEY="your_api_gateway_key_here"

# MinIO S3 Storage
S3_ENDPOINT="http://storage.internal:9000"
S3_ACCESS_KEY="your_minio_access_key"
S3_SECRET_KEY="your_minio_secret_key"
S3_BUCKET_PUBLIC="public-assets"
S3_BUCKET_PRIVATE="private-documents"

# Session & Security
MEMBER_SESSION_SECRET="your_secure_random_string_min_32_chars"
CRON_SECRET="your_cron_secret_min_32_chars"

# Email Delivery for OTP
BREVO_SMTP_HOST="smtp-relay.brevo.com"
BREVO_SMTP_PORT=587
BREVO_SMTP_USER="your_smtp_user"
BREVO_SMTP_PASS="your_smtp_password"

# ThaID OAuth Integration
THAID_CLIENT_ID="your_thaid_client_id"
THAID_CLIENT_SECRET="your_thaid_client_secret"
THAID_REDIRECT_URI="http://localhost:3000/api/auth/thaid/callback"
```

### 3. รันระบบในโหมด Development

```bash
cmd.exe /c "npm run dev"
```
เข้าใช้งานผ่านเบราว์เซอร์ที่ `http://localhost:3000`

### 4. คอมไพล์สำหรับ Production

```bash
cmd.exe /c "npm run build"
cmd.exe /c "npm run start"
```

---

## คำสั่งและสคริปต์ในระบบ

| คำสั่ง | รายละเอียด |
|---|---|
| `cmd.exe /c "npm run dev"` | เริ่มต้น Dev Server (Next.js 16 Turbopack บน `0.0.0.0:3000`) |
| `cmd.exe /c "npm run build"` | คอมไพล์โปรเจกต์สำหรับ Production |
| `cmd.exe /c "npm run test"` | รันชุดทดสอบ Vitest ทั้งหมด (274 test suites, 1,868 tests) |
| `cmd.exe /c "npm run test:watch"` | รัน Vitest ในโหมด Watch สำหรับพัฒนา |
| `cmd.exe /c "npm run lint"` | ตรวจสอบคุณภาพโค้ดด้วย ESLint |
| `cmd.exe /c "npx tsc --noEmit"` | ตรวจสอบ Type Safety ด้วย TypeScript Compiler |
| `cmd.exe /c "npm run db:generate"` | อัปเดต Prisma Client จาก `schema.prisma` |
| `cmd.exe /c "npm run storage:migrate"` | ถ่ายโอนไฟล์จาก Local Storage ขึ้นสู่ MinIO S3 Storage |
| `cmd.exe /c "npm run maintenance:cleanup"` | เคลียร์ประวัติ Audit Logs ที่หมดอายุตามนโยบาย PDPA |

---

## การทดสอบคุณภาพระบบ

ก่อนการ Merge หรือ Deploy ระบบขึ้น Production ต้องผ่านเกณฑ์การทดสอบทั้ง 4 ขั้นตอน:

```bash
# 1. ตรวจสอบ Lint
cmd.exe /c "npm run lint"

# 2. ตรวจสอบ Type Safety
cmd.exe /c "npx tsc --noEmit"

# 3. รัน Vitest Test Suite (ต้องผ่าน 100%)
cmd.exe /c "npm test"

# 4. ทดสอบความสมบูรณ์ของ Production Build
cmd.exe /c "npm run build"
```

---

## นโยบายความมั่นคงปลอดภัยและ PDPA

- **การคุ้มครองข้อมูลส่วนบุคคล:** ระบบนี้ปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) อย่างเคร่งครัด
- **มาตรการข้อมูลอ่อนไหว (PHI):**
  - เลขประจำตัวประชาชน 13 หลัก, ชื่อผู้ป่วย, วันเกิด, และผลตรวจทางห้องปฏิบัติการ ต้องถูก Mask (แสดงเฉพาะ 4 หลักท้าย) บน UI, Logs และ Exports
  - ห้ามพิมพ์หรือส่งต่อข้อมูลคนไข้จริงลงใน AI Prompts หรือ Test Fixtures โดยเด็ดขาด
  - ข้อมูลเวชระเบียนผู้ป่วยและสถิติการรักษาทั้งหมดถือเป็นข้อมูลความลับทางการแพทย์ขั้นสูงสุด ห้ามเผยแพร่หรือนำไปใช้นอกเหนือภารกิจงานที่ได้รับมอบหมาย
- **ลิขสิทธิ์:** © 2026 โรงพยาบาลเถิน อำเภอเถิน จังหวัดลำปาง
