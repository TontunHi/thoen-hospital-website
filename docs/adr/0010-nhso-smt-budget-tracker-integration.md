# 10. สถาปัตยกรรมระบบติดตามงบประมาณ สปสช. SMT (NHSO SMT Budget Tracker Integration)

Date: 2026-10-21

## สถานะ (Status)
ยอมรับแล้ว (Accepted)

## บริบท (Context)
โรงพยาบาลเถินต้องการขยายขีดความสามารถของศูนย์กลาง **"ติดตามงบประมาณประจำปี"** (`/service/budget-tracker`) โดยนำระบบดึงและวิเคราะห์ข้อมูลงบประมาณจากระบบ **Smart Monitoring & Tracking (SMT)** ของสำนักงานหลักประกันสุขภาพแห่งชาติ (สปสช.) จากโปรเจกต์ต้นแบบ `SMT-dashboard` มาติดตั้งและผสานการทำงานเข้ากับเว็บหลักของโรงพยาบาล

## การตัดสินใจ (Decision)

### 1. โครงสร้างเส้นทางและแถบนำทาง (Sub-route & Navigation)
- **URL เส้นทาง:** `/service/budget-tracker/smt`
- **ตำแหน่งบนแถบนำทาง:** จัดวางเป็น **แท็บที่ 2** บน `BudgetTrackerNav`:
  - แท็บ 1: `ผลงานชดเชย เขต 1 (MIS HOS เขต 1)` (`/service/budget-tracker/rh1`)
  - แท็บ 2: `ติดตามงบ สปสช. (SMT Dashboard)` (`/service/budget-tracker/smt`)
  - แท็บ 3: `แหล่งงบประมาณอื่น (Planfin / งบลงทุน)` (`/service/budget-tracker/planfin`)

### 2. สถาปัตยกรรมเชื่อมโยงข้อมูล (Native Next.js API Proxy Seam)
- ไม่ใช้ Python FastAPI แยกภายนอก เพื่อลดภาระการดูแลระบบและไม่สร้าง Single Point of Failure เพิ่ม
- สร้าง **Domain Service** `@/lib/budget/smtBudgetService.ts` (`SmtBudgetService`) รับผิดชอบ:
  - ยิง Upstream SMT API (`https://smt.nhso.go.th/smtf/api/budgetreport/budgetSummaryByVendorReport/search`)
  - จัดการข้ามการตรวจสอบใบรับรอง SSL สำหรับเซิร์ฟเวอร์รัฐ (`rejectUnauthorized: false`)
  - ระบบ In-Memory Cache (TTL 10 นาที) เพื่อลดภาระและป้องกัน Rate Limit จาก สปสช.
  - ประมวลผล Aggregation สรุป KPI (วงเงินจัดสรร, ยอดโอนสุทธิ, ยอดรอดำเนินการ, ยอดหักหนี้/ภาษี/พันธบัตร)
- สร้าง **API Route Adapter** `src/app/api/budget/smt/route.ts` เป็น Thin HTTP Adapter ตรวจสอบสิทธิ์ด้วย `verifyMemberSession()` และบันทึก `logAudit()`

### 3. ขอบเขตหน่วยบริการ (Vendor & Network Scope)
- ปักหมุดที่ **โรงพยาบาลเถิน (รหัส 11152)** เป็นค่าเริ่มต้นเสมอ
- มีปุ่มทางลัดเลือกหน่วยบริการในเครือข่าย CUP อำเภอเถิน (รพ.สต.) และเปิดช่องให้พิมพ์ค้นหารหัสหน่วยบริการ 5 หลักอื่นๆ ได้

### 4. แผนภูมิและการแสดงผล (Visualization & Charts)
- ใช้ไลบรารี `recharts` ที่ติดตั้งอยู่ในโปรเจกต์อยู่แล้ว (`^3.10.1`) ในการพล็อต:
  - **Disbursement Trend Chart:** กราฟแท่งและเส้นเปรียบเทียบยอดจัดสรรกับยอดโอนสุทธิตามรอบเดือน (MM/YYYY)
  - **Fund Group Breakdown:** แผนภูมิวงแหวนสัดส่วนงบประมาณตามกลุ่มกองทุน
- ตารางรายการธุรกรรม (Batch, วันที่โอน, เลขที่เอกสาร, กองทุน, ยอดเงิน) พร้อมลิงก์ดาวน์โหลด Statement (PAYM) และส่งออก Excel ผ่าน `exceljs`

### 5. ความปลอดภัยและการบันทึกประวัติ (Defensive Auth & Audit)
- บังคับ Server-side Authentication ผ่าน `verifyMemberSession()` ภายใต้ Layout ของ `/service/budget-tracker`
- บันทึกการเข้าถึงข้อมูลการเงินลงใน `audit_logs` ผ่าน `@/lib/audit.ts` (`logAudit()`)

## ผลสืบเนื่อง (Consequences)
- **สถาปัตยกรรมเอกภาพ:** ระบบรันเป็นโมโนลิธเดี่ยวบน Next.js ไม่มีภาระในการรัน daemon เสริม
- **ความเร็วและประสิทธิภาพ:** ผลการคิวรีถูกแคชไว้ 10 นาที ทำให้การสลับฟิลเตอร์และการเปิดดูซ้ำทำได้ทันที
- **ความมั่นคงปลอดภัย:** ข้อมูลทางการเงิน สปสช. ถูกจำกัดให้เฉพาะบุคลากรโรงพยาบาลที่ล็อกอินแล้วเท่านั้น
