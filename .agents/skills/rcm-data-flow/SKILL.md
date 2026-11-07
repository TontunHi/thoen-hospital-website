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
  - สำหรับไฟล์ CSV ต้องใส่ UTF-8 BOM (`\uFEFF`) นำหน้าเสมอ เพื่อให้เปิดใน Microsoft Excel บน Windows ภาษาไทยได้ถูกต้องโดยไม่เป็นต่างดาว

---

## 2. ลด Waterfall ด้วย Server Component Initial Data

อย่าปล่อยให้ Client Component เมานต์แบบว่างเปล่าแล้วหมุน Skeleton รอ Client ยิง API รอบแรก:

1. ใน `page.tsx` (Server Component) ตรวจ Session และดึง Initial Data ประจำปีงบประมาณปัจจุบันส่งผ่าน Props (หรือให้ Client ดึงด้วย default fiscal range ทันที)
2. ใน `*Client.tsx` กำหนด `useState(initialData || [])`
3. ใน `useEffect` ครั้งแรก (First Mount) ให้ข้ามการยิง API ถ้ามี Initial Data อยู่แล้ว หน้าเว็บจะ **แสดงผลตัวเลขทันทีตั้งแต่ First Paint (Zero Skeleton)**
4. การยิง `fetch()` ใน Client จะทำงานเฉพาะเมื่อผู้ใช้เปลี่ยน Filter หรือเปลี่ยนวันที่

---

## 3. ปีงบประมาณแบบไดนามิกและการจัดเรียงตัวเลือกช่วงเวลา

ปีงบประมาณไทยเริ่ม **1 ตุลาคม ถึง 30 กันยายน** ของปีถัดไป:

- ใช้ `getDefaultFiscalYearDateRange()` จาก `@/lib/clinical/rcmDashboardService` เป็น Single Source of Truth
- **ห้าม** เขียนสตริงวันที่แบบระบุปีตายตัว เช่น `'2024-10-01'` หรือ `'2025-09-30'` ใน `useEffect` หรือใน API Route
- ใน API Route ให้ fallback วันที่ด้วย:
  ```typescript
  const defaultRange = getDefaultFiscalYearDateRange()
  const ds1 = params.ds1 || defaultRange.startDate
  const ds2 = params.ds2 || defaultRange.endDate
  ```
- **ลำดับมาตรฐานของแท็บช่วงเวลา (Date Selector Tab Order):**
  เรียงแท็บตามลำดับนี้เสมอ: **1. กำหนดเอง (Custom)** &rarr; **2. เดือน (Monthly)** &rarr; **3. ปีงบประมาณ (Fiscal Year)**

---

## 4. ป้องกัน Race Condition ด้วย `AbortController`

ผู้ใช้มักจะคลิกเปลี่ยนเดือนหรือสลับฟิลเตอร์อย่างรวดเร็ว ทุกฟังก์ชันการดึงข้อมูลบน Client ต้องตัด Request เดิมทิ้ง:

```tsx
// *Client.tsx
const abortRef = useRef<AbortController | null>(null)

const fetchData = useCallback(async (refresh = false) => {
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
}, [ds1, ds2, cardFilter, search, sortBy, sortOrder, currentPage, pageSize])

useEffect(() => {
  return () => abortRef.current?.abort() // Cleanup เมื่อ unmount
}, [])
```

---

## 5. รวมศูนย์ Validation ด้วย Zod ทุก Endpoint

ทุก API Route ใน `/api/service/dashboard-rcm/...` ต้องใช้ Shared Validation จาก `@/lib/clinical/rcmValidation.ts`:

- ตรวจรูปแบบวันที่ `rcmDateRegex` (`YYYY-MM-DD`)
- ตรวจ bounds ของตัวเลข (`page >= 1`, `pageSize` 10–500)
- ตรวจ enum สำหรับ `cardFilter`, `searchField`, `sortBy`, `sortOrder`
- หาก Validation ไม่ผ่าน ให้ return HTTP 400 พร้อมข้อความแจ้งเตือนทันที

---

## 6. ข้อควรระวังในการแปลงคำสั่ง FoxPro เป็น MySQL Gateway (FoxPro Migration Rules)

ระบบเดิมของโรงพยาบาลรันด้วย Visual FoxPro ซึ่งมีฟังก์ชันเฉพาะตัวและตารางชั่วคราว เมื่อแปลงมาเป็น SQL บน MySQL/MariaDB API Gateway ต้องปฏิบัติตามกฎดังนี้:

1. **Authen Code ฟิลด์จริงคือ `cc.AuthenCode`:**
   - ในสคริปต์ FoxPro จะเขียน `cc.claimcode authencode` เพราะสร้างตารางชั่วคราวชื่อ `tmpClaimCode`
   - แต่ในฐานข้อมูลจริง ตารางคือ `rcmdb.authencode` และฟิลด์คือ **`cc.AuthenCode`**
   - **ห้าม** ใช้ `cc.claimcode` เพราะจะเกิดข้อผิดพลาด `Unknown column 'cc.claimcode' in 'field list'` ทันที
2. **การแปลงฟังก์ชัน Lookup และคำนวณอายุ:**
   - `thaiage(pt.birthday, o.vstdate)` &rarr; `IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate))`
   - `seeknames(pt.nationality, 'nation')` &rarr; `LEFT JOIN nationality nat ON nat.nationality = pt.nationality` แล้วใช้ `IFNULL(nat.name, pt.nationality)`
   - `seeknames(o.pttype, 'pttype')` &rarr; `LEFT JOIN pttype ptt ON ptt.pttype = o.pttype`
   - `seekname(o.main_dep, 'kskdepartment')` &rarr; `LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep`
   - `seekname(o.spclty, 'spclty')` &rarr; `LEFT JOIN spclty spc ON spc.spclty = o.spclty`
3. **การแปลงตารางสถานะการชดเชย (NHSO, REP, eClaim):**
   - แปลงคำสั่ง `call createtempnhso(...)` / `call createtemprep(...)` / `call createtempeclaim(...)` เป็น Subquery JOIN:
     - `rcmdb.repeclaim` (สถานะ 'NHSO :: มี Invoice แล้ว')
     - `rcmdb.repdata` (สถานะ 'Rep :: มี Rep แล้ว' พร้อมดึง `fund`, `subfund`)
     - `rcmdb.neweclaim nn ON nn.Seq = o.vn`
     - `eclaimdb.m_registerdata m` พร้อม join `rcmdb.eclaimstatus ecs`
   - รวมค่าชดเชยและสถานะด้วย:
     `COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname)`
     `COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep)`
     `COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0)`
4. **Timeout สำหรับรายงานกองทุน (90 วินาที):**
   - การ Query ที่มีการ Join ข้อมูล `opitemrece` ข้ามช่วงเวลาหลายเดือนพร้อมตารางตอบรับ ต้องส่งออปชัน `{ timeoutMs: 90000 }` (90 วินาที) เสมอ เพื่อป้องกัน Gateway ตัดการเชื่อมต่อก่อนดึงข้อมูลเสร็จ
5. **การตรวจสอบการ Map รหัส ADP (NHSO ADP Pre-Check):**
   - ก่อนแสดงผลรายงานกองทุน ให้ตรวจตาราง `s_drugitems` เสมอ:
     `SELECT icode, name, strength, nhso_adp_code FROM s_drugitems WHERE TRIM(nhso_adp_code) IN (...)`
   - ฟังก์ชันตรวจสอบต้องรับพารามิเตอร์ `refresh?: boolean` เพื่อให้สามารถ Invalidate Cache ได้เมื่อกดรีเฟรช
   - หากพบว่า `isMapped === false` ให้แสดง Warning Banner แจ้งเตือนเจ้าหน้าที่อย่างชัดเจนในหน้าเว็บ

---

## 7. ขจัด Mojibake & Encoding ใน SQL

ฐานข้อมูล HOSxP ใช้ Charset `tis620` แต่ไฟล์ Node.js/TypeScript เป็น `utf8`:

- **ห้าม** เขียนตัวอักษรภาษาไทยใน SQL `CASE WHEN ... THEN 'ชาย'` เพราะเสี่ยงต่อ Collation Mismatch และตัวอักษรกลายเป็นต่างดาว
- ใน SQL ให้ดึงรหัสเป็นกลาง: `IFNULL(pt.sex, '') AS sex_code`
- ใน Service Layer (TypeScript) ให้แปลงเป็นภาษาไทยด้วย `formatThaiSex()` จาก `@/lib/clinical/rcmDashboardService`:
  ```typescript
  sex: formatThaiSex(row.sex_code, row.sex) // คืนค่า 'ชาย' | 'หญิง' | 'ไม่ระบุ'
  ```

---

## 8. การกรองข้อมูลผ่าน KPI Summary Cards (Card Filtering)

หน้าจอรายงานกองทุนต้องออกแบบให้ผู้ใช้สามารถคลิกที่การ์ดสรุปยอดเพื่อกรองตารางได้ทันที:

- **การ์ดมาตรฐานที่ต้องมี:**
  1. ผู้รับบริการทั้งหมด (`ALL`)
  2. ชดเชยแล้ว (`COMPENSATED`)
  3. ยังไม่ชดเชย / รอชดเชย (`UNCOMPENSATED`)
  4. มี Authen Code (`WITH_AUTHEN`)
  5. ไม่มี Authen Code (`NO_AUTHEN`)
  6. สิทธิบัตรทอง (`UC_ONLY`)
- **พฤติกรรม UI:**
  - การ์ดที่ถูกเลือกต้องมี Active Ring และตัวบอกสถานะ (Indicator line/color) อย่างชัดเจน
  - เมื่อคลิกการ์ด ให้รีเซ็ตหน้าตารางกลับไปที่หน้าที่ 1 (`setCurrentPage(1)`) และส่ง `cardFilter` ไปยัง API หรือกรองใน Client

---

## 9. ความปลอดภัย & Audit Logging (PHI Compliance)

- **Zero-DB**: ห้ามต่อ MySQL ตรงจาก Next.js ให้เรียกผ่าน Centralized API Gateway เสมอ
- **Auth Double-Check**: ตรวจ Session และสิทธิ์ (`verifyMemberSession()`) ทั้งใน `page.tsx` และใน API `route.ts`
- **Audit Logging**: ทุกการเปิดอ่านข้อมูลผู้ป่วย (HN, CID, ค่ารักษา, รายรับ) ต้องเรียก `logThrottledAudit('READ', ...)` เสมอ
- **No PHI in Errors**: เมื่อเกิด Exception ภายใน ห้ามส่ง Raw SQL Error หรือข้อมูลเวชระเบียนออกไปใน JSON Client ให้ Log ผ่าน `logger.error()` และส่งข้อความภาษาไทยทั่วไปกลับไป

---

## 10. การแสดงผลข้อมูลเต็มรูปแบบ (ไม่ต้องซ่อนหรือ Mask ข้อมูล)

ระบบในกลุ่ม Dashboard RCM เป็นระบบงานภายในเฉพาะเจ้าหน้าที่โรงพยาบาล (Internal Hospital Staff & Claim Auditors) ที่ผ่านการยืนยันตัวตนแล้ว:

- **แสดงผลข้อมูลจริงได้เลย ไม่ต้องซ่อนใดๆ และไม่ต้องกลัวผิด PDPA**:
  - แสดงเลขบัตรประชาชนครบ 13 หลัก (Full Thai Citizen ID: `x-xxxx-xxxxx-xx-x`) โดย**ไม่ต้อง Mask ดอกจัน (`***`)**
  - **ไม่ต้องทำปุ่มสลับซ่อน/แสดง (Toggle Masking)** ให้รก UI
  - แสดงชื่อ-สกุลจริง, HN, AN, ที่อยู่, เบอร์โทร, สิทธิ์, และรหัสโรคเต็มรูปแบบ
- **ความจำเป็นในการปฏิบัติงาน**:
  - เจ้าหน้าที่งานประกัน, เวชระเบียน และการเงิน จำเป็นต้องใช้เลขบัตรประชาชน 13 หลักและชื่อ-สกุลในการกระทบยอด (Reconcile) กับระบบ e-Claim สปสช., โปรแกรม FoxPro, และใบตอบรับ REP หากซ่อนข้อมูลจะทำให้เจ้าหน้าที่ทำงานตรวจสอบยอดเงินชดเชยไม่ได้จริง
- **การคุ้มครองข้อมูลตามมาตรฐาน**:
  - ความปลอดภัยและการปฏิบัติตามมาตรฐาน PDPA ของระบบนี้ควบคุมผ่าน **ระบบจำกัดสิทธิ์เข้าถึง (Role-based Member Auth)** และ **การบันทึกประวัติการเรียกดู (`logThrottledAudit`)** ไว้แล้ว จึงไม่ต้องกังวลเรื่องการแสดงผลข้อมูลแก่เจ้าหน้าที่ผู้มีสิทธิ์ใช้งาน

---

## 11. การปรับปรุงประสิทธิภาพ Query ตารางขนาดใหญ่ (`opitemrece`) ด้วย Driving Subquery Pattern

ตาราง `opitemrece` เป็นตารางบันทึกการใช้ยาและค่าบริการทางการแพทย์ที่มีขนาดใหญ่ที่สุดในระบบ HOSxP (หลักหลายล้านเรคคอร์ดต่อปีงบประมาณ) การเขียนคำสั่งดึงข้อมูลต้องปฏิบัติตามกฎประสิทธิภาพอย่างเคร่งครัด:

1. **ห้ามใช้เงื่อนไข `OR` ข้ามตารางที่ `LEFT JOIN` เข้ามากับ `opitemrece` เด็ดขาด:**
   - **ปัญหาคิวรีช้า (ระดับ 60–90 วินาที หรือ Gateway Timeout):**
     ```sql
     -- ❌ ห้ามเขียนแบบนี้เด็ดขาด:
     FROM opitemrece oo
     LEFT JOIN drugitems d ON d.icode = oo.icode
     LEFT JOIN s_drugitems dd_sub ON dd_sub.icode = oo.icode
     WHERE oo.vstdate BETWEEN ? AND ?
       AND (
         d.did IN (...)
         OR TRIM(dd_sub.nhso_adp_code) = ?
       )
     ```
     เพราะ MySQL **ไม่สามารถนำ Index ของ `opitemrece` มาใช้กรองได้เลย** เนื่องจากเงื่อนไข `OR` ขึ้นกับ 2 ตารางที่แตกต่างกัน ส่งผลให้ฐานข้อมูลต้องทำ Full-Table Scan ทุกแถวใน `opitemrece` ตลอดทั้งปี (หลายล้านแถว) แล้วนำมาไล่เทียบ B-Tree Lookup เข้าแค็ตตาล็อกทีละเรคคอร์ด
2. **แก้ด้วย Driving Subquery Pattern (ความเร็วลดลงเหลือ < 0.1 วินาที):**
   - รวมรหัสยาและค่าบริการที่ต้องการ (`icode`) จากตารางแค็ตตาล็อก (`drugitems` + `s_drugitems`) ผ่าน `UNION ALL` ใน Subquery ชื่อ `target_items` มาล่วงหน้า
   - จากนั้นใช้ `JOIN opitemrece oo ON oo.icode = target_items.icode`:
     ```sql
     --  รูปแบบที่ถูกต้องและโหลดเร็วที่สุด:
     FROM (
       SELECT 
         oo.vn,
         GROUP_CONCAT(DISTINCT target_items.drug_name SEPARATOR ', ') AS drugname,
         GROUP_CONCAT(DISTINCT target_items.adp_name SEPARATOR ', ') AS name
       FROM (
         SELECT 
           icode, 
           CONCAT_WS(' ', name, NULLIF(strength, '')) AS drug_name, 
           NULL AS adp_name
         FROM drugitems 
         WHERE did IN (${didPlaceholders})
         UNION ALL
         SELECT 
           icode, 
           NULL AS drug_name, 
           CONCAT_WS(' ', s_sub.name, NULLIF(s_sub.strength, '')) AS adp_name
         FROM s_drugitems s_sub 
         WHERE TRIM(s_sub.nhso_adp_code) = ?
       ) target_items
       JOIN opitemrece oo ON oo.icode = target_items.icode
       WHERE IFNULL(oo.vn, '') <> ''
         AND oo.vstdate BETWEEN ? AND ?
       GROUP BY oo.vn
     ) dd
     ```
   - ผลลัพธ์: ตาราง `target_items` มีขนาดเพียง 2–5 แถว MySQL จึงใช้ Index `opitemrece(icode, vstdate)` หรือ `opitemrece(icode)` พุ่งตรงไปอ่านเฉพาะแถวที่มีการจ่ายยานั้นๆ ทันที ลดการอ่านข้อมูลจากหลายล้านแถวเหลือเพียงไม่กี่สิบถึงไม่กี่ร้อยแถว
3. **การดึงข้อมูลรายการประกอบสำหรับ Modal (`listname1`):**
   - **ห้าม** ทำ Subquery สแกนตาราง `opitemrece` ทั้งปีงบประมาณซ้ำอีกรอบเด็ดขาด
   - ให้ใช้ Correlated Scalar Subquery ใน `SELECT` list:
     ```sql
     (
       SELECT GROUP_CONCAT(DISTINCT CONCAT(a.icode, ':', b.name) SEPARATOR ', ')
       FROM opitemrece a
       JOIN nondrugitems b ON b.icode = a.icode
       WHERE a.vn = o.vn
     ) AS listname1,
     ```
     เพราะ Subquery นี้จะทำงานผ่าน Index `opitemrece(vn)` เฉพาะผู้ป่วยที่ตรงเงื่อนไขแล้วเท่านั้น (หลักสิบเคส) ใช้เวลาไม่ถึง 2 มิลลิวินาที
4. **ตัด Cartesian Join ซ้ำซ้อน:**
   - ตรวจสอบไม่ให้มี `LEFT JOIN rcmdb.repdata re ON re.vn = o.vn` ลอยๆ โดยไม่มี `GROUP BY` หาก Subquery หลักของ `rep` มีการ Aggregate และจัดกลุ่ม `GROUP_CONCAT(DISTINCT fund)` ไว้อยู่แล้ว ป้องกันการคูณแถวในหน่วยความจำ

