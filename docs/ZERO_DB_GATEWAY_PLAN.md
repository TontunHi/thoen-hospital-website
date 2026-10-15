# แผนแม่บทสถาปัตยกรรมสู่ Gateway 100% (Zero-Database Architecture Master Plan)

## 1. บทนำและเป้าหมาย (Objective)
ปรับเปลี่ยนสถาปัตยกรรมของเว็บไซต์โรงพยาบาลเถิน (`thoen-hospital-website`) สู่ระบบ **Zero-Database Architecture** โดยที่เซิร์ฟเวอร์เว็บไซต์ (Next.js) จะ**ไม่ทำการเชื่อมต่อโดยตรงกับฐานข้อมูลใดๆ ทั้งสิ้น** (ไม่มี `DATABASE_URL`, ไม่มี MySQL Connection Pool, ไม่มี Prisma DB Connection) 

ข้อมูลทั้งหมด 100% จะถูกส่งผ่าน **Thoen Hospital Unified API Gateway** ที่รันอยู่บน Proxmox VM (`192.168.1.208:8443`) ซึ่งทำหน้าที่เป็น Data & CRUD API Layer เพียงหนึ่งเดียว

---

## 2. โครงสร้างสถาปัตยกรรม (System Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        เซิร์ฟเวอร์เว็บไซต์ (Next.js)                  │
│                                                                        │
│   [ UI Components (React 19) ]                                         │
│                │                                                       │
│                ▼                                                       │
│   [ Server Actions & API Route Handlers ]                              │
│   - ตรวจสอบ Session (JWT / Cookie)                                     │
│   - ตรวจสอบสิทธิ์ผู้ใช้งาน (RBAC)                                      │
│   - จัดการการอัปโหลดไฟล์และสตรีมมิ่ง (documentStorage)                 │
│                │                                                       │
│                ▼                                                       │
│   [ @/lib/apiGateway.ts (Centralized Gateway SDK) ]                    │
│   (ไม่มี DATABASE_URL, ไม่มี MySQL Driver, ตัดการต่อ DB 100%)           │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   │ HTTPS + x-api-key (Cloudflare Tunnel / LAN)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│        Thoen Hospital Unified API Gateway (192.168.1.208:8443)         │
│                                                                        │
│   - Interactive Swagger UI (/docs) [ซ่อนตัวอย่าง API Key]              │
│   - In-Memory Caching & Rate Limiting                                  │
│   - Strict Fail-Closed (ปฏิเสธทันทีถ้า Gateway ไม่พร้อม ห้ามต่อตรง)   │
│                                                                        │
│   ┌─────────────────────┬─────────────────────┬────────────────────┐   │
│   │  HOSxP Pool (3306)  │  Salary Pool (3306) │  Prisma ORM (3306) │   │
│   │  (MySQL / tis620)   │  (MySQL / tis620)   │  (MariaDB / UTF-8) │   │
│   └──────────┬──────────┴──────────┬──────────┴──────────┬─────────┘   │
└──────────────┼─────────────────────┼─────────────────────┼─────────────┘
               ▼                     ▼                     ▼
        [ ฐาน HOSxP ]          [ ฐาน Salary ]        [ ฐานหลักของเว็บ ]
        192.168.1.4            192.168.1.4           192.168.1.7
        (เวชระเบียน/คลินิก)    (เงินเดือน/ค่าล่วงเวลา) (สมาชิก/ข่าว/งานซ่อม)
```

---

## 3. หลักการออกแบบที่สำคัญ (Key Architectural Standards)

1. **Strict Fail-Closed Policy:**
   หากตัว Gateway ขัดข้องหรือหยุดทำงาน เว็บไซต์จะ**ไม่ถอยกลับไปต่อ Database ตรงๆ เป็นอันขาด** แต่จะแสดงข้อความแจ้งเตือนที่เข้าใจง่ายแก่ผู้ใช้ และบันทึกข้อผิดพลาดลง Logger
2. **Security & Key Confidentiality:**
   * ตัวอย่าง API Key จะต้องถูกซ่อนจากหน้า Swagger UI (`/docs`) และ OpenAPI JSON
   * มีเพียงผู้ดูแลระบบที่ได้รับมอบหมายเท่านั้นที่มี Key
3. **Data Integrity & Thai Encoding:**
   * ฐาน HOSxP และ Salary ใช้ `tis620` ร่วมกับ `iconv-lite` เพื่อแปลงเป็น UTF-8 ภาษาไทยถูกต้อง 100%
   * ฐานข้อมูลหลักของเว็บใช้ Prisma ORM บน Gateway เพื่อรักษา Schema และ Constraints
4. **Tracer-Bullet Implementation:**
   * ทยอยเปลี่ยนทีละโมดูลแบบครบทุกชั้น (Vertical Slice) พร้อมรัน Unit Test ทุกขั้นตอนจนเขียว 100%

---

## 4. แผนการแบ่งตั๋วงาน (Ticket Breakdown & Dependencies)

```
[Ticket 01: Gateway SDK Client]
         │
         ├──► [Ticket 02: HOSxP & Clinical Migration]
         │              │
         ├──► [Ticket 03: Salary System Migration]
         │              │
         └──► [Ticket 04: Members & Core App Migration]
                        │
                        ▼
         [Ticket 05: Zero-DB Lockdown & Cutover]
```

* **Ticket 01:** สร้าง Centralized Gateway Client SDK (`@/lib/apiGateway.ts`) และเตรียมโครงสร้างพื้นฐานบนเว็บ
* **Ticket 02:** ขยาย Gateway สำหรับระบบ HOSxP/คลินิกทั้งหมด และปรับโค้ดฝั่งเว็บให้เรียกผ่าน Gateway 100%
* **Ticket 03:** ขยาย Gateway สำหรับระบบเงินเดือน/ค่าตอบแทนทั้งหมด และปรับโค้ดฝั่งเว็บให้เรียกผ่าน Gateway 100%
* **Ticket 04:** ขยาย Gateway ด้วย Prisma สำหรับระบบสมาชิก (CRUD Members), ข่าวสาร, งานซ่อม, ครุภัณฑ์ และปรับโค้ดฝั่งเว็บ
* **Ticket 05:** ปิดตายการเชื่อมต่อฐานข้อมูลทั้งหมด ลบ Credentials ใน `.env` และทดสอบระบบแบบ End-to-End
