# โครงสร้างและรูปแบบคอมโพเนนต์ (Component Craft Guidelines)

สำหรับระบบโรงพยาบาลเถิน (Next.js 16 + CSS Modules / `page.css`)
เน้น **Quiet Chrome, Rich Content** — ลดกล่องซ้ำซ้อนแบบเทมเพลต AI ให้สายตาพุ่งตรงไปที่ข้อมูลและสถานะจริง

---

## 1. ลำดับโครงสร้างหน้ามาตรฐาน (Page Rhythm)

| ลำดับ | ส่วนประกอบ | แนวทางการจัดวาง |
|---|---|---|
| **1** | **Breadcrumb / Back Link** | ลิงก์ข้อความเรียบ `← กลับ...` หรือ Breadcrumb ไม่มีเลขลำดับข้อ, สูง `>= 44px`, สี `var(--gray-700)` |
| **2** | **Header Bar** | `<h1>` ชื่อรายงาน/หน้าตรงไปตรงมา (ไม่มี Eyebrow Pill แปะลอยข้างบน, ไม่มีเลขลำดับ `14.5`) + คำอธิบายสั้น 1 บรรทัด + ปุ่ม Primary **1 ปุ่ม** ชิดขวา |
| **3** | **Overview & Filter Rhythm** | เลือกรูปแบบสรุปยอดที่ไม่ดูเป็น "กำแพงกล่อง AI 8 ใบเท่ากันหมด" (ดูข้อ 2) |
| **4** | **Single-Row Toolbar** | แถบเลือกช่วงเวลาแถวเดียว (`กำหนดเอง \| เดือน \| ปีงบประมาณ` + ตัวเลือกวันที่) คู่กับ **Unified Global Search** 1 ช่อง (ไม่มีดรอปดาวน์เลือกฟิลด์) |
| **5** | **Main Content** | ตารางข้อมูลโปร่งตา (`row height >= 52–56px`) หรือกราฟหลัก 1 ชิ้นคู่กับตารางสรุป |

---

## 2. ทลายหน้าตา AI Template ในส่วน KPI และกราฟ

**ปัญหาที่ทำให้ดูเป็น AI:** การ์ด 8 ใบขนาดเท่ากันเป๊ะ เรียง `4x2` ทุกใบมีกล่องไอคอนสีพาสเทล + ตัวเลข + ข้อความย่อย + เงาฟุ้ง หรือกราฟสีรุ้งหลายใบแข่งกัน

### แนวทางที่ดูเป็นงานออกแบบจริง:
1. **แบ่งน้ำหนักชั้นความสำคัญ (Tiered Summary แทน 8 กล่องหน้าตาเหมือนกัน):**
   - **ชั้นบน (Featured Totals — 2 ถึง 4 ช่อง):** ยอดรวมหลักที่ตัดสินใจทันที (เช่น ผู้รับบริการทั้งหมด, ยอดชดเชยรวม, รอชดเชย, อัตรา Authen) จัดเรียงสมมาตร (`repeat(4, 1fr)` หรือ `repeat(2, 1fr)`) ด้วยพื้นขาว ขอบ 1px เงียบๆ เน้นตัวเลข `tabular-nums` ขนาด `24–28px` น้ำหนัก `600` และบรรทัดเปรียบเทียบสั้น (เช่น `คิดเป็น 84.2% ของทั้งหมด`) — **ไม่ต้องใส่กล่องไอคอนสีหรือ Sparkline ตกแต่งทุกใบ**
   - **ชั้นคัดกรอง (Compact Filter Segmented Bar หรือ Stat Chips):** ตัวกรองย่อย (เช่น มี Authen / ไม่มี Authen / สิทธิบัตรทอง / เคลมซ้ำ) ใช้แถบ Chip หรือ Compact Segmented Tabs แถวเดียวที่บอกจำนวนเคสกำกับแบบเรียบง่าย ช่วยลดความสูงหน้าจอและทำให้ตัวตารางหลักโผล่พ้น Fold ทันที
   - หากใช้ Grid การ์ดสรุปที่เป็นปุ่มกรอง ต้องจัดแถวให้**สมมาตรไร้ช่องแหว่ง** (`4x2` หรือ `3x2` เท่านั้น ห้ามบน 5 ล่าง 3) และการ์ดที่ถูกเลือกใช้เส้นขอบ `var(--primary)` + พื้น `var(--primary-subtle)` แทน Glow ฟุ้งๆ
2. **Chart Craft (เมื่อหน้ามีกราฟ):**
   - วาง **กราฟหลักเพียง 1 ชิ้น** ให้กว้างพอหายใจ (เช่น 60–65% ของแถว หรือเต็มความกว้างเหนือตาราง) ส่วนข้อมูลเปรียบเทียบย่อยใช้ตารางจัดอันดับพร้อมแถบบางๆ
   - ใช้เส้นกริดจาง (`var(--gray-100)`), ป้ายแกน `tabular-nums`, สีเขียวแบรนด์ (`#0D7446`) สำหรับแท่ง/เส้นหลัก และสีเทา-เขียวอ่อน (`#9CA89E` / `#C5CFC8`) สำหรับฐานเปรียบเทียบ — **ห้ามใช้แท่งสีรุ้ง**

---

## 3. กติกาคอมโพเนนต์หลัก

| คอมโพเนนต์ | ข้อกำหนดการออกแบบ |
|---|---|
| **Primary Button** | พื้น `var(--primary)`, ข้อความขาว, สูง `44–48px`, รัศมี `8px`, มี 1 ปุ่มเด่นต่อมุมมอง; hover เปลี่ยนสีเฉพาะ property (`background-color`) |
| **Secondary / Ghost Button** | พื้นขาว ขอบ `1px solid var(--gray-200)` ข้อความ `var(--gray-700)` สูง `44px`; ห้ามแย่งจุดเด่นจากปุ่ม Primary |
| **Destructive Button** | พื้น `var(--danger-bg)` ข้อความ `var(--danger)` ใช้เฉพาะการลบ/ถอนสิทธิ์ และต้องเปิด Confirmation Modal |
| **Single-Row Date Selector** | แท็บ **`กำหนดเอง \| เดือน \| ปีงบประมาณ`** (ไม่มีเลข `1. 2. 3.` นำหน้า) อยู่บรรทัดเดียวกับ Dropdown/Picker คั่นด้วยเส้นตั้งบาง `1px`; Dropdown ปีงบประมาณแสดงเฉพาะ `ปีงบประมาณ 2569` **ไม่มีวงเล็บช่วงวันที่** |
| **Unified Global Search** | ช่องค้นหา 1 ช่อง สูง `44px` ไอคอนแว่นขยายชิดซ้าย (`16–18px`) ค้นหาพร้อมกันทั้ง HN, CID, ชื่อ-สกุล, VN/AN, รหัสโรค, สิทธิ **ไม่มีดรอปดาวน์เลือกฟิลด์** |
| **Row-Clickable Table** | คลิกทั้ง `<tr>` เพื่อเปิด Detail Modal (`cursor: pointer`, hover เปลี่ยนพื้นเป็น `--primary-subtle`), ไม่มีคอลัมน์ปุ่ม "เปิดดู" ซ้ำซ้อน, ไม่มีปุ่ม Copy ในเซลล์ |
| **Status Badge** | แคปซูลหรือแท็กมุมมนเล็ก (`6px` หรือ `9999px`) พื้นอ่อน + ตัวอักษรเข้มตาม `tokens.md` + จุดสถานะเล็ก 6px (ไม่ใส่ Emoji) |
| **Friendly Forms** | ระยะห่างแนวตั้ง `20px`, Label อยู่เหนือช่องเสมอ (`font-weight: 500`), Helper text สี `var(--gray-500)` `13–14px` |

---

## 4. มาตรฐานตารางข้อมูล (Table Alignment & Cohesion)

### 4.1 `<th>` และ `<td>` ต้องมี Alignment ตรงกัน 100%
- **จัดกึ่งกลาง (`col-center` ทั้ง `<th>` และ `<td>`):**
  1. ลำดับที่ (`#`)
  2. วันที่และเวลา
  3. รหัส, HN, AN, VN, เลขบัตรประชาชน (`tabular-nums`)
  4. ชื่อ-สกุลผู้ป่วย (กึ่งกลางแนวนอนแกน X)
  5. อายุ + หน่วยปี (`{age}&nbsp;ปี`, `white-space: nowrap`)
  6. ป้ายสถานะ (Badge จัดกึ่งกลางด้วย `inline-flex; margin: 0 auto;`)
  7. ตัวเลขจำนวนนับ / จำนวนครั้ง
  8. ชดเชย (บาท) ในตารางกองทุน/เวชระเบียน (`tabular-nums`)
- **จัดชิดซ้าย (`col-left` ทั้ง `<th>` และ `<td>`):**
  - ข้อความบรรยายยาว (เช่น การวินิจฉัย, รายการยา/หัตถการ, หมายเหตุ)
- **จัดชิดขวา (`col-right` ทั้ง `<th>` และ `<td>`):**
  - เฉพาะตารางบัญชีการเงินที่ต้องเทียบหลักทศนิยมแนวตั้งโดยตรง

### 4.2 โครงสร้าง CSS & JSX มาตรฐาน (Copy ไปใช้ได้ทันที)

```tsx
/* หัวตารางที่มี Sort — บังคับไอคอนอยู่บรรทัดเดียวกับข้อความเสมอ */
<th
  className="sortable col-center"
  style={{ width: '130px' }}
  onClick={() => handleSort('vstdate')}
>
  <span className="th-sort-inner">
    <span>วันที่รับบริการ</span>
    {renderSortIndicator('vstdate')}
  </span>
</th>

/* ชื่อ-สกุลผู้ป่วย — กึ่งกลางแกน X และยกไปทั้งนามสกุลเมื่อจอแคบ */
<td className="col-center" style={{ minWidth: '170px' }}>
  <span className="pt-first-name">{firstName}</span>{' '}
  <span className="pt-last-name">{lastName}</span>
</td>
```

```css
.thTable th,
.thTable td {
  padding: 14px 16px;
  vertical-align: middle;
}

.thTable tbody tr {
  min-height: 54px;
  cursor: pointer;
  transition: background-color 150ms var(--ease-out);
}

.thTable tbody tr:hover {
  background-color: var(--primary-subtle);
}

.thTable th.col-center,
.thTable td.col-center {
  text-align: center;
}

.thTable th.col-left,
.thTable td.col-left {
  text-align: left;
}

.thTable th.col-right,
.thTable td.col-right {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* กัน svg { display: block; } ใน globals.css ทำให้ไอคอน Sort ตกบรรทัด */
.th-sort-inner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
  vertical-align: middle;
}

.thTable thead th.sortable svg {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}

/* ยกไปทั้งนามสกุล ไม่ตัดกลางพยางค์ */
.pt-first-name,
.pt-last-name {
  display: inline-block;
  white-space: nowrap;
}
```

---

## 5. สถานะทั้ง 4 และ Responsive บนมือถือ

1. **Empty State (ว่าง):** พื้นที่โปร่ง ไอคอนขนาด `40–48px` สี `--gray-400`, ข้อความสุภาพ + ปุ่มดำเนินการต่อ 1 ปุ่ม
2. **No Search Results:** แจ้งคำค้นอย่างสุภาพ พร้อมปุ่ม "ล้างคำค้นหาทั้งหมด"
3. **Loading Skeleton:** ใช้ `animate-pulse` เฉพาะกล่อง Skeleton ขนาดเท่าของจริง (เมื่อมีข้อมูลเก่าอยู่แล้วระหว่างเปลี่ยนหน้า ให้คงตารางเก่าไว้พร้อมความทึบจางหรือแถบโหลดด้านบน เพื่อไม่ให้หน้ากระตุก)
4. **Error State:** ข้อความภาษาไทยที่ปลอบประโลม (ไม่แสดง Raw SQL/Stack Trace) + ปุ่ม "ลองโหลดใหม่อีกครั้ง"
5. **Mobile (`< 768px`):** แปลงตารางเป็น Card View (`padding: 16px`, `gap: 16px`, Touch target `>= 44–48px`), Sticky bottom action bar ต้องมีพื้นทึบ + `padding-bottom: calc(16px + env(safe-area-inset-bottom))`
