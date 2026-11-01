# Thoen Hospital Web Portal

ระบบเว็บพอร์ทัลบริการประชาชนและระบบสารสนเทศบริหารจัดการภายใน โรงพยาบาลเถิน จังหวัดลำปาง พัฒนาด้วย Next.js (App Router), React 19, TypeScript และ Prisma

---

## สารบัญ

- [ภาพรวม](#ภาพรวม)
- [โครงสร้างโมดูลและเส้นทางใช้งาน](#โครงสร้างโมดูลและเส้นทางใช้งาน)
- [สถาปัตยกรรมระบบ](#สถาปัตยกรรมระบบ)
- [เทคโนโลยีหลัก](#เทคโนโลยีหลัก)
- [วิธีติดตั้งและเริ่มพัฒนาระบบ](#วิธีติดตั้งและเริ่มพัฒนาระบบ)
- [คำสั่งและสคริปต์ในระบบ](#คำสั่งและสคริปต์ในระบบ)
- [การทดสอบคุณภาพ](#การทดสอบคุณภาพ)
- [นโยบายข้อมูลและลิขสิทธิ์](#นโยบายข้อมูลและลิขสิทธิ์)

---

## ภาพรวม

ระบบนี้แบ่งการทำงานออกเป็น 2 ส่วนหลัก:

1. **Public Portal (บริการประชาชน):** ค้นหาวันนัดหมายแพทย์ล่วงหน้า, จุดคัดกรองสุขภาพเชิงรุกผ่านเครื่องอ่านบัตรประชาชน Smart Card, ข่าวสารประชาสัมพันธ์ และเอกสารธรรมาภิบาล ITA
2. **Staff Portal (`/member` — ระบบงานบุคลากร):** กล่องงานกลางสำหรับแจ้งซ่อม (IT, เครื่องมือแพทย์, ซ่อมบำรุง) และขอผลิตสื่อพร้อมระบบลงนามดิจิทัล, ระบบยืม-คืนพัสดุครุภัณฑ์, แดชบอร์ดวิเคราะห์รายได้โรงพยาบาล (RCM), และระบบเช็คอินกิจกรรมด้วย ThaID

---

## โครงสร้างโมดูลและเส้นทางใช้งาน

### 1. บริการประชาชน (Public Routes)

| เส้นทาง (Route) | รายละเอียดการทำงาน |
|---|---|
| `/` | หน้าหลัก แบนเนอร์ประชาสัมพันธ์ และวิดีโอสตรีมมิ่ง (HTTP 206) |
| `/check-date` | ค้นหาวันนัดตรวจแพทย์ด้วยเลขบัตรประชาชน 13 หลัก (เชื่อมต่อ HOSxP แบบ Read-Only พร้อม Rate Limiter และมาสก์ชื่อ-นามสกุล) |
| `/service/screening` | ระบบคัดกรองสุขภาพเชิงรุก รองรับเครื่องอ่านบัตรประชาชน Smart Card และแสดงคิวตรวจแบบเรียลไทม์ |
| `/news` | ศูนย์รวมข่าวสุขภาพ ประกาศจัดซื้อจัดจ้าง และรับสมัครงาน |
| `/package` | ข้อมูลคลินิกเฉพาะทางและแพ็กเกจบริการทางการแพทย์ |
| `/ita`, `/ethics` | เอกสารประเมินคุณธรรมและความโปร่งใส (ITA) และเอกสารชมรมจริยธรรม |

### 2. ระบบงานบุคลากร (`/member`)

| เส้นทาง (Route) | รายละเอียดการทำงาน |
|---|---|
| `/member/login` | เข้าสู่ระบบด้วย Email OTP หรือ ThaID OpenID Connect (ไม่ใช้ Password) |
| `/member/inbox` | กล่องงานกลาง 4 สายงาน (`MEDIA_REQUEST`, `IT_REPAIR`, `GENERAL_REPAIR`, `MEDICAL_REPAIR`) รองรับ Workflow อนุมัติ, ตรวจรับ, ลงลายมือชื่อดิจิทัล (HMAC-SHA256) และพิมพ์ใบคำขอ A4 |
| `/service/dashboard-rcm` | แดชบอร์ดการเงิน RCM: สรุปทันตกรรมประกันสังคม, ผู้ป่วยนอกรายแพทย์, แยก 10 แผนกคลินิกหลัก, และผู้ป่วยใน IPD (LOS, CMI, AdjRW) |
| `/member/equipment-borrow` | ระบบยืม-คืนครุภัณฑ์ (FSN/Gotowin) และเบิกจ่ายพัสดุคลัง (ของหมุนเวียน/สิ้นเปลือง) |
| `/member/events` | ปฏิทินกิจกรรมโรงพยาบาล, เช็คอินหน้างานด้วย Static QR ผ่าน ThaID และตารางคะแนนสะสม (Leaderboard) |
| `/salary` | ค้นหาสลิปเงินเดือนและค่าตอบแทน OT ย้อนหลังแบบเข้ารหัส |
| `/service/lab`, `/service/er-in-status` | ระบบมอนิเตอร์ผล LAB/X-Ray และสถานะห้องฉุกเฉินสด (ER Live TV Mode) |

---

## สถาปัตยกรรมระบบ

```text
[ Client: ผู้รับบริการ / บุคลากร ]
                │
                ▼
[ Next.js 16 App Router (React 19) ]
        ├── Domain Services (@/lib/*)
        ├── Storage Seam (DocumentStorage - ไม่เรียก fs ตรงใน Route)
        └── Auth Seam (MemberAuthService - JWT / ThaID OIDC)
                │ (HTTP/2 Encrypted RPC)
                ▼
[ Thoen Hospital Unified API Gateway :8443 ]
        ├── Primary Database (App CMS, Members, Tasks, Audit Logs)
        ├── HOSxP Database (Read-Only Replica: Appointments, Lab, ER)
        └── Salary Database (Read-Only Replica: Pay Slips)
```

### ข้อกำหนดทางสถาปัตยกรรม (Architectural Rules)

- **Zero Direct Database Sockets:** ตัวเว็บแอปพลิเคชันไม่มีการเปิด connection ไปยัง MySQL พอร์ต 3306 โดยตรง ข้อมูลทั้งหมดต้องส่งผ่าน Unified API Gateway (`@/lib/apiGateway`)
- **Fail-Closed Policy:** หาก Gateway ไม่พร้อมให้บริการ ระบบจะตัดการทำงานและส่งกลับ `GatewayUnavailableError` (HTTP 503) ทันที โดยไม่มีการ fallback ไปยัง socket ที่ไม่ปลอดภัย
- **Two-Tier Audit Trail:**
  - `Tier 1` (`audit_logs` ผ่าน `logAudit()`): บันทึกการเข้าถึงข้อมูลสุขภาพ (PHI), การเข้าสู่ระบบ และการแก้ไขข้อมูลสำคัญ
  - `Tier 2` (`inbox_task_audit_logs`): บันทึกประวัติสถานะ Workflow ของกล่องงาน, ลายมือชื่ออิเล็กทรอนิกส์ (HMAC) และ Field-level diffs
- **PDPA & Privacy:** มาสก์เลขบัตรประชาชน (แสดงเฉพาะหลักสุดท้าย) และชื่อผู้ป่วย ห้ามบันทึกข้อมูลผลตรวจทางการแพทย์หรือรหัสวินิจฉัยโรคลงใน plain text log โดยเด็ดขาด
- **Timezone:** ข้อมูลเวลาบันทึกและแสดงผลตามเวลาประเทศไทย (`Asia/Bangkok`, UTC+7) โดยใช้ปีพุทธศักราช (พ.ศ.) ในส่วนติดต่อผู้ใช้

---

## เทคโนโลยีหลัก

- **Core:** Next.js 16, React 19, TypeScript (Strict Mode)
- **Database & Data Access:** Prisma 6, Unified API Gateway Client
- **Authentication:** Jose (JWT), ThaID OpenID Connect, Brevo/Nodemailer (OTP)
- **Validation:** Zod
- **Testing:** Vitest, React Testing Library
- **Signatures & Imaging:** Signature Pad, Sharp, HMAC-SHA256
- **Styling:** Modular CSS

---

## วิธีติดตั้งและเริ่มพัฒนาระบบ

### ข้อกำหนดเบื้องต้น
- Node.js 20+
- บนระบบปฏิบัติการ Windows แนะนำให้รันคำสั่งผ่าน `cmd.exe /c "..."` เพื่อหลีกเลี่ยงข้อจำกัดของ PowerShell Execution Policy

### 1. โคลนคลังโค้ดและติดตั้งแพ็กเกจ

```bash
git clone https://github.com/TontunHi/thoen-hospital-website.git
cd thoen-hospital-website
cmd.exe /c "npm install"
```

### 2. กำหนดค่าสภาพแวดล้อม (.env)

คัดลอกไฟล์ตัวอย่าง:
```bash
cmd.exe /c "copy .env.example .env"
```

ตัวแปรสำคัญที่ต้องตั้งค่า:
```ini
# Gateway Connection (Zero-DB Architecture)
API_GATEWAY_URL="http://192.168.1.208:8443"
API_GATEWAY_TOKEN="your_gateway_token"

# Database Connection (สำหรับรัน Prisma Migration / Seed)
DATABASE_URL="mysql://username:password@localhost:3306/thoen_hospital"

# Security & Session
SESSION_SECRET="your_secure_random_string"

# Mailer for OTP
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT=587
SMTP_USER="your_smtp_user"
SMTP_PASS="your_smtp_password"

# ThaID Integration
THAID_CLIENT_ID="your_thaid_client_id"
THAID_CLIENT_SECRET="your_thaid_client_secret"
THAID_REDIRECT_URI="http://localhost:3000/api/auth/callback"
```

### 3. สร้าง Prisma Client

```bash
cmd.exe /c "npm run db:generate"
```

### 4. รันระบบในโหมด Development

```bash
cmd.exe /c "npm run dev"
```
เข้าใช้งานผ่านเบราว์เซอร์ที่ `http://localhost:3000`

### 5. บิลด์สำหรับ Production

```bash
cmd.exe /c "npm run build"
cmd.exe /c "npm run start"
```

---

## คำสั่งและสคริปต์ในระบบ

| คำสั่ง | คำอธิบาย |
|---|---|
| `npm run dev` | เริ่มต้นเซิร์ฟเวอร์โหมด Development (bind `0.0.0.0`) |
| `npm run build` | คอมไพล์โปรเจกต์สำหรับ Production |
| `npm run start` | รันโปรเจกต์ที่บิลด์แล้วใน Production mode |
| `npm run lint` | ตรวจสอบคุณภาพโค้ดด้วย ESLint |
| `npm test` | รันชุดทดสอบด้วย Vitest |
| `npm run test:watch` | รัน Vitest ในโหมด Watch |
| `npm run db:generate` | สร้าง Prisma Client จาก `schema.prisma` |
| `npm run maintenance:cleanup` | ล้างประวัติ Audit Log ที่หมดอายุตามนโยบาย PDPA |
| `npm run bot:repair` | รันโพลลิ่งบอท Telegram สำหรับงานแจ้งซ่อม |
| `npm run bot:ipd-chart` | บอทแจ้งเตือนชาร์ตผู้ป่วยในค้างสรุป |
| `npm run bot:appointment` | บอทตรวจสอบความไม่สอดคล้องของวันนัดหมาย |
| `npm run card:bridge` | รันสคริปต์บริดจ์สำหรับเครื่องอ่านบัตรประชาชน |

---

## การทดสอบคุณภาพ

โปรเจกต์นี้มีข้อกำหนดการตรวจสอบความถูกต้องของโค้ดอย่างเข้มงวดก่อน Commit และ Deploy:

```bash
# 1. ตรวจสอบ Lint
cmd.exe /c "npm run lint"

# 2. ตรวจสอบ Type Safety
cmd.exe /c "npx tsc --noEmit"

# 3. รัน Unit & Integration Tests (Vitest)
cmd.exe /c "npm test"

# 4. ทดสอบความสมบูรณ์ในการบิลด์
cmd.exe /c "npm run build"
```

---

## นโยบายข้อมูลและลิขสิทธิ์

- **ลิขสิทธิ์:** © 2026 โรงพยาบาลเถิน อำเภอเถิน จังหวัดลำปาง
- **การคุ้มครองข้อมูลส่วนบุคคล:** ระบบนี้ปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) ข้อมูลเวชระเบียนผู้ป่วยและสถิติการรักษาทั้งหมดถือเป็นข้อมูลความลับทางการแพทย์ ห้ามเผยแพร่หรือนำไปใช้ภายนอกระบบงานที่ได้รับอนุญาต
