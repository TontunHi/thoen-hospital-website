# 9. สถาปัตยกรรมระบบแนบเอกสาร ภาพ และบันทึกข้อความสำหรับกิจกรรม (Event Attachments and Media System)

Date: 2026-10-21

## สถานะ (Status)
ยอมรับแล้ว (Accepted)

## บริบท (Context)
ระบบกิจกรรมโรงพยาบาลเถิน (`/member/events`) มีความจำเป็นต้องรวบรวมหลักฐานและข้อมูลประกอบกิจกรรมทั้งก่อนและหลังจัดงาน เช่น:
1. **ภาพบรรยากาศกิจกรรม (Event Photos):** รูปถ่ายการจัดกิจกรรม โปสเตอร์ หรือภาพหมู่บุคลากร
2. **เอกสารราชการและไฟล์แนบ (Official Documents):** ไฟล์หนังสือเชิญ กำหนดการ ใบลงนาม สรุปโครงการ หรือไฟล์นำเสนอ (`.pdf`, `.docx`, `.xlsx`, `.pptx`)
3. **บันทึกข้อความสรุปผล (Event Notes):** ข้อมูลตัวอักษร ข้อความประกาศ มติที่ประชุม หรือสรุปข้อสั่งการ

เดิมทีตาราง `hospital_events` มีเพียงคอลัมน์ `banner_url` และ `description` ซึ่งเก็บได้เพียง 1 รายการ และไม่มีระบบให้ผู้จัดงานเข้ามาแนบเอกสารประกอบเพิ่มเติมในภายหลังได้อย่างเป็นสัดส่วน

### ข้อกำหนดสำคัญ (Key Requirements):
1. **ความปลอดภัยของข้อมูลเดิม (Zero Data Loss):** ต้องสำรองข้อมูลและคงข้อมูลเดิมในตารางกิจกรรม การลงทะเบียน และการเช็คอิน ThaID ไว้ครบถ้วน 100%
2. **ไม่บังคับ Banner:** กิจกรรมไม่จำเป็นต้องมี Banner โดยระบบแสดงการ์ดเริ่มต้นโทนสีธีมโรงพยาบาลเถินอย่างเรียบร้อย
3. **แนบได้ในภายหลัง (Post-creation Attachments):** ผู้รับผิดชอบกิจกรรมสามารถเข้ามาแนบภาพ เอกสาร หรือข้อความสรุปได้ตลอดเวลาหลังจากสร้างกิจกรรมแล้ว

---

## การตัดสินใจ (Decision)

### 1. โครงสร้างฐานข้อมูลรวมศูนย์ (Unified `event_attachments` Table)
สร้างตารางใหม่ `event_attachments` ใน MySQL/MariaDB และโมเดลใน `prisma/schema.prisma` แบบ One-to-Many กับ `hospital_events`:

```prisma
model EventAttachment {
  id                 Int           @id @default(autoincrement())
  eventId            Int           @map("event_id")
  attachmentType     String        @map("attachment_type") @db.VarChar(20) // 'IMAGE' | 'DOCUMENT' | 'NOTE'
  title              String        @db.VarChar(255)
  filePath           String?       @map("file_path") @db.VarChar(1000)
  fileType           String?       @map("file_type") @db.VarChar(100)
  fileSize           BigInt?       @map("file_size")
  textContent        String?       @map("text_content") @db.Text
  uploadedByMemberId Int?          @map("uploaded_by_member_id")
  displayOrder       Int           @default(0) @map("display_order")
  createdAt          DateTime      @default(now()) @map("created_at") @db.Timestamp(0)
  updatedAt          DateTime      @default(now()) @updatedAt @map("updated_at") @db.Timestamp(0)

  event              HospitalEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  uploadedBy         Member?       @relation(fields: [uploadedByMemberId], references: [id], onDelete: SetNull)

  @@index([eventId], map: "idx_event_attachment_event")
  @@index([attachmentType], map: "idx_event_attachment_type")
  @@map("event_attachments")
}
```

### 2. มาตรฐานการจัดเก็บไฟล์ (Storage Seam)
- จัดเก็บไฟล์ผ่านโมดูลศูนย์กลาง `@/lib/storage/documentStorage.ts` (`DocumentStorage.saveBuffer`) ไปยังไดเรกทอรี `uploads/events/<eventId>/...`
- รองรับการลบไฟล์ทางกายภาพบนดิสก์ (`DocumentStorage.deleteFile`) เมื่อมีการลบ Attachment
- ข้อจำกัดขนาดไฟล์:
  - รูปภาพ (`IMAGE`): รองรับ `.jpg`, `.jpeg`, `.png`, `.webp` ขนาดสูงสุด 10MB ต่อไฟล์ รองรับการเลือกอัปโหลดแบบชุด (Batch Upload)
  - เอกสาร (`DOCUMENT`): รองรับ `.pdf`, `.docx`, `.xlsx`, `.pptx` ขนาดสูงสุด 25MB ต่อไฟล์

### 3. การควบคุมสิทธิ์ (Access Control & Permissions)
- **สิทธิ์จัดการ (Upload / Edit / Delete):** เฉพาะผู้รับผิดชอบหลัก (`headOrganizerId`), ผู้รับผิดชอบร่วม (`coOrganizers`), และผู้ดูแลระบบ (Admin) เท่านั้น
- **สิทธิ์การเข้าถึง (View / Download):** สมาชิกบุคลากรโรงพยาบาล (`Member`) ทุกคนที่ล็อกอินเข้าสู่ระบบ

### 4. ส่วนติดต่อผู้ใช้ (UI / UX)
- เพิ่มแท็บที่ 3 ในหน้ารายละเอียดกิจกรรม (`/member/events/[id]`) ชื่อ **"เอกสารและภาพกิจกรรม" (Media & Documents)**
- จำแนก 3 ส่วนการแสดงผลชัดเจน:
  1. แกลเลอรีรูปภาพ (Photo Grid) พร้อมพรีวิวแบบ Lightbox
  2. รายการเอกสารดาวน์โหลด (Document List) พร้อมไอคอนประเภทไฟล์และขนาด
  3. บันทึกและข้อความสรุป (Note Board)
- จัดแสดงปุ่ม "+ แนบไฟล์/ข้อความ" เฉพาะผู้มีสิทธิ์จัดการ

---

## ผลสืบเนื่อง (Consequences)
- **ข้อดี:** ตารางหลัก `hospital_events` สะอาด ไม่เกิด Data Redundancy, รองรับการแนบไฟล์จำนวนมากอย่างยืดหยุ่น, ลบแบบ Cascade เมื่อกิจกรรมถูกลบ
- **การรักษาความเข้ากันได้:** ฟิลด์ `banner_url` เดิมยังคงอยู่ ไม่ส่งผลกระทบต่อกิจกรรมและระบบที่เคยสร้างไว้ก่อนหน้านี้
