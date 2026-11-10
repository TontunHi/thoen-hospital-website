# STATUS

Goal: ทยอยแทนที่ Raw SQL ด้วย Named APIs สำหรับ Task Inbox, งานซ่อม, และ Peripheral Services เพื่อเตรียมปิดตาย /api/v1/app/query, /execute, /transaction และ /api/v1/salary/execute บน Gateway VM (192.168.1.208)
Updated: 2026-11-10

## Done
- **Gateway Max Param Length & Long Thai News Slug Fix (`FST_ERR_MAX_PARAM_LENGTH` 414 Fix):**
  - แก้ไขปัญหา Fastify บน Gateway VM (`192.168.1.208`) ปฏิเสธคำขอด้วย `FST_ERR_MAX_PARAM_LENGTH` (414 Bad Request) เมื่อ URL slug ข่าวสารภาษาไทยมีความยาวเกิน 100 ตัวอักษร (URI-encoded เกิน 800+ chars)
  - กำหนดค่า `maxParamLength: 5000` ใน `docs/gateway/server.js` เพื่อรองรับ URL parameter ภาษาไทยความยาวสูง
  - ปรับปรุง `docs/gateway/routes/app.js` รองรับทั้ง Path Param `:id` และ Query Param `?slug=...` พร้อม Safe URI Decoding
  - ซิงค์ไฟล์ `server.js` และ `routes/app.js` ขึ้น Gateway Host VM (`192.168.1.208`) พร้อมตรวจสอบ Syntax Pre-flight ภายใน Container ผ่าน 100%
  - รีสตาร์ต `thoen-api-gateway` และทดสอบยิงดึงข่าวจริงด้วย Slug ภาษาไทยขนาดยาว (`ประกาศผู้ชนะเสนอราคาประกวดราคา-จัดซื้อยาและเวชภัณฑ์-จำนวน-๓-รายการ...`) ได้รับข้อมูลสำเร็จพร้อมสถานะ HTTP 200
  - ปรับแต่ง `src/lib/apiGateway.ts`, `src/app/news/[slug]/page.tsx`, และ `src/app/api/news/[id]/route.ts` ให้อ่านทั้ง Unwrap Response และ `{ success, data }` ได้อย่างราบรื่น
- **Clean Deletion & UI Resilience for Test Repair Ticket (`54e1ecfc-950c-413e-8570-98d23e5a0786`):**
  - ลบใบงานทดสอบ `IT-2570-10-0005` ออกจากฐานข้อมูลจริงทุกตาราง (`inbox_tasks`, `inbox_task_steps`, `repair_details`, `inbox_task_audit_logs`) แบบ Atomic Transaction
  - ลบไฟล์แนบออกจาก MinIO Object Storage (`192.168.1.24`) และ Local Disk
  - เพิ่มคอมโพเนนต์ `RepairPhotoItem` ใน `TaskDetailClient.tsx` พร้อม `onError` Fallback UI และปรับแต่ง CSS ป้องกันภาพแตกในกรณีที่รูปภาพสูญหาย
- **Gateway Server Live Deployment Phase 3 (`routes/app.js` on `192.168.1.208` via `/ssh-thlp`):**
  - ซิงค์ไฟล์ `docs/gateway/routes/app.js` ขึ้น Gateway Host สำเร็จผ่าน SSH/SFTP (พร้อม auto-backup: `app.js.bak_20261110_125750`)
  - ทดสอบ Syntax Pre-flight ภายใน Container (`docker exec thoen-api-gateway node --check /app/routes/app.js`) ผ่าน 100%
  - รีสตาร์ตคอนเทนเนอร์ `thoen-api-gateway` สำเร็จแบบ Zero-Downtime
  - Health check ผ่าน 100%: ทั้ง 3 ฐานข้อมูล (`hosxp`, `salary`, `website`) สถานะ `UP` ค่า latency 1-5ms
  - ยิงทดสอบ Endpoint สดบนฐานข้อมูลจริงผ่าน 100%:
    - `GET /api/v1/app/slides`: คืนรายการสไลด์จริง 4 รายการ พร้อม duration และสถานะ
    - `GET /api/v1/app/locations`: คืนรายการสถานที่จริงถูกต้อง
  - ลบ Scratch deploy script ทันทีตามมาตรฐานความปลอดภัย
- **Phase 3 Peripheral Named APIs (News, Hero Slides, Hospital Locations):**
  - **Hero Slides (`/api/hero-slides`, `/api/hero-slides/[id]`):**
    - พัฒนา Gateway Named APIs ใน `docs/gateway/routes/app.js`: `GET /api/v1/app/slides` (รองรับ `all=true`, gap normalization, คืนค่า `slideDuration`), `POST /api/v1/app/slides` (auto display_order `MAX+1`), `PUT /api/v1/app/slides/:id`, `DELETE /api/v1/app/slides/:id` (re-index ลำดับที่เหลือ), `PATCH /api/v1/app/slides/duration` (บันทึก config)
    - เพิ่ม SDK methods ใน `src/lib/apiGateway.ts`: `apiGateway.app.{getSlides, createSlide, updateSlide, deleteSlide, updateSlideDuration}` และเพิ่ม method `patch` บน `ApiGatewayClient`
    - ปรับ Next.js route handlers `src/app/api/hero-slides/route.ts` และ `src/app/api/hero-slides/[id]/route.ts` ให้เป็น Pure Thin Adapters (~20-40 บรรทัด) พร้อมคงระบบ File Clean-up (`DocumentStorage.delete`) และ Audit Logging (`logAudit`)
    - สร้าง Unit Tests `heroSlidesApi.test.ts` ผ่าน 100% (6 tests)
  - **News CMS (`/api/news`, `/api/news/[id]`, `/api/news/[id]/view`, `/news`, `/news/[slug]`):**
    - พัฒนา Gateway Named APIs: `GET /api/v1/app/news` (รองรับ pagination, category, all, search และ batch attach attachments), `GET /api/v1/app/news/:id` (รองรับทั้ง numeric ID และ slug), `POST /api/v1/app/news` (สร้างข่าวพร้อม attachments ใน 1 transaction), `PUT /api/v1/app/news/:id` (อัปเดตข่าวและ attachments), `DELETE /api/v1/app/news/:id`, `POST /api/v1/app/news/:id/view` (เพิ่มยอดวิว)
    - เพิ่ม SDK methods ใน `src/lib/apiGateway.ts`: `apiGateway.app.{getNews, getNewsById, createNews, updateNews, deleteNews, incrementNewsView}`
    - ปรับ Next.js route handlers `src/app/api/news/route.ts`, `src/app/api/news/[id]/route.ts`, `src/app/api/news/[id]/view/route.ts` ให้เป็น Thin Adapters พร้อม data adaptation ตาม schema
    - แปลง Server Component pages `src/app/news/page.tsx` และ `src/app/news/[slug]/page.tsx` จาก Raw SQL `queryMemberDb` มาเรียกใช้ Gateway Named APIs 100%
    - สร้าง Unit Tests `newsApi.test.ts` ผ่าน 100% (6 tests)
  - **Hospital Locations (`/api/locations`, `/api/admin/locations`):**
    - พัฒนา Gateway Named APIs: `GET /api/v1/app/locations` (รองรับ search, buildingId, status, pagination และ `detailed=true` คืนค่า buildings, buildingFloors, stats), `POST /api/v1/app/locations`, `PUT /api/v1/app/locations/:id`, `DELETE /api/v1/app/locations/:id`
    - เพิ่ม SDK methods ใน `src/lib/apiGateway.ts`: `apiGateway.app.{getLocations, createLocation, updateLocation, deleteLocation}`
    - ปรับ `src/app/api/locations/route.ts` และ `src/app/api/admin/locations/route.ts` ให้เป็น Thin Adapters
    - ปรับ `src/app/api/departments/members/search-system/route.ts` ให้เรียก `apiGateway.app.getMembers({ search, limit })`
    - สร้าง Unit Tests `locationsApi.test.ts` ผ่าน 100% (5 tests)
  - **Verification:**
    - TypeScript `tsc --noEmit` ผ่าน 0 errors
    - Vitest unit tests ทั้งหมดผ่าน 100% (261 test files, 1,781 tests passed)
- **Salary DB Cut-off & Disable (HTTP 410 Gone สมบูรณ์ 100%):**
  - ปรับ `src/lib/salary/salaryBatchService.ts` (`ingestBatch`) ให้เรียก `apiGateway.salary.uploadBatch` แปลง `batch.rows` เป็น object format เข้า Gateway Named API สมบูรณ์ 100%
  - รัน Unit Tests Salary ผ่าน 100% (22 tests passed)
  - ปิดตาย Endpoint `POST /api/v1/salary/execute` บน Gateway ในไฟล์ `docs/gateway/routes/rawSql.js` ให้ตอบกลับด้วย HTTP 410 Gone
  - เพิ่ม `@deprecated` doc warning บน `apiGateway.salary.execute` และ `querySalaryEditDb`
  - ทำการ Deploy ขึ้น Gateway Host VM จริง (`192.168.1.208:thoen`) ผ่าน SSH/SCP พร้อม auto-backup
  - ตรวจสอบ Syntax Pre-flight ภายใน Container (`node --check /app/routes/rawSql.js`) ผ่าน 100%
  - รีสตาร์ตคอนเทนเนอร์ `thoen-api-gateway` และตรวจสอบ Health check UP (latency 1-5ms)
  - ทดสอบยิง `POST /api/v1/salary/execute` สด ได้รับผลลัพธ์ `HTTP 410 Gone` พร้อมข้อความแจ้งเตือนอย่างถูกต้อง
  - รันชุดทดสอบ Vitest ทั้งหมดในระบบผ่าน 100% (258 files, 1,764 tests passed) และ TypeScript `tsc --noEmit` ผ่าน 0 errors
- **Task Inbox & Repair Named APIs (สมบูรณ์ 100%):**
  - พัฒนา Fastify Plugin `docs/gateway/routes/tasks.js` ครบทั้ง 7 Endpoints
  - เพิ่ม SDK methods ใน `src/lib/apiGateway.ts` (`apiGateway.tasks.*` และ `apiGateway.app.*`)
  - ปรับปรุง Next.js Route Adapters
  - ตรวจสอบและผ่านการทดสอบ Vitest และ TypeScript 100% (258 files, 1,761 tests passed)

## Key files
- `docs/gateway/routes/app.js`: Gateway plugin สำหรับ Website Core, News, Slides, Locations (Deployed & Live)
- `docs/gateway/routes/rawSql.js`: ปิดตาย `/api/v1/salary/execute` (HTTP 410 Gone) (Deployed & Live)
- `docs/gateway/routes/tasks.js`: Gateway plugin สำหรับ Task Inbox & Repairs (Deployed & Live)
- `docs/gateway/routes/rcmFunds.js`: Gateway plugin สำหรับกองทุน RCM (Deployed & Live)
- `docs/gateway/server.js`: ลงทะเบียน plugins บน Gateway (Deployed & Live)
- `src/lib/apiGateway.ts`: SDK methods ครบทุกระบบ (Tasks, News, Slides, Locations, Members, RCM)
- `src/app/api/hero-slides/route.ts`: Thin adapter สำหรับดึงและสร้าง hero slides
- `src/app/api/hero-slides/[id]/route.ts`: Thin adapter สำหรับแก้ไขและลบ hero slides
- `src/app/api/news/route.ts`: Thin adapter สำหรับรายการและสร้างข่าวสาร
- `src/app/api/news/[id]/route.ts`: Thin adapter สำหรับรายละเอียด แก้ไข และลบข่าวสาร
- `src/app/api/locations/route.ts`: Thin adapter สำหรับดึงรายการสถานที่
- `src/app/api/admin/locations/route.ts`: Thin adapter สำหรับจัดการสถานที่ของ Admin

## Next
- **Peripheral Domain ถัดไป:** ย้ายส่วนที่เหลือ (ITA Blogs, RDU, Outgoing Documents) เข้า Named APIs เพื่อเตรียมปิดตาย `/api/v1/app/query`, `/execute`, `/transaction` (Phase 4)
