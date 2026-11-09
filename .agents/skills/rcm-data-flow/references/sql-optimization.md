# HOSxP SQL Optimization & FoxPro Migration Reference

ใช้เมื่อเขียน ปรับปรุง หรือตรวจสอบ SQL ใน `src/lib/clinical/rcm*Service.ts` ที่ส่งผ่าน API Gateway (`queryClinicalDb`)

---

## 1. FoxPro-to-MySQL Migration Rules

สคริปต์รายงานเดิมของโรงพยาบาลรันบน Visual FoxPro และใช้ตารางชั่วคราว เมื่อแปลงมาเป็น SQL บน MySQL/MariaDB ผ่าน Gateway ต้องยึดกฎนี้:

1. **Authen Code / ClaimCode สองชั้น (Two-Source ClaimCode Fallback):**
   - **แหล่งที่ 1 (Direct Point of Care):** บันทึกจากเครื่องอ่านบัตรประชาชน/KIOSK/ห้องบัตรทันทีตอนลงทะเบียน อยู่ในตาราง **`visit_pttype.auth_code`** (หรือ `visit_pttype.claim_code`)
   - **แหล่งที่ 2 (NHSO Batch Import):** นำเข้าจากไฟล์/API สปสช. เป็นรอบๆ อยู่ในตาราง **`rcmdb.authencode`** คอลัมน์คือ **`cc.AuthenCode`** (*ห้ามใช้ `cc.claimcode` เพราะเป็นชื่อคอลัมน์ใน FoxPro temp table*)
   - **มาตรฐานการ JOIN และ COALESCE ที่สมบูรณ์:**
     เพื่อไม่ให้เคสที่ยืนยันตัวตนหน้างานเรียบร้อยแล้ว หลุดกลายเป็น "ไม่มี ClaimCode" ในช่วงเวลาก่อนที่ฝ่ายประกันจะกดนำเข้า Batch สปสช. ต้องประกบทั้งสองแหล่งเสมอ:
     ```sql
     COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
     ...
     LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
     LEFT JOIN visit_pttype vt ON vt.vn = o.vn
     ```
2. **Lookup & Age Calculation:**
   - `thaiage(pt.birthday, o.vstdate)` → `IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate))`
   - `seeknames(pt.nationality, 'nation')` → `LEFT JOIN nationality nat ON nat.nationality = pt.nationality`
   - `seeknames(o.pttype, 'pttype')` → `LEFT JOIN pttype ptt ON ptt.pttype = o.pttype`
   - `seekname(o.main_dep, 'kskdepartment')` → `LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep`
   - `seekname(o.spclty, 'spclty')` → `LEFT JOIN spclty spc ON spc.spclty = o.spclty`
3. **ตารางชดเชย (NHSO, REP, eClaim) และลำดับ COALESCE:**
   - แปลง `createtempnhso` / `createtemprep` / `createtempeclaim` เป็น Subquery JOIN แบบ Aggregate ต่อ `vn` (`GROUP BY vn`) เพื่อไม่ให้เกิด Cartesian Join คูณแถว:
     - `rcmdb.repeclaim` (`NHSO :: มี Invoice แล้ว`)
     - `rcmdb.repdata` (`Rep :: มี Rep แล้ว`, ดึง `fund`, `subfund`, `agency`, `errorcode`, `transactiontype`)
     - `rcmdb.neweclaim nn ON nn.Seq = o.vn`
     - `eclaimdb.m_registerdata m` + `rcmdb.eclaimstatus ecs`
   - รวมค่าชดเชยและสถานะด้วย:
     ```sql
     COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, '-:ยังไม่ได้ส่ง') AS status,
     COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
     COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated
     ```
     *(คอลัมน์ `rep` ต้อง SELECT ออกมาเสมอ เพื่อให้ฝั่ง UI นำเลข Rep ไปแสดงผลตามกฎ "ถ้ามี Rep ก็ต้องเอาเลข Rep มาแสดงด้วย" และใช้กระทบยอดบัญชี)*
   - > [!CAUTION]
     > **กับดักขอบเขตเวลา DATETIME Boundary (The Midnight Cut-off Bug):**
     > คอลัมน์ `AdmDate` ใน `rcmdb.repdata` และ `rcmdb.repeclaim` มี Data Type เป็น **`DATETIME`** (เก็บเวลาด้วย เช่น `2026-09-30 13:31:00`)
     > **ห้าม** เขียน `WHERE admdate BETWEEN ? AND ?` โดยส่งวันที่สตริง `'YYYY-MM-DD'` เด็ดขาด! เพราะ MySQL จะแคสต์วันที่ตัวหลังเป็น `'YYYY-MM-DD 00:00:00'` ทำให้ผู้ป่วยที่มารับบริการในวันสุดท้ายของช่วงเวลา (เช่น 30 ก.ย. สิ้นปีงบประมาณ) ที่มีเวลาหลังเที่ยงคืนหลุดช่วงทันที เกิดอาการบั๊กเงียบ `rep` กลายเป็น `NULL` และสถานะตกไปเป็น `'-:ยังไม่ได้ส่ง'`
     > 
     > **แนวทางที่ถูกต้อง:** ให้ใช้เงื่อนไข Half-Open Interval เสมอ:
     > ```sql
     > WHERE department = 'OP' 
     >   AND IFNULL(vn, '') <> '' 
     >   AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
     > ```
   - **ข้อควรระวังสำหรับ `eclaimdb.m_registerdata`:**
     คอลัมน์ `DATEADM` เก็บสตริงปี พ.ศ. ไม่มีขีด (`YYYYMMDD` เช่น `'25650509'`) และเป็นตารางประวัติเก่าถึงปี 2566 ห้ามส่งวันที่ ค.ศ. (`'2025-10-01'`) ไปกรองด้วย `m.dateadm BETWEEN ? AND ?` เพราะจะไม่แมตช์เลย ให้ใช้เพียงการ JOIN `ON m.opdseq = o.vn` ร่วมกับ `WHERE m.person_type = '1' AND IFNULL(m.opdseq, '') <> ''` ก็เพียงพอแล้ว
4. **Timeout สำหรับ Query ข้ามเดือนบน `opitemrece`:**
   - ส่ง `{ timeoutMs: 90000 }` เสมอเมื่อ Query แตะ `opitemrece` พร้อมตารางชดเชยข้ามหลายเดือน
5. **NHSO ADP Mapping Pre-Check:**
   - ตรวจ `SELECT icode, name, strength, nhso_adp_code FROM s_drugitems WHERE TRIM(nhso_adp_code) IN (?)`
   - ฟังก์ชัน `checkAdpMapping` ต้องรองรับ `refresh?: boolean` (invalidate cache เมื่อผู้ใช้กดรีเฟรช) และแจ้ง Warning Banner ชัดเจนใน UI หาก `isMapped === false`

---

## 2. ขจัด Mojibake & TIS-620 Collation Conflict

ฐานข้อมูล HOSxP ใช้ Charset `tis620` แต่ Node.js/TypeScript เป็น `utf8`:

- **ห้าม** เขียนข้อความภาษาไทยใน SQL `CASE WHEN ... THEN 'ชาย'` หรือ `CONCAT('ปีที่ ', ...)` เพราะเสี่ยง Collation Conflict และ Mojibake
- ใน SQL ให้ส่งรหัสกลาง (`IFNULL(pt.sex, '') AS sex_code`) แล้วแปลงเป็นภาษาไทยใน Service Layer ด้วย `formatThaiSex(row.sex_code, row.sex)` จาก `@/lib/clinical/rcmDashboardService`

---

## 3. Driving Subquery Pattern สำหรับ `opitemrece` (ลดจาก 60s เหลือ < 0.1s)

`opitemrece` มีขนาดหลายล้านแถวต่อปีงบประมาณ:

1. **ห้ามใช้ `OR` ข้ามตารางที่ `LEFT JOIN` กับ `opitemrece`:** MySQL จะไม่ใช้ Index และเกิด Full-Table Scan
2. **รวมรหัสแค็ตตาล็อก (`drugitems` / `s_drugitems`) เป็น `target_items` ขนาด 2–5 แถวก่อน แล้วค่อย `JOIN opitemrece`:**

```sql
FROM (
  SELECT
    oo.vn,
    GROUP_CONCAT(DISTINCT target_items.drug_name SEPARATOR ', ') AS drugname,
    GROUP_CONCAT(DISTINCT target_items.adp_name SEPARATOR ', ') AS name
  FROM (
    SELECT icode, CONCAT_WS(' ', name, NULLIF(strength, '')) AS drug_name, NULL AS adp_name
    FROM drugitems
    WHERE did IN (${didPlaceholders})
    UNION ALL
    SELECT icode, NULL AS drug_name, CONCAT_WS(' ', s_sub.name, NULLIF(s_sub.strength, '')) AS adp_name
    FROM s_drugitems s_sub
    WHERE TRIM(s_sub.nhso_adp_code) = ?
  ) target_items
  JOIN opitemrece oo ON oo.icode = target_items.icode
  WHERE IFNULL(oo.vn, '') <> ''
    AND oo.vstdate BETWEEN ? AND ?
  GROUP BY oo.vn
) dd
```

3. **ห้ามสแกน `opitemrece` ซ้ำซ้อนใน Query เดียว (Consolidate Scans):**
   - ข้อมูลประกอบของแถวที่ผ่านการกรองแล้ว (เช่น `listname1` จาก `nondrugitems` หรือประวัติเคลมก่อนหน้าของ `o.hn`) ให้ใช้ **Correlated Scalar Subquery ใน `SELECT` list** ที่วิ่งผ่าน Index `opitemrece(vn)` หรือ `ovst(hn, vstdate)` เฉพาะแถวที่แมตช์แล้วเท่านั้น แทนการเปิด Subquery สแกน `opitemrece` ทั้งปีซ้ำอีกรอบ:
   ```sql
   (
     SELECT GROUP_CONCAT(DISTINCT CONCAT(a.icode, ':', b.name) SEPARATOR ', ')
     FROM opitemrece a
     JOIN nondrugitems b ON b.icode = a.icode
     WHERE a.vn = o.vn
   ) AS listname1
   ```

---

## 4. Upstream SQL Audit Checklist 8 ข้อ (ห้าม Copy-Paste SQL ต้นทางตรงๆ)

| # | ข้อตรวจ | แนวทางที่ถูกต้อง |
|---|---|---|
| **1** | **Driving Table** | เริ่ม `FROM` จากตารางที่กรองช่วงแคบที่สุด (`ovst`/`vn_stat` ที่มี Index `vstdate` หรือ Driving Subquery รหัสยา/รหัสโรค) ห้ามตั้งต้นจาก `patient` หรือ `opitemrece` ทั้งก้อน |
| **2** | **SARGable WHERE** | ห้ามครอบคอลัมน์ Index ด้วยฟังก์ชัน (`DATE(o.vstdate)`, `YEAR(...)`, `TRIM(o.hn)`) และระวัง Type Mismatch ระหว่าง VARCHAR กับ Number |
| **3** | **No `DISTINCT` Masking** | ห้ามใส่ `SELECT DISTINCT` เพื่อกลบ Cartesian Product จาก 1:N `LEFT JOIN`; ให้ยุบตารางลูกด้วย `GROUP BY vn` ก่อน JOIN |
| **4** | **Projection Pruning** | ห้าม `SELECT pt.*, o.*, v.*`; เลือกเฉพาะคอลัมน์ที่ใช้จริงบน UI/Export |
| **5** | **Consolidate Scans** | รวม Subquery ที่แตะ `opitemrece` หรือ `repdata` ซ้ำหลายครั้งเป็นครั้งเดียวด้วย Conditional Aggregation (`SUM(CASE WHEN ... END)`) |
| **6** | **Service-Layer Text** | ดึง Raw Code จาก SQL แล้วแปลงข้อความ/การจัดกลุ่มเป็นภาษาไทยใน TypeScript |
| **7** | **DATETIME Boundary** | คอลัมน์ประเภท `DATETIME` (`admdate`, `date_rep`) **ห้าม** ใช้ `BETWEEN ? AND ?` กับสตริงวันที่เพียวๆ (`'YYYY-MM-DD'`) เพราะจะตัดเคสในวันสุดท้ายหลัง 00:00:00 ทิ้งทั้งหมด — ต้องใช้ `>= ? AND < DATE_ADD(?, INTERVAL 1 DAY)` เสมอ |
| **8** | **Two-Source ClaimCode** | การดึง ClaimCode/AuthenCode **ห้าม** ดึงจาก `rcmdb.authencode` เพียงแหล่งเดียว เพราะหากยังไม่นำเข้า Batch สปสช. เคสที่ยืนยันตัวตนหน้างานผ่าน KIOSK/ห้องบัตรจะหลุดเป็น "ไม่มี ClaimCode" — ต้องใช้ `COALESCE(cc.AuthenCode, vt.auth_code, vt.claim_code)` คู่กับ `LEFT JOIN visit_pttype vt ON vt.vn = o.vn` เสมอ |

---

## 5. เกณฑ์มาตรฐานความเร็ว (RCM Query SLA)

- **Tier 1 (KPI & Aggregated Summary):** `< 500 ms`
- **Tier 2 (Paginated Ledger 50 รายการ):** `< 1,000 ms`
- **Threshold Alert:** หาก Query ช่วง 1 เดือนใช้เวลาเกิน `3,000 ms` ต้องรัน `EXPLAIN` หา Full-Table Scan และปรับเป็น Driving Subquery Pattern ทันที
