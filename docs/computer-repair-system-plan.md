# แผนระบบแจ้งซ่อมคอมพิวเตอร์ภายในโรงพยาบาล

เอกสารฉบับนี้กำหนดขอบเขตระยะแรกสำหรับ **ระบบแจ้งซ่อมคอมพิวเตอร์** ภายใต้ Staff Portal เดิม และวางโครงสร้างให้เพิ่มงานซ่อมทั่วไปและซ่อมเครื่องมือแพทย์ในระยะถัดไปได้ โดยไม่ปะปนกับข้อมูลผู้ป่วย (PHI) หรือฐานข้อมูล HOSxP

## 1. วัตถุประสงค์และขอบเขต

### ระยะที่ 1: งานซ่อมคอมพิวเตอร์

ให้ผู้ใช้ที่เข้าสู่ระบบด้วยบัญชีภายในสร้างใบแจ้งซ่อมได้เอง พร้อมติดตามสถานะและรับรายละเอียดการแจ้งเตือนใน Telegram ที่ผูกกับบัญชีสมาชิก เมื่อช่างรับงานหรือปิดงานแล้ว

ข้อมูลที่ต้องเก็บในใบแจ้งซ่อม:

- ประเภทงาน: `COMPUTER` (ระบบกำหนดให้ในระยะที่ 1)
- เลขครุภัณฑ์ของอุปกรณ์ (เลือกจากรายการ หรือกรอกเมื่อหาไม่พบตามสิทธิ์/นโยบาย)
- สถานที่พบปัญหา: อาคาร, ชั้น, ห้อง
- หัวข้อ/สิ่งที่ต้องการแจ้งซ่อม
- รายละเอียดอาการ
- รหัสหรือข้อมูล AnyDesk (ไม่บังคับ)
- เบอร์โทรติดต่อ
- รูปประกอบ 0–5 รูป (ไม่บังคับ)

ผู้แจ้งเป็นได้ทุกคนที่มี session ที่ถูกต้อง (`member` และ `admin`) ไม่ใช่เฉพาะเจ้าหน้าที่ IT ส่วนผู้ปฏิบัติงานซ่อมต้องมีสิทธิ์เฉพาะ `repair.computer.manage` ซึ่ง admin เป็นผู้กำหนดให้ได้

### ระยะถัดไป

- `GENERAL`: ซ่อมทั่วไป/อาคารสถานที่
- `MEDICAL_DEVICE`: ซ่อมเครื่องมือแพทย์

ทั้งสองประเภทจะใช้แกนใบงานเดียวกัน แต่เพิ่มแบบฟอร์มเฉพาะประเภท ตารางช่าง/กลุ่มรับผิดชอบ และกฎ SLA ของตนเอง งานเครื่องมือแพทย์ต้องมีการทบทวนข้อกำหนดด้านความปลอดภัยเครื่องมือแพทย์กับหน่วยวิศวกรรมการแพทย์ก่อนเริ่มพัฒนา

## 2. ข้อสังเกตจากระบบเดิม

โปรเจกต์มี `work_requests` สำหรับ “ส่งมอบและติดตามงานช่างฯ” อยู่แล้ว แต่ตารางดังกล่าวเก็บผู้รับงาน ประวัติสถานะ และไฟล์เป็น JSON/text และหน้า/สิทธิ์การสร้างงานมุ่งที่เจ้าหน้าที่ IT จึง **ไม่ควรเพิ่มคอลัมน์หรือใช้เป็นตารางหลักของระบบแจ้งซ่อมใหม่**

ให้โมดูลใหม่อยู่ภายใต้ชื่อ `repair_*` แยกจาก `work_requests` แต่ใช้ `members`, session (`verifyMemberSession`), ตารางสิทธิ์ และ audit log ที่มีอยู่ร่วมกันได้ วิธีนี้ลดความเสี่ยงกระทบ workflow เดิมและทำให้ค้นหา/รายงาน/เก็บประวัติได้ถูกต้อง

## 3. บทบาทและสิทธิ์

| บทบาทเชิงธุรกิจ | ผู้มีสิทธิ์ | สิทธิ์หลัก |
| --- | --- | --- |
| ผู้แจ้ง (Requester) | member, admin | สร้างงาน, ดูเฉพาะงานของตน, เพิ่มข้อมูล/ยกเลิกก่อนมีผู้รับงาน, ดูผลปิดงาน |
| ช่าง IT (IT Technician) | ผู้ได้รับ permission `repair.computer.manage` | ดูคิวงานคอมพิวเตอร์, กดรับงานเป็นช่างหลักหรือช่างรอง, เริ่มงาน, เพิ่มบันทึก, อัปโหลดหลักฐาน, ปิดงาน |
| หัวหน้า IT (IT Supervisor) | `repair.computer.assign` | ดูทุกงาน, กำหนด/เปลี่ยนช่าง, ปรับความสำคัญ, เปิดงานใหม่, ดูรายงาน |
| ผู้ดูแลระบบ | admin | จัดการสิทธิ์, หมวด/สถานที่/ครุภัณฑ์, Telegram routing และตรวจสอบ audit |

ใช้ permission แบบละเอียดแทนพึ่งพา `position` อย่างเดียว เพื่อรองรับการโยกย้ายบุคลากร เช่น `repair.computer.create`, `repair.computer.view_all`, `repair.computer.manage`, `repair.computer.assign`, `repair.catalog.manage`, `repair.report.view` และ `repair.telegram.manage`.

## 4. ขั้นตอนการทำงาน

```text
ผู้แจ้งสร้างใบงาน
  → OPEN (แจ้ง Telegram กลุ่ม IT)
  → ช่างกด “รับงาน” ใน Telegram หรือเว็บ
  → ASSIGNED (แจ้งผู้แจ้งว่าใครรับงาน)
  → IN_PROGRESS (ช่างกำลังดำเนินการ)
  → CLOSED (ช่างบันทึกวิธีแก้/ผลการซ่อมและปิดงาน; แจ้งผู้แจ้ง)

ทางเลือกก่อนปิดงาน: CANCELLED
```

กฎสำคัญ:

1. การรับงานต้องเป็น atomic update: ช่างคนแรกที่กดรับเป็น `primary_technician_id`; เมื่อมีช่างหลักแล้ว ช่างที่มีสิทธิ์สามารถกดเข้าร่วมเป็นช่างรองได้เพียงหนึ่งคน (`secondary_technician_id`). ต้องป้องกันทั้งการกดซ้ำและการมีช่างหลัก/รองเป็นคนเดียวกัน
2. การเปลี่ยนสถานะทุกครั้งต้องบันทึก event แบบ immutable และตรวจสิทธิ์บน API เสมอ ไม่เชื่อค่าจากปุ่มหรือ client
3. ช่างหลักหรือหัวหน้า IT สามารถปิดงานได้เมื่อมี `resolutionNote` อย่างน้อยหนึ่งข้อความ; การปิดงานเป็นสถานะสิ้นสุด ผู้แจ้ง **ไม่มีสิทธิ์ reopen**. หากพบปัญหาใหม่ ให้สร้างใบแจ้งซ่อมใบใหม่โดยอ้างอิงเลขใบงานเดิมได้
4. ผู้แจ้งเห็น AnyDesk และไฟล์เฉพาะงานของตน; IT supervisor เห็นทุกงาน; ห้ามสร้าง URL ไฟล์ที่เปิดสาธารณะ

## 5. โครงสร้างฐานข้อมูลที่เสนอ

ฐานข้อมูลที่เหมาะสมคือ Member DB/MySQL เดิม (ผ่าน data-access layer ใหม่ เช่น `src/lib/repair/repairRepository.ts`) ไม่ใช่ Prisma primary DB ที่ปัจจุบันใช้ CMS เป็นหลัก และไม่เขียนข้อมูลลง HOSxP

### 5.1 ตารางหลัก

#### `repair_tickets`

| คอลัมน์ | ชนิด/ข้อกำหนด | ความหมาย |
| --- | --- | --- |
| `id` | BIGINT PK | รหัสภายใน |
| `ticket_no` | VARCHAR(32), UNIQUE | เช่น `ITR-20260922-0001`; สร้างจาก transaction/sequence ไม่ใช้ `COUNT(*)` |
| `repair_type` | VARCHAR(30), indexed | `COMPUTER`, รองรับ `GENERAL`, `MEDICAL_DEVICE` |
| `status` | VARCHAR(20), indexed | `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `CLOSED`, `CANCELLED` |
| `priority` | VARCHAR(20), indexed | `LOW`, `NORMAL`, `HIGH`, `CRITICAL` |
| `requester_id` | BIGINT FK → `members.id` | ผู้แจ้ง |
| `primary_technician_id` | BIGINT FK nullable → `members.id` | ช่างผู้รับผิดชอบหลัก |
| `secondary_technician_id` | BIGINT FK nullable → `members.id` | ช่างรอง; ต้องไม่ซ้ำกับช่างหลัก |
| `primary_assigned_at` / `secondary_assigned_at` | DATETIME nullable | เวลารับ/เข้าร่วมงานของช่างแต่ละคน |
| `asset_id` | BIGINT FK nullable | ครุภัณฑ์ที่เลือก |
| `asset_number_snapshot` | VARCHAR(100) nullable | เลขครุภัณฑ์ขณะสร้างใบงาน เพื่อคงประวัติ |
| `location_id` | BIGINT FK nullable | สถานที่ที่เลือก |
| `building_snapshot` / `floor_snapshot` / `room_snapshot` | VARCHAR | สถานที่ขณะเกิดเหตุ |
| `subject` | VARCHAR(255) | หัวข้อปัญหา |
| `symptom_detail` | TEXT | อาการ/รายละเอียด |
| `anydesk_reference` | VARCHAR(255) nullable | ข้อมูล AnyDesk; ไม่แสดงใน log หรือ Telegram group |
| `contact_phone` | VARCHAR(30) | เบอร์โทรติดต่อ; ไม่แสดงใน log หรือ Telegram group |
| `resolution_note` | TEXT nullable | วิธีแก้/ผลการดำเนินงาน |
| `closed_at`, `cancelled_at` | DATETIME nullable | เวลาในแต่ละจุดสิ้นสุด |
| `version` | INT NOT NULL DEFAULT 1 | optimistic locking |
| `created_at`, `updated_at` | DATETIME | เวลาสร้าง/แก้ไข |

ดัชนีขั้นต่ำ: `(repair_type, status, created_at)`, `(requester_id, created_at)`, `(primary_technician_id, status)`, `(secondary_technician_id, status)`, `(asset_id)`, `(location_id)`. ห้ามลบใบงานจริง; ใช้สถานะและ retention policy แทน

ตามนโยบายที่ยืนยัน ข้อมูลในตารางนี้ **ไม่เข้ารหัสในฐานข้อมูล**. อย่างไรก็ดี การเข้าถึงต้องยังถูกจำกัดด้วย session/RBAC, การเชื่อมต่อฐานข้อมูลใช้ TLS ตามที่ infrastructure รองรับ, ไม่บันทึกข้อมูล AnyDesk/โทรศัพท์ใน application log และต้องไม่เผยแพร่ผ่าน Telegram group

#### `repair_ticket_events`

บันทึกประวัติที่แก้ไขย้อนหลังไม่ได้: `id`, `ticket_id`, `event_type`, `from_status`, `to_status`, `actor_member_id` (nullable สำหรับ system), `note`, `metadata_json`, `created_at`, `ip_address`, `request_id`.

ตัวอย่าง `event_type`: `CREATED`, `PRIMARY_TECHNICIAN_ASSIGNED`, `SECONDARY_TECHNICIAN_ASSIGNED`, `STARTED`, `NOTE_ADDED`, `ATTACHMENT_ADDED`, `CLOSED`, `CANCELLED`, `TELEGRAM_ACTION_REJECTED`.

#### `repair_ticket_attachments`

`id`, `ticket_id`, `uploaded_by_member_id`, `attachment_stage` (`REQUEST`, `PROGRESS`, `RESOLUTION`), `storage_key`, `original_filename`, `detected_mime_type`, `byte_size`, `sha256`, `created_at`, `deleted_at`.

ไฟล์ต้องอยู่ใน private storage นอก `public/`; ใช้ชื่อที่ระบบสร้างเอง; ตรวจ magic bytes, MIME allowlist (`image/jpeg`, `image/png`, `image/webp`), ขนาดต่อไฟล์/รวมไฟล์ และสแกนมัลแวร์ก่อนเปิดให้ดู

### 5.2 ข้อมูลอ้างอิง

#### `repair_assets`

รายการครุภัณฑ์คอมพิวเตอร์: `id`, `asset_number` (UNIQUE), `asset_name`, `asset_category`, `manufacturer`, `model`, `serial_number` nullable, `default_location_id`, `is_active`, `created_at`, `updated_at`.

เลขครุภัณฑ์เป็นค่าหลักที่ค้นหาได้; serial number เป็นข้อมูลภายในจึงให้เข้าถึงเฉพาะ IT/admin ตามความจำเป็น

#### `repair_locations`

โครงสร้างสถานที่: `id`, `building_name`, `floor_name`, `room_name`, `department_name` nullable, `is_active`, `sort_order`, `created_at`, `updated_at`; มี unique key `(building_name, floor_name, room_name)`. หน้าแจ้งงานใช้ dropdown ที่ค้นหาได้ และบันทึก snapshot ลง ticket เพื่อให้ประวัติไม่เปลี่ยนเมื่อย้ายห้องภายหลัง

#### `repair_service_teams` และ `repair_team_members`

เตรียม routing ตามประเภท: ทีม `IT`, `BUILDING`, `BIOMED`; สมาชิกของทีมมี `member_id`, `is_on_duty`, `is_active`. ระยะ 1 ใช้ทีม IT แต่โครงสร้างนี้ช่วยเพิ่มอีกสองระบบได้ทันที

### 5.3 การเชื่อม Telegram และคิวส่งข้อความ

#### `member_telegram_links`

`id`, `member_id` (UNIQUE FK), `telegram_chat_id` (UNIQUE), `telegram_user_id` (UNIQUE), `telegram_username` nullable, `linked_at`, `verified_at`, `revoked_at`, `last_interaction_at`.

ไม่รับ `chat_id` ที่กรอกเองเป็นการผูกบัญชี: ต้องยืนยันด้วย one-time linking code จากหน้า Profile แล้วให้ผู้ใช้เริ่มแชต bot ด้วย `/start <code>`; code ต้อง hash, ใช้ครั้งเดียว และหมดอายุภายใน 10 นาที (`telegram_link_challenges`).

#### `repair_notification_outbox`

`id`, `ticket_id`, `recipient_kind` (`TEAM`, `MEMBER`), `recipient_reference`, `channel` (`TELEGRAM`), `template_key`, `payload_json`, `dedupe_key` UNIQUE, `status` (`PENDING`, `SENT`, `FAILED`, `RETRYING`, `DEAD_LETTER`), `attempt_count`, `next_attempt_at`, `provider_message_id`, `last_error_code`, `created_at`, `sent_at`.

สร้าง ticket/event และ outbox ใน transaction เดียวกัน แล้ว worker ส่งออกแบบ retry/backoff เพื่อไม่ให้งานหายเมื่อ Telegram ล่ม และไม่ส่งซ้ำเมื่อ API timeout

#### `telegram_callback_receipts`

`telegram_update_id` UNIQUE, `callback_id` UNIQUE, `ticket_id`, `member_id`, `action`, `received_at`, `processed_at`, `outcome`. ใช้ idempotency ป้องกัน webhook เดิมถูกส่งซ้ำ

## 6. Telegram Bot: พฤติกรรมและความปลอดภัย

เมื่อสร้างงาน ระบบส่งข้อความไปยัง Telegram group ของทีม IT โดยไม่ส่งข้อมูลอ่อนไหว: เลขใบงาน, หัวข้อ, สถานที่, ระดับความสำคัญ และลิงก์เข้าระบบเท่านั้น ไม่ส่ง AnyDesk, เบอร์โทร, ภาพ หรือรายละเอียดที่ละเอียดอ่อนเข้า group

สำหรับผู้แจ้งที่ผูก Telegram แล้ว ระบบส่งข้อความส่วนตัวไปยัง `telegram_chat_id` ของบัญชีนั้นเมื่อมีช่างหลัก/ช่างรองรับงาน หรือเมื่อปิดงาน โดยระบุเลขใบงาน สถานะ ชื่อช่าง และผลการซ่อม พร้อมลิงก์เข้าสู่รายละเอียดใบงาน. ไม่ส่ง AnyDesk หรือไฟล์แนบในข้อความแจ้งเตือน; ให้เปิดดูผ่านระบบหลังตรวจ session แทน

ปุ่ม inline ที่เสนอ:

- `รับงานหลัก`: ช่างที่ผูก Telegram คนแรกจะเป็นช่างหลัก; bot ตอบผลในข้อความเดิม และระบบแจ้งผู้แจ้งว่าใครรับงาน
- `เข้าร่วมเป็นช่างรอง`: ใช้ได้หลังมีช่างหลักและรับได้เพียงหนึ่งคน; ระบบแจ้งผู้แจ้งว่ามีช่างร่วมดำเนินการ
- `ดูรายละเอียด`: เปิด deep link ไปหน้า ticket หลัง login
- `เริ่มดำเนินการ`: ใช้ได้เฉพาะช่างผู้รับงานหรือ supervisor
- `ปิดงานบนเว็บ`: deep link ไปหน้าปิดงาน เพราะต้องกรอกสรุปและอาจอัปโหลดหลักฐาน

Telegram ID ถูกเก็บเป็นส่วนหนึ่งของข้อมูลสมาชิกใน `member_telegram_links` เพื่อเป็นปลายทางแจ้งรายละเอียดแบบรายบุคคลแก่ผู้แจ้งซ่อม และใช้ยืนยันว่าปุ่ม callback ถูกกดโดยช่างบัญชีที่ผูกไว้แล้ว. ตามนโยบายที่ยืนยัน ฟิลด์ Telegram ID ไม่เข้ารหัสในฐานข้อมูล แต่ไม่เปิดให้ user อื่นอ่านผ่าน API และไม่บันทึกใน log

Webhook endpoint เช่น `/api/integrations/telegram/webhook` ต้องตรวจ `X-Telegram-Bot-Api-Secret-Token` เทียบกับ environment secret แบบ constant-time, ตอบ HTTP 200 เฉพาะหลังบันทึก receipt, rate limit, และไม่เชื่อ `from.id` จนกว่าจะเทียบกับ `member_telegram_links` ที่ยืนยันแล้ว ค่าลับทั้งหมดเก็บใน environment:

```dotenv
TELEGRAM_REPAIR_BOT_TOKEN=redacted
TELEGRAM_REPAIR_WEBHOOK_SECRET=redacted
TELEGRAM_IT_TEAM_CHAT_ID=redacted
REPAIR_UPLOAD_MAX_BYTES=redacted
```

เพิ่มตัวแปรใน `.env.example` แบบไม่มีค่าจริง และกำหนด webhook ผ่าน HTTPS เท่านั้น

## 7. หน้าจอและ API ที่เสนอ

### หน้าเว็บ

- `/member/repairs/computer/new` — แบบฟอร์มแจ้งซ่อม: ค้นหาเลขครุภัณฑ์, dropdown สถานที่, รายละเอียด, AnyDesk, โทรศัพท์, รูป
- `/member/repairs` — รายการของผู้แจ้ง พร้อมตัวกรองสถานะและค้นหาเลขใบงาน
- `/member/repairs/[ticketNo]` — timeline, รายละเอียด, รูป, สถานะ และผลปิดงาน; ไม่มี action reopen สำหรับผู้แจ้ง
- `/member/repairs/it` — คิว IT สำหรับผู้มีสิทธิ์, filter สถานะ/ความสำคัญ/สถานที่, รับ/มอบหมาย/ปิดงาน
- `/member/repairs/catalog/assets` และ `/locations` — admin จัดการเลขครุภัณฑ์และสถานที่
- `/member/profile/telegram` — เชื่อม/ยกเลิก Telegram ของผู้ใช้
- `/member/repairs/reports` — dashboard SLA และปริมาณงาน (IT supervisor/admin)

ทุก Server Component ที่เป็น protected page เรียก `verifyMemberSession()` แล้ว `redirect('/member/login')` หากไม่ผ่าน และ API ทุก endpoint ตรวจ session + permission ซ้ำเสมอ

### API ที่สำคัญ

| Endpoint | หน้าที่ |
| --- | --- |
| `POST /api/member/repairs/computer` | สร้าง ticket + event + outbox ด้วย transaction |
| `GET /api/member/repairs` | รายการตามสิทธิ์พร้อม pagination/filter |
| `GET /api/member/repairs/[ticketNo]` | รายละเอียดแบบ field-level authorization |
| `POST /api/member/repairs/[ticketNo]/assign` | มอบหมายช่างหลัก/ช่างรอง หรือรับงาน พร้อม optimistic locking |
| `POST /api/member/repairs/[ticketNo]/status` | เริ่มงาน, ปิดงาน, cancel ตาม transition ที่อนุญาต; ไม่รองรับ reopen |
| `POST /api/member/repairs/[ticketNo]/attachments` | upload ที่ตรวจ server-side |
| `GET /api/member/repairs/assets` | autocomplete เลขครุภัณฑ์ |
| `POST /api/member/telegram/link-challenges` | สร้าง linking code แบบใช้ครั้งเดียว |
| `POST /api/integrations/telegram/webhook` | รับ Telegram update/callback พร้อมตรวจ secret |

payload ทุกตัวใช้ Zod validation; response ใช้มาตรฐาน `{ success, data?, error?: { code, message, referenceId } }`; ห้าม log AnyDesk, โทรศัพท์, filename เดิม หรือ payload Telegram ทั้งก้อน

## 8. แผนดำเนินงาน

### Phase 0 — ตัดสินใจและเตรียมข้อมูล

1. ยืนยันรายชื่อช่าง IT, ผู้รับผิดชอบ, ชั่วโมงบริการ, SLA และนิยาม `CRITICAL`.
2. เตรียม master data เลขครุภัณฑ์และสถานที่ใน CSV ที่ผ่านการตรวจซ้ำ/คัดลอกรายการซ้ำ.
3. สร้าง bot จากบัญชีองค์กร, IT group, webhook HTTPS และบัญชี/secret สำหรับ production.
4. ตกลง retention ของใบงานและไฟล์ภาพ (เช่น 3 ปี) รวมถึงผู้มีสิทธิ์เข้าดูรูปและ AnyDesk.

### Phase 1 — ฐานข้อมูลและแกนบริการ

1. เพิ่ม migration แบบ versioned สำหรับตาราง `repair_*` (ไม่เพิ่ม DDL อัตโนมัติใน request path).
2. สร้าง repository/service/schema ที่แยก UI, business rules และ database access.
3. สร้าง RBAC permission และ audit events; import assets/locations.
4. ทดสอบ transaction, ลำดับเลข ticket ภายใต้ concurrent requests, authorization และ state machine.

### Phase 2 — ผู้แจ้งและคิว IT

1. สร้างหน้าฟอร์มและ upload private storage พร้อม accessibility/WCAG 2.1 AA.
2. สร้างรายการผู้แจ้ง, ticket detail/timeline และคิว IT.
3. เพิ่มการรับงานหลัก/เข้าร่วมเป็นช่างรอง/เริ่มงาน/ปิดงาน พร้อม notification outbox.
4. ทดสอบ E2E ตั้งแต่สร้างงานจนปิดงานโดย member และ IT ที่ต่างบัญชีกัน.

### Phase 3 — Telegram

1. ทำการผูกบัญชีด้วย one-time code และ revoke.
2. ทำ worker/outbox, webhook validation, inline callback idempotency.
3. ทดสอบการแข่งขันการกดรับงานพร้อมกัน, provider timeout, retry, และกรณีช่างยังไม่ผูก Telegram.
4. เปิดใช้กับกลุ่ม IT ขนาดเล็กก่อน แล้วติดตาม audit/error metric.

### Phase 4 — รายงานและขยายประเภทงาน

1. รายงานจำนวนงาน, เวลารับงาน, เวลาปิดงาน, งานค้าง, SLA breach และ workload ต่อช่าง.
2. เพิ่ม `GENERAL` โดยใช้ ticket engine เดิมและ form/routing ของช่างอาคาร.
3. หลังการอนุมัติร่วมกับหน่วยที่รับผิดชอบ เพิ่ม `MEDICAL_DEVICE` พร้อมฟิลด์เฉพาะและขั้นตอนตรวจรับที่เหมาะสม.

## 9. เกณฑ์รับมอบระยะที่ 1

- member/admin สร้างงานซ่อมคอมพิวเตอร์ได้ และเห็นเฉพาะงานของตนเอง
- เลขครุภัณฑ์/สถานที่เลือกจาก dropdown ได้; ระบบเก็บ snapshot ที่ถูกต้อง
- IT ที่มีสิทธิ์รับงานหลักและช่างรองได้อย่างละหนึ่งคนแบบ race-safe และผู้แจ้งได้รับ Telegram หลังมีการรับ/เข้าร่วมงาน
- ช่างหลักหรือหัวหน้า IT ปิดงานพร้อมสรุปผลได้; ใบงานที่ปิดแล้วไม่มี reopen และผู้แจ้งได้รับรายละเอียดผ่าน Telegram
- ไฟล์ภาพไม่เปิด public, ผ่านการตรวจชนิด/ขนาด, และเข้าถึงด้วย authorization
- มี audit trail สำหรับสร้าง/อ่าน/เปลี่ยนสถานะ/ดาวน์โหลดไฟล์ และไม่มีข้อมูลอ่อนไหวใน log หรือ Telegram group
- ผ่าน unit test, integration test, E2E critical flow, lint, type-check และ security review ก่อนเปิดใช้จริง

## 10. เรื่องที่ต้องยืนยันก่อนเริ่มพัฒนา

1. ใครเป็นช่าง IT และใครเป็นหัวหน้าที่มอบหมายงานได้ (รายชื่อบัญชีหรือ permission)?
2. จะใช้ Telegram group เดียวหรือแยกตามเวลาราชการ/เวร และการกดรับงานถือเป็นการมอบหมายถาวรหรือมีการย้ายช่างได้?
3. เลขครุภัณฑ์ต้นทางมาจากระบบใด, มีเจ้าของข้อมูลใด, และอนุญาตให้ผู้แจ้งกรอกเลขที่ไม่มีใน master ได้หรือไม่?
4. นโยบายจัดเก็บภาพ, AnyDesk และเบอร์โทรนานเท่าใด และใครบ้างที่มีสิทธิ์เข้าดู?
5. ความหมายของงานด่วน/วิกฤตและ SLA ที่ต้องแจ้งเตือนซ้ำคืออะไร?
