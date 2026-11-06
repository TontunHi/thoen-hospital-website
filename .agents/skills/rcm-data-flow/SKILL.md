---
name: rcm-data-flow
description: Architecture and data-fetching patterns for RCM clinical dashboards, reports, and financial summaries (/service/dashboard-rcm). Read before building, editing, or refactoring data fetching, state flow, API routes, or UI components for dashboards and patient ledgers.
---

# RCM Dashboard Data Flow & Architecture

ชุดหลักการและรูปแบบมาตรฐานในการดึง ส่ง และแสดงผลข้อมูลสำหรับหน้า Dashboard RCM และรายงานคลินิกโรงพยาบาลเถิน (`/service/dashboard-rcm/...`) เพื่อให้หน้าเว็บโหลดเร็ว ปลอดภัย ป้องกัน Race Condition และไม่ทำให้ฐานข้อมูลทำงานหนักเกินไป

---

## 1. การแบ่งชั้นข้อมูล 2 ระดับ (Two-Tier Query Architecture)

**ห้ามส่งข้อมูลรายคนทั้งหมดทั้งปี (Unbounded Bulk Fetch) มาที่บราวเซอร์เด็ดขาด**

- **Tier 1: Aggregated Summary (ขนาดเล็ก ~2–5 KB)**
  - ยอดรวมผู้ป่วย, สถิติ CMI, AdjRW รวม, ยอดเงินชดเชย, และข้อมูลพล็อตของกราฟ ให้คำนวณแบบ Group By จาก SQL/Gateway มาล่วงหน้า
  - ฝั่ง Client นำมาแสดงผลบน KPI Cards และกราฟได้ทันทีโดยไม่ต้องโหลดรายชื่อผู้ป่วยทั้งหมด
- **Tier 2: Paginated Patient Ledger (50 รายการ/หน้า)**
  - ตารางรายชื่อผู้ป่วยต้องทำ Server-side Pagination เสมอ (`page`, `pageSize`, `search`, `pttype`, `ward`, `doctor`)
  - ส่งข้อมูลเฉพาะหน้าที่กำลังเปิดดูเท่านั้น
- **Export Mode**:
  - เมื่อผู้ใช้กดปุ่มดาวน์โหลด CSV หรือ Excel ให้ส่ง `exportAll=true` เพื่อดึงข้อมูลเต็มเฉพาะจังหวะที่ส่งออกไฟล์

---

## 2. ลด Waterfall ด้วย Server Component Initial Data

อย่าปล่อยให้ Client Component เมานต์แบบว่างเปล่าแล้วหมุน Skeleton รอ Client ยิง API รอบแรก:

1. ใน `page.tsx` (Server Component) ตรวจ Session และดึง Initial Data ประจำปีงบประมาณปัจจุบันส่งผ่าน Props
2. ใน `*Client.tsx` กำหนด `useState(initialData || [])`
3. ใน `useEffect` ครั้งแรก (First Mount) ให้ข้ามการยิง API ถ้ามี Initial Data อยู่แล้ว หน้าเว็บจะ **แสดงผลตัวเลขทันทีตั้งแต่ First Paint (Zero Skeleton)**
4. การยิง `fetch()` ใน Client จะทำงานเฉพาะเมื่อผู้ใช้เปลี่ยน Filter หรือเปลี่ยนวันที่

```tsx
// page.tsx (Server Component)
export default async function OpdPage() {
  const session = await verifyMemberSession()
  if (!session) redirect('/member/login')

  const defaultRange = getDefaultFiscalYearDateRange()
  const initialData = await RcmDashboardService.getOpdDepartmentSummary({
    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
  }).catch(() => [])

  return <OpdClient initialData={initialData} initialRange={defaultRange} />
}
```

---

## 3. ปีงบประมาณแบบไดนามิก (ห้าม Hardcode วันที่)

ปีงบประมาณไทยเริ่ม **1 ตุลาคม ถึง 30 กันยายน** ของปีถัดไป:

- ใช้ `getDefaultFiscalYearDateRange()` จาก `@/lib/clinical/rcmDashboardService` เป็น Single Source of Truth
- **ห้าม** เขียนสตริงวันที่แบบระบุปีตายตัว เช่น `'2024-10-01'` หรือ `'2025-09-30'` ใน `useEffect` หรือใน API Route
- ใน API Route ให้ fallback วันที่ด้วย:
  ```typescript
  const defaultRange = getDefaultFiscalYearDateRange()
  const ds1 = params.ds1 || defaultRange.startDate
  const ds2 = params.ds2 || defaultRange.endDate
  ```

---

## 4. ป้องกัน Race Condition ด้วย `AbortController`

ผู้ใช้มักจะคลิกเปลี่ยนเดือนหรือสลับฟิลเตอร์อย่างรวดเร็ว ทุกฟังก์ชันการดึงข้อมูลบน Client ต้องตัด Request เดิมทิ้ง:

```tsx
// *Client.tsx
const abortRef = useRef<AbortController | null>(null)

const fetchData = useCallback(async (start = ds1, end = ds2) => {
  // 1. ตัด Request ก่อนหน้าที่ยังค้างอยู่
  abortRef.current?.abort()
  const controller = new AbortController()
  abortRef.current = controller

  setLoading(true)
  setError(null)
  try {
    const res = await fetch(`/api/...`, { signal: controller.signal })
    const json = await res.json()
    if (json.success) setData(json.data)
  } catch (err: any) {
    if (err?.name === 'AbortError') return // ยกเลิกตามปกติ ไม่แสดง Error
    setError(err.message)
  } finally {
    if (!controller.signal.aborted) setLoading(false)
  }
}, [ds1, ds2])

useEffect(() => {
  return () => abortRef.current?.abort() // Cleanup เมื่อ unmount
}, [])
```

---

## 5. รวมศูนย์ Validation ด้วย Zod ทุก Endpoint

ทุก API Route ใน `/api/service/dashboard-rcm/...` ต้องใช้ Shared Validation จาก `@/lib/clinical/rcmValidation.ts`:

- ตรวจรูปแบบวันที่ `rcmDateRegex` (`YYYY-MM-DD`)
- ตรวจ bounds ของตัวเลข (`page >= 1`, `pageSize` 10–500)
- ใช้ `validateSearchParams(schema, searchParams)`
- หาก Validation ไม่ผ่าน ให้ return HTTP 400 พร้อมข้อความแจ้งเตือนทันที

```typescript
// route.ts
const validation = validateSearchParams(opdDeptSummaryQuerySchema, searchParams)
if (!validation.success) {
  return NextResponse.json({ success: false, error: validation.error }, { status: 400 })
}
```

---

## 6. ขจัด Mojibake & Encoding ใน SQL

ฐานข้อมูล HOSxP ใช้ Charset `tis620` แต่ไฟล์ Node.js/TypeScript เป็น `utf8`:

- **ห้าม** เขียนตัวอักษรภาษาไทยใน SQL `CASE WHEN ... THEN 'ชาย'` เพราะเสี่ยงต่อ Collation Mismatch และตัวอักษรกลายเป็นต่างดาว
- ใน SQL ให้ดึงรหัสเป็นกลาง: `IFNULL(pt.sex, '') AS sex_code`
- ใน Service Layer (TypeScript) ให้แปลงเป็นภาษาไทยด้วย `formatThaiSex()` จาก `@/lib/clinical/rcmDashboardService`:
  ```typescript
  sex: formatThaiSex(row.sex_code, row.sex) // คืนค่า 'ชาย' | 'หญิง' | 'ไม่ระบุ'
  ```

---

## 7. ความปลอดภัย & Audit Logging (PHI Compliance)

- **Zero-DB**: ห้ามต่อ MySQL ตรงจาก Next.js ให้เรียกผ่าน Centralized API Gateway เสมอ
- **Auth Double-Check**: ตรวจ Session และสิทธิ์ (`verifyMemberSession()`) ทั้งใน `page.tsx` และใน API `route.ts`
- **Audit Logging**: ทุกการเปิดอ่านข้อมูลผู้ป่วย (HN, CID, ค่ารักษา, รายรับ) ต้องเรียก `logThrottledAudit('READ', ...)` เสมอ
- **No PHI in Errors**: เมื่อเกิด Exception ภายใน ห้ามส่ง Raw SQL Error หรือข้อมูลเวชระเบียนออกไปใน JSON Client ให้ Log ผ่าน `logger.error()` และส่งข้อความภาษาไทยทั่วไปกลับไป

---

## 8. การแสดงผลข้อมูลเต็มรูปแบบ (ไม่ต้องซ่อนหรือ Mask ข้อมูล)

ระบบในกลุ่ม Dashboard RCM เป็นระบบงานภายในเฉพาะเจ้าหน้าที่โรงพยาบาล (Internal Hospital Staff & Claim Auditors) ที่ผ่านการยืนยันตัวตนแล้ว:

- **แสดงผลข้อมูลจริงได้เลย ไม่ต้องซ่อนใดๆ และไม่ต้องกลัวผิด PDPA**:
  - แสดงเลขบัตรประชาชนครบ 13 หลัก (Full Thai Citizen ID: `x-xxxx-xxxxx-xx-x`) โดย**ไม่ต้อง Mask ดอกจัน (`***`)**
  - **ไม่ต้องทำปุ่มสลับซ่อน/แสดง (Toggle Masking)** ให้รก UI
  - แสดงชื่อ-สกุลจริง, HN, AN, ที่อยู่, เบอร์โทร, สิทธิ์, และรหัสโรคเต็มรูปแบบ
- **ความจำเป็นในการปฏิบัติงาน**:
  - เจ้าหน้าที่งานประกัน, เวชระเบียน และการเงิน จำเป็นต้องใช้เลขบัตรประชาชน 13 หลักและชื่อ-สกุลในการกระทบยอด (Reconcile) กับระบบ e-Claim สปสช., โปรแกรม FoxPro, และใบตอบรับ REP หากซ่อนข้อมูลจะทำให้เจ้าหน้าที่ทำงานตรวจสอบยอดเงินชดเชยไม่ได้จริง
- **การคุ้มครองข้อมูลตามมาตรฐาน**:
  - ความปลอดภัยและการปฏิบัติตามมาตรฐาน PDPA ของระบบนี้ควบคุมผ่าน **ระบบจำกัดสิทธิ์เข้าถึง (Role-based Member Auth)** และ **การบันทึกประวัติการเรียกดู (`logThrottledAudit`)** ไว้แล้ว จึงไม่ต้องกังวลเรื่องการแสดงผลข้อมูลแก่เจ้าหน้าที่ผู้มีสิทธิ์ใช้งาน
