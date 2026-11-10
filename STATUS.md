# STATUS

Goal: ทยอยแทนที่ Raw SQL ด้วย Named APIs สำหรับ Task Inbox, งานซ่อม, และ Salary DB เพื่อเตรียมปิดตาย /api/v1/app/query, /execute, /transaction และ /api/v1/salary/execute บน Gateway VM (192.168.1.208)
Updated: 2026-11-10

## Done
- **Salary DB Cut-off:**
  - ปรับ `src/lib/salary/salaryBatchService.ts` (`ingestBatch`) ให้เรียก `apiGateway.salary.uploadBatch` แปลง `batch.rows` เป็น object format เข้า Gateway Named API สมบูรณ์ 100%
  - รัน Unit Tests Salary ผ่าน 100% (22 tests passed)
- **Task Inbox & Repair Named APIs:**
  - สร้าง Fastify Plugin ใหม่ `docs/gateway/routes/tasks.js` และลงทะเบียนใน `docs/gateway/server.js`:
    - `POST /api/v1/app/tasks/generate-no`: สร้างเลขที่ใบงานตามปีงบประมาณไทย
    - `GET /api/v1/app/tasks/:id/full-details`: ดึง Task, Steps, Repair Detail, Audit Logs ใน 1 atomic roundtrip
    - `POST /api/v1/app/tasks/workflow-action`: เปลี่ยนสถานะ workflow (APPROVE, REJECT, SEND_BACK, HOLD, RESUME, COMPLETE) พร้อมบันทึก audit log ใน 1 transaction
    - `POST /api/v1/app/tasks/repair-action`: จัดการงานซ่อมช่าง (ACCEPT_JOB, UPDATE_COWORKERS, SAVE_REPAIR_PROGRESS, COMPLETE_REPAIR, CANCEL_JOB) ใน 1 transaction
    - `PUT /api/v1/app/tasks/:id/manager-edit`: บันทึกการแก้ไขข้อมูลโดยผู้ดูแล พร้อม audit diff
  - ตรวจสอบไวยากรณ์ด้วย `node --check` ผ่าน 100%
  - เพิ่ม SDK methods ใน `src/lib/apiGateway.ts`
  - ปรับปรุง `src/lib/taskInboxService.ts` (`generateTaskNo`, `executeRepairAction`, `executeWorkflowAction`) และ `src/app/api/member/inbox/[id]/route.ts` ให้เรียกใช้ Named APIs พร้อมระบบ Graceful Fallback
  - รัน Vitest Tests ผ่าน 100% (`taskInboxService.action.test.ts` 15 tests, `repairsApi.test.ts` 8 tests, `apiRoutesVerification.test.ts` 7 tests)

## Key files
- `docs/gateway/routes/tasks.js`: Gateway plugin สำหรับ Task Inbox & Repairs
- `docs/gateway/server.js`: ลงทะเบียน tasks plugin บน Gateway
- `src/lib/apiGateway.ts`: Task Inbox Named API SDK methods
- `src/lib/taskInboxService.ts`: เชื่อมต่อ Named API ในการออกเลขที่ใบงาน, รับงานซ่อม และการอนุมัติ
- `src/app/api/member/inbox/[id]/route.ts`: เรียก `getTaskFullDetails` ดึงข้อมูลครบในคำขอเดียว
- `src/lib/salary/salaryBatchService.ts`: เชื่อมต่อ `uploadBatch`

## Next
- ใช้ `/ssh-thlp` อัปโหลดไฟล์ Gateway ที่อัปเดต (`routes/tasks.js`, `server.js`) ขึ้นเซิร์ฟเวอร์ `192.168.1.208` และทดสอบรีสตาร์ต Gateway
- เมื่อยืนยันการทำงานของระบบ Task Inbox เรียบร้อย จึงดำเนินการปิดตาย Raw SQL endpoints ใน `routes/rawSql.js` ต่อไป

## Open questions
- ขอรหัสผ่าน SSH ของผู้ใช้ `thoen` บน `192.168.1.208` เมื่อพร้อมให้เริ่มอัปโหลดไฟล์ผ่าน `/ssh-thlp`
