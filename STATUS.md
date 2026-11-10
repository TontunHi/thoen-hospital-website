# STATUS

Goal: ทยอยแทนที่ Raw SQL ด้วย Named APIs สำหรับ Task Inbox, งานซ่อม, และ Peripheral Services เพื่อเตรียมปิดตาย /api/v1/app/query, /execute, /transaction และ /api/v1/salary/execute บน Gateway VM (192.168.1.208)
Updated: 2026-11-10

## Done
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
- **RCM Cancer Fund ADP Filter (`/service/dashboard-rcm/funds/cancer/adp`):**
  - เพิ่ม Dropdown Filter สำหรับ "สถานะ e-Claim / REP" ในแถบควบคุม: ทั้งหมด, มีเลข REP แล้ว (`HAS_REP`), ไม่มีเลข REP (`NO_REP`), และตัวเลือกสถานะ e-Claim จากข้อมูลจริง (`statusOptions`)
  - รองรับ Active Filter Badge สำหรับสถานะ e-Claim / REP เหนือตาราง พร้อมปุ่มล้างตัวกรอง
  - เพิ่ม `statusFilter` ลงใน Zod validation schema (`cancerFundAdpQuerySchema`), Domain Service (`rcmCancerFundService.ts`), และ API route adapter
  - รองรับการ Export Excel และค้นหาแบบ Global search ด้วยสถานะ e-Claim
  - ทดสอบความถูกต้องด้วย Vitest ผ่าน 100% (35 tests) และ TypeScript `tsc --noEmit` ผ่าน 0 errors
- **UX/UI Refactor Sprint 1 & Anti-Slop (UxUi-Refactor-Plan.md):**
  - `kpi-tracker.css`: ลบ Google Fonts `@import` และแปลง local `:root` ทั้งหมดเข้า mapping Design Tokens จาก `globals.css`
  - `screening/page.css`: ปลด Gradient Header card และสีตัวอักษรทอง/เหลืองเป็น `var(--bg-surface)` + `var(--gray-900)`, เปลี่ยนฟอนต์เป็น `var(--font-family)` (Sarabun)
  - `service/page.css`: ปลด `IBM Plex Sans Thai` และ hardcoded colors เป็น `var(--font-family)` และ `var(--gray-900)`, ลบ `translateY(-2px)` และ `hover:scale(1.05)` ปรับเป็น Quiet Chrome
  - `lab/page.css` & `LabSearchClient.tsx`: ลบพื้นหลัง Gradient เป็น `var(--bg-main)`, ปลด Eyebrow Pill Badge (`lab-search-badge`), ปรับหัวข้อ Off-Black และตัด letter-spacing ลบออก
  - `check-date/page.css`: ปลด `border-left: 4px solid` หนา เปลี่ยนเป็น border ล้อมกรอบมาตรฐาน, ปลด `pulseAnimation` บนสถานะคงที่, ปรับ `translateY` hover ออก
  - `page.css` (หน้าหลัก): ปลดการ์ดดิ้น `translateY(-1px/-2px)` และ `scale(1.05)` บน hover ทั้งหมด, ลด visual noise กล่องไอคอน Quiet Chrome
  - `ward-status/page.css`: ปลด `transition: all`, แปลงสี slate เป็น off-black `var(--gray-900)`, ตัด `translateY(-2px)` บน Stat Cards
  - ตรวจสอบความถูกต้อง: `vitest` ผ่าน 100% (258 files, 1,761 tests passed), TypeScript `tsc --noEmit` ผ่าน 0 errors
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
  - พัฒนา Fastify Plugin `docs/gateway/routes/tasks.js` ครบทั้ง 7 Endpoints:
    - `POST /api/v1/app/tasks/generate-no`: สร้างเลขที่ใบงานตามปีงบประมาณไทย
    - `GET /api/v1/app/tasks/:id/full-details`: ดึง Task, Steps, Repair Detail, Audit Logs ใน 1 atomic roundtrip
    - `POST /api/v1/app/tasks/workflow-action`: เปลี่ยนสถานะ workflow (APPROVE, REJECT, SEND_BACK, HOLD, RESUME, COMPLETE) พร้อมบันทึก audit log ใน 1 transaction
    - `POST /api/v1/app/tasks/repair-action`: จัดการงานซ่อมช่าง (ACCEPT_JOB, UPDATE_COWORKERS, SAVE_REPAIR_PROGRESS, COMPLETE_REPAIR, CANCEL_JOB) ใน 1 transaction
    - `PUT /api/v1/app/tasks/:id/manager-edit`: บันทึกการแก้ไขข้อมูลโดยผู้ดูแล พร้อม audit diff
    - `GET /api/v1/app/tasks/inbox`: ดึงรายการงานตามแท็บ, สิทธิ์, แผนก, สถานะ พร้อม badge counts และ stats ใน 1 request
    - `POST /api/v1/app/tasks/create`: สร้างใบงานใหม่พร้อม Steps, Repair Detail และ Audit Log ใน 1 atomic transaction
  - เพิ่ม SDK methods ใน `src/lib/apiGateway.ts` (`apiGateway.tasks.*` และ `apiGateway.app.*`)
  - ปรับปรุง Next.js Route Adapters:
    - `src/app/api/member/inbox/route.ts` (GET & POST)
    - `src/app/api/member/inbox/[id]/route.ts` (GET & PATCH)
    - `src/app/api/member/repairs/route.ts` (POST)
    - `src/lib/taskInboxService.ts`
  - ตรวจสอบและผ่านการทดสอบ Vitest และ TypeScript 100% (258 files, 1,761 tests passed)
- **Gateway Server Live Deployment (`192.168.1.208` via `/ssh-thlp`):**
  - ซิงค์ไฟล์ `routes/tasks.js`, `routes/rcmFunds.js` และ `server.js` ขึ้น Gateway Host สำเร็จผ่าน SSH/SFTP (พร้อม auto-backup)
  - ทดสอบ Syntax Pre-flight ภายใน Container (`docker exec thoen-api-gateway node --check /app/routes/tasks.js`) ผ่าน 100%
  - รีสตาร์ตคอนเทนเนอร์ `thoen-api-gateway` สำเร็จแบบ Zero-Downtime
  - Health check ผ่าน 100%: ทั้ง 3 ฐานข้อมูล (hosxp, salary, website) สถานะ `UP` ค่า latency 1-4ms
  - ยิงทดสอบ Endpoint สดบนฐานข้อมูลจริงผ่าน 100%:
    - `POST /api/v1/app/tasks/generate-no` -> ได้รับ `IT-2570-10-0004`
    - `GET /api/v1/app/tasks/:id/full-details` -> ดึงใบงานซ่อมจริงพร้อมประวัติ 3 steps
    - `GET /api/v1/app/tasks/inbox` -> ดึงรายการใบงานจริง 22 งาน พร้อมสถิติ pending/approved ถูกต้องแม่นยำ
    - `POST /api/v1/app/tasks/create` -> สร้างใบงานทดสอบพร้อม Steps, Repair Detail, Audit Log ใน 1 Transaction สำเร็จ 100%

## Key files
- `docs/gateway/routes/app.js`: Gateway plugin สำหรับ Website Core, News, Slides, Locations (Named APIs)
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
- **Deploy Gateway `routes/app.js` update to VM (`192.168.1.208`):** อัปโหลด `routes/app.js` ขึ้น Gateway Host ผ่าน `/ssh-thlp`
- **Peripheral Domain ถัดไป:** ย้ายส่วนที่เหลือ (ITA Blogs, RDU, Outgoing Documents) เข้า Named APIs เพื่อเตรียมปิดตาย `/api/v1/app/query`, `/execute`, `/transaction` (Phase 4)
