# HOSxP SQL Optimization & FoxPro Migration Reference

ใช้เมื่อเขียน ปรับปรุง หรือตรวจสอบ SQL ใน `src/lib/clinical/rcm*Service.ts` ที่ส่งผ่าน API Gateway (`queryClinicalDb`)

---

## 1. FoxPro-to-MySQL Migration Rules

สคริปต์รายงานเดิมของโรงพยาบาลรันบน Visual FoxPro และใช้ตารางชั่วคราว เมื่อแปลงมาเป็น SQL บน MySQL/MariaDB ผ่าน Gateway ต้องยึดกฎนี้:

1. **Authen Code ฟิลด์จริงคือ `cc.AuthenCode`:**
   - ตารางจริงคือ `rcmdb.authencode` คอลัมน์คือ **`cc.AuthenCode`**
   - **ห้าม** ใช้ `cc.claimcode` (เป็นชื่อใน temp table ของ FoxPro — จะ Error `Unknown column 'cc.claimcode'`)
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
     COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname) AS status,
     COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
     COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated
     ```
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

## 4. Upstream SQL Audit Checklist 6 ข้อ (ห้าม Copy-Paste SQL ต้นทางตรงๆ)

| # | ข้อตรวจ | แนวทางที่ถูกต้อง |
|---|---|---|
| **1** | **Driving Table** | เริ่ม `FROM` จากตารางที่กรองช่วงแคบที่สุด (`ovst`/`vn_stat` ที่มี Index `vstdate` หรือ Driving Subquery รหัสยา/รหัสโรค) ห้ามตั้งต้นจาก `patient` หรือ `opitemrece` ทั้งก้อน |
| **2** | **SARGable WHERE** | ห้ามครอบคอลัมน์ Index ด้วยฟังก์ชัน (`DATE(o.vstdate)`, `YEAR(...)`, `TRIM(o.hn)`) และระวัง Type Mismatch ระหว่าง VARCHAR กับ Number |
| **3** | **No `DISTINCT` Masking** | ห้ามใส่ `SELECT DISTINCT` เพื่อกลบ Cartesian Product จาก 1:N `LEFT JOIN`; ให้ยุบตารางลูกด้วย `GROUP BY vn` ก่อน JOIN |
| **4** | **Projection Pruning** | ห้าม `SELECT pt.*, o.*, v.*`; เลือกเฉพาะคอลัมน์ที่ใช้จริงบน UI/Export |
| **5** | **Consolidate Scans** | รวม Subquery ที่แตะ `opitemrece` หรือ `repdata` ซ้ำหลายครั้งเป็นครั้งเดียวด้วย Conditional Aggregation (`SUM(CASE WHEN ... END)`) |
| **6** | **Service-Layer Text** | ดึง Raw Code จาก SQL แล้วแปลงข้อความ/การจัดกลุ่มเป็นภาษาไทยใน TypeScript |

---

## 5. เกณฑ์มาตรฐานความเร็ว (RCM Query SLA)

- **Tier 1 (KPI & Aggregated Summary):** `< 500 ms`
- **Tier 2 (Paginated Ledger 50 รายการ):** `< 1,000 ms`
- **Threshold Alert:** หาก Query ช่วง 1 เดือนใช้เวลาเกิน `3,000 ms` ต้องรัน `EXPLAIN` หา Full-Table Scan และปรับเป็น Driving Subquery Pattern ทันที
