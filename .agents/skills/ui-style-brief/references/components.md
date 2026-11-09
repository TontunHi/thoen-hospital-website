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
| **Breadcrumb Navigation** | ลิงก์ข้อความเรียบ `หน้าหลัก / กองทุน / ชื่อรายงานย่อย` สี `var(--gray-500)` คั่นด้วยเครื่องหมาย `/` หรือ chevron จางๆ ไม่ใช้ Eyebrow Pill แปะลอย |
| **Primary Button** | พื้น `var(--primary)`, ข้อความขาว, สูง `44–48px`, รัศมี `8px`, มี 1 ปุ่มเด่นต่อมุมมอง; hover เปลี่ยนสีเฉพาะ property (`background-color`) |
| **Secondary / Ghost Button** | พื้นขาว ขอบ `1px solid var(--gray-200)` ข้อความ `var(--gray-700)` สูง `44px`; ห้ามแย่งจุดเด่นจากปุ่ม Primary |
| **Destructive Button** | พื้น `var(--danger-bg)` ข้อความ `var(--danger)` ใช้เฉพาะการลบ/ถอนสิทธิ์ และต้องเปิด Confirmation Modal |
| **Single-Row Date Selector** | แท็บ **`กำหนดเอง \| เดือน \| ปีงบประมาณ`** (ไม่มีเลข `1. 2. 3.` นำหน้า) อยู่บรรทัดเดียวกับ Dropdown/Picker คั่นด้วยเส้นตั้งบาง `1px`; Dropdown ปีงบประมาณแสดงเฉพาะ `ปีงบประมาณ 2569` **ไม่มี label ข้อความนำหน้า dropdown** (ค่าในตัวเลือกบอกอยู่แล้ว), **ไม่มีวงเล็บช่วงวันที่** และ **ไม่มี Date Badge ซ้ำซ้อน** |
| **Unified Global Search** | ช่องค้นหา 1 ช่อง สูง `44px` ไอคอนแว่นขยายชิดซ้าย (`16–18px`) ค้นหาพร้อมกันทั้ง HN, CID, ชื่อ-สกุล, VN/AN, รหัสโรค, สิทธิ **ไม่มีดรอปดาวน์เลือกฟิลด์** |
| **Row-Clickable Table** | คลิกทั้ง `<tr>` เพื่อเปิด Detail Modal (`cursor: pointer`, hover เปลี่ยนพื้นเป็น `--primary-subtle`), ไม่มีคอลัมน์ปุ่ม "เปิดดู" ซ้ำซ้อน, ไม่มีปุ่ม Copy ในเซลล์, **ไม่มีแถวสรุป `<tfoot>` ซ้ำซ้อน** |
| **Status Badge** | แคปซูลหรือแท็กมุมมนเล็ก (`6px` หรือ `9999px`) พื้นอ่อน + ตัวอักษรเข้มตาม `tokens.md` + จุดสถานะเล็ก 6px (ไม่ใส่ Emoji) |
| **Friendly Forms** | ระยะห่างแนวตั้ง `20px`, Label อยู่เหนือช่องเสมอ (`font-weight: 500`), Helper text สี `var(--gray-500)` `13–14px` |

---

## 4. มาตรฐานตารางข้อมูล (Table Alignment & Cohesion)

### 4.1 หัวตาราง `<th>` + เซลล์ `<td>`

**หัวตาราง — กติกาที่ตกลงใช้แล้ว (อย่ากลับไปทำแบบเดิม):**

1. **หัวตารางเป็นแถวเดียว** — ห้ามใส่แถบหัวกลุ่มคอลัมน์ซ้อนเหนือหัวคอลัมน์ (เช่น `ข้อมูลผู้รับบริการ` / `เกณฑ์ Palliative Care` / `การชดเชย e-Claim`) เพราะเพิ่มความสูงตาราง, ข้อความไม่ตรงกับคอลัมน์, และซ้ำกับชื่อคอลัมน์ที่สื่อความหมายอยู่แล้ว
2. **จัดหัวทุกช่องกึ่งกลาง** (`col-center`) แม้คอลัมน์นั้นข้อมูลด้านล่างจะชิดซ้าย/ขวา — ให้แถบหัวอ่านต่อเนื่องเป็นเส้นเดียว
3. `position: sticky; top: 0` ภายในกรอบเลื่อนของตาราง (`.xxx-table-scroll` ที่มี `max-height`) + พื้น `--bg-subtle` + `border-bottom: 2px solid var(--gray-200)`
4. หัวสองบรรทัด (ชื่อ + เงื่อนไข เช่น `Advance Care Plan` / `Dx + Z718`) ให้ใช้ `<span>` ซ้อนสองบรรทัดแทนการเพิ่ม `<tr>` กลุ่ม

**เซลล์ข้อมูล — จัดตามชนิดข้อมูล (ไม่ต้องตรงกับหัวเสมอไป):**

- **กึ่งกลาง:** ลำดับ, วันที่/เวลา, รหัส (HN/VN/CID/ClaimCode/ICD/icode), ชื่อ-สกุลผู้ป่วย, Badge สถานะ, จำนวนนับ
- **ชิดซ้าย:** ข้อความบรรยายยาว (การวินิจฉัย, รายการยา/หัตถการ, หมายเหตุ, ชื่อไฟล์)
- **ชิดขวา:** คอลัมน์เงิน เพื่อเทียบหลักทศนิยม (`tabular-nums`, ทศนิยม 2 ตำแหน่งคงที่)

### 4.2 โครงสร้าง CSS & JSX มาตรฐาน (Copy ไปใช้ได้ทันที)

```tsx
/* 1. Breadcrumb เงียบสงบ */
<nav className="breadcrumbs" aria-label="Breadcrumb">
  <Link href="/service/dashboard-rcm">Dashboard RCM</Link>
  <span className="crumb-sep">/</span>
  <Link href="/service/dashboard-rcm/funds/ccs">กองทุน CCS</Link>
  <span className="crumb-sep">/</span>
  <span className="crumb-current">1.2 รายชื่อผู้รับบริการคัดกรอง</span>
</nav>

/* 2. Single-Row Date Ribbon พร้อมตัวคั่น Divider */
<div className="date-ribbon">
  <div className="tab-group">
    {['custom', 'month', 'fiscalYear'].map(mode => (
      <button key={mode} className={activeMode === mode ? 'active' : ''} onClick={() => setMode(mode)}>
        {labels[mode]}
      </button>
    ))}
  </div>
  <div className="divider-v" />
  <div className="date-inputs">
    {/* Inputs / Fiscal Year dropdown without redundant date range label */}
  </div>
</div>

/* 3. หัวตารางที่มี Sort — บังคับไอคอนอยู่บรรทัดเดียวกับข้อความเสมอ */
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

/* 4. ชื่อ-สกุลผู้ป่วย — กึ่งกลางแกน X และยกไปทั้งนามสกุลเมื่อจอแคบ */
<td className="col-center" style={{ minWidth: '170px' }}>
  <span className="pt-name">
    <span className="pt-first-name">{firstName}</span>{' '}
    <span className="pt-last-name">{lastName}</span>
  </span>
</td>

/* 5. อายุและหน่วย — บรรทัดเดียวกันเสมอ */
<td className="col-center tabular-nums">
  {age}&nbsp;ปี
</td>
```

```css
/* ตารางมาตรฐาน */
.thTable th,
.thTable td {
  padding: 14px 16px;
  vertical-align: middle;
}

.thTable tbody tr {
  min-height: 52px;
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

/* ป้องกันไอคอน Sort ตกบรรทัด */
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
.pt-name {
  display: inline-block;
}
.pt-first-name,
.pt-last-name {
  display: inline-block;
  white-space: nowrap;
}

/* Symmetrical KPI Grid (3x2 หรือ 4x1) ไร้แถบสี 4px ด้านบน */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.kpi-card {
  background: var(--bg-surface);
  border: 1px solid var(--gray-200);
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: var(--shadow-card);
  transition: border-color 150ms var(--ease-out), box-shadow 150ms var(--ease-out);
}

.kpi-card.active {
  border-color: var(--primary);
  background: var(--primary-subtle);
}

.kpi-val-ok {
  color: var(--success);
}

.kpi-val-err {
  color: var(--danger);
}
```

---

## 5. Lists & Sidebars Breathing Room (OpenDesigner Craft)

อ้างอิงหลักการออกแบบแถบนำทางและรายการของ Filipiuk / OpenDesigner:
1. **Container Insets:** รายการเมนูหรือลิงก์ในแถบด้านข้าง (Sidebar) ต้องเว้น Inset จากขอบกล่องอย่างน้อย `6–8px` (`padding: 6px 10px` หรือ `8px 12px`) เพื่อไม่ให้ตัวคลิกชิดขอบจอจนดูอึดอัด
2. **Icon-to-Label Spacing:** ระยะห่างระหว่างไอคอนและป้ายข้อความ ต้องมีระยะอย่างน้อย **ครึ่งหนึ่งของขนาดไอคอน** (เช่น ไอคอน `16px` -> เว้นช่องว่าง `8–10px`) ไม่ให้รวมกันเป็นก้อนเดียว
3. **Visual Grouping Hierarchy:** ระยะห่างระหว่างกลุ่มเมนู (Group gap `16–24px`) ต้องกว้างกว่าระยะห่างระหว่างรายการในกลุ่มเดียวกัน (Item gap `4–6px`) อย่างน้อย 2–3 เท่า
4. **Current Route Indicator:** ใช้สีพื้นโปร่งจาง (`--primary-subtle` / `#E8F5E9`) และตัวหนังสือสีเข้ม (`--primary` หรือ `--gray-900`) พร้อมเส้นมาร์กด้านข้าง `2px solid var(--primary)` แทนการถมสีทึบทั้งกล่อง

---

## 6. สถานะทั้ง 4 และ Responsive บนมือถือ

1. **Empty State (ว่าง):** พื้นที่โปร่ง ไอคอนขนาด `40–48px` สี `--gray-400`, ข้อความสุภาพ + ปุ่มดำเนินการต่อ 1 ปุ่ม
2. **No Search Results:** แจ้งคำค้นอย่างสุภาพ พร้อมปุ่ม "ล้างคำค้นหาทั้งหมด"
3. **Loading Skeleton:** ใช้ `animate-pulse` เฉพาะกล่อง Skeleton ขนาดเท่าของจริง (เมื่อมีข้อมูลเก่าอยู่แล้วระหว่างเปลี่ยนหน้า ให้คงตารางเก่าไว้พร้อมความทึบจางหรือแถบโหลดด้านบน เพื่อไม่ให้หน้ากระตุก)
4. **Error State:** ข้อความภาษาไทยที่ปลอบประโลม (ไม่แสดง Raw SQL/Stack Trace) + ปุ่ม "ลองโหลดใหม่อีกครั้ง"
5. **Mobile (`< 768px`):** แปลงตารางเป็น Card View (`padding: 16px`, `gap: 16px`, Touch target `>= 44–48px`), Sticky bottom action bar ต้องมีพื้นทึบ + `padding-bottom: calc(16px + env(safe-area-inset-bottom))`

---

## 7. Modal / Dialog Shell — โครงมาตรฐานที่ห้ามพลาด

ใช้กับทุก Detail Modal / VN Clinical Modal / Popup รายละเอียด (`VnDetailModal`, `.pc3-modal`, `.ccs10-modal-window`)

### 7.1 โครง flex 4 ชั้น (Header → Tabs → Body → Footer)

```css
.xxx-modal-container {
  display: flex;
  flex-direction: column;
  max-height: min(90vh, 900px);   /* dialog ไม่สูงเกินจอ */
  overflow: hidden;               /* ตัดการล้นรอบนอก */
}

/* ตรึง 3 ชั้นนี้ไว้ — ห้ามถูกบีบ */
.xxx-modal-header,
.xxx-modal-tabs,
.xxx-modal-footer {
  flex: 0 0 auto;
}

.xxx-modal-body {
  flex: 1 1 auto;
  min-height: 0;                  /* ★ จำเป็น: ให้ยอมหดแล้วเกิด scroll ภายใน */
  overflow-y: auto;
  overscroll-behavior: contain;   /* ★ หยุด scroll chaining ไปหน้าเว็บด้านหลัง */
  scrollbar-gutter: stable;       /* scrollbar โผล่/หายไม่ทำให้คอลัมน์กระตุก */
}
```

**อาการบั๊กที่เกิดถ้าไม่ทำตามนี้:** เนื้อหาแท็บยาว (เช่น 25 รายการ) → เบราว์เซอร์บีบ **ทุก** flex item (ค่าเริ่มต้น `flex-shrink: 1`) → แถบแท็บยุบจาก `48px` เหลือ `~9px`, ข้อความแท็บหาย และดูเหมือนเนื้อหาลอยมาบังแท็บ

### 7.2 กติกาอื่นของ modal

| หัวข้อ | ข้อกำหนด |
|---|---|
| **ขนาด** | `max-width: 1200px` (ตารางกว้าง), `max-height: min(90vh, 900px)`; มือถือ `< 768px` = `height: 100dvh`, `border-radius: 0`, `padding: 0` |
| **การเลื่อน** | ให้ **เฉพาะ `.xxx-modal-body`** เลื่อน และล็อกหน้าเว็บด้านหลังด้วย `document.documentElement.style.overflow = 'hidden'` + `document.body.style.overflow = 'hidden'` (shell ของ RCM ใช้ overflow จาก `html` — ล็อกแค่ `body` ไม่พอ) |
| **แถบแท็บ** | สูง `48px` คงที่, `border-bottom: 2px solid var(--primary)` ที่แท็บ active, ตัวเลขจำนวนในชิป `13px` พื้น `--bg-subtle`; มือถือ: 3 แท็บแบ่งเท่า (`flex: 1 1 0`), ซ่อนไอคอน, ให้ข้อความตัด 2 บรรทัดแทนการเลื่อนแนวนอน |
| **แถบระบุตัวตนผู้ป่วย** | `<dl>` + `<dt>` label จิ๋ว (`13px` เทา) / `<dd>` ค่า (`13px` เข้ม) — VN/HN/CID เป็นชิป `mono`; **ไม่มี gradient**, พื้น `--bg-subtle`, ขอบล่าง 1px |
| **ปุ่มปิด** | มุมขวาบน `40px` (มือถือ `44px`), ไอคอน `X` 18px, `aria-label="ปิดหน้าต่าง"`, `title="ปิด (Esc)"` |
| **แถบท้าย** | 1 Primary (การกระทำหลักของหน้าต่างนั้น) + 1 Secondary (ปิด); สูง `44px`; มือถือให้แบ่งครึ่งความกว้าง |
| **Dialog ซ้อน (alert)** | `position: absolute; inset: 0` ภายใน container + backdrop เบลอ `2px`, `role="alertdialog"` + `aria-labelledby`/`aria-describedby`, ไอคอนวงกลม `44px`, ปุ่มเดี่ยว `44px`, `autoFocus`; `Escape` ปิดตัวซ้อนก่อนแล้วจึงปิดหน้าต่าง |
| **ตารางใน modal** | ห่อด้วย `.xxx-table-wrap { overflow-x: auto; border: 1px; border-radius: 8px }` + `min-width` ของตาราง (`760–960px`) เพื่อไม่ให้คอลัมน์ถูกบีบ; หัวตารางพื้น `--bg-subtle` |
| **Grid ในการ์ด** | จำนวนช่องต้องสมมาตร: Vitals 9 ค่า → `repeat(3, 1fr)` (3×3), Notes 4 ใบ → `repeat(2, 1fr)` (2×2); ถ้าจำนวนเป็นคี่ใน 2 คอลัมน์ ให้ช่องสุดท้ายกินเต็มแถว `.grid > :last-child:nth-child(odd) { grid-column: 1 / -1 }` |
| **โครงเนื้อหา Clinical Drill-down (VN/Visit)** | 3 แท็บ: `ซักประวัติและสัญญาณชีพ` (lucide `Stethoscope`) / `การวินิจฉัยโรค` (`ClipboardList`) / `รายการยาและค่ารักษา` (`Pill`) — ไม่ต้องใส่ชื่อตาราง HOSxP ในแท็บ (opdscreen/ovstdiag/opitemrece) |
| **แถบสรุปการเงินในหน้าต่าง** | 3 ยอด (ยอดรวม / ลูกหนี้สิทธิ / ชำระเอง) label `13px` เทา + ตัวเลข `20px mono 600` + sub `13px` — **ห้ามใช้ 3 สีแยกยอด** (ใช้หมึกเดียวกันทั้งหมด, เงินทศนิยม 2 ตำแหน่ง); มือถือยุบเป็น 1 แถวต่อยอด (label ซ้าย / ตัวเลขขวา) |
| **ชิปกรองหมวดรายการ** | ชิปมุม `6px` สูง `44px` + จำนวนในชิป (`13px`, พื้น `--bg-subtle`), active = ขอบ `--primary` + พื้น `--primary-subtle`; ไม่ใช้ `border-radius: 9999px` กับชิปกรอง |

---

## 8. Gotchas ที่เคยพลาดจริง (อ่านก่อนแก้รอบถัดไป)

| อาการ | สาเหตุ | วิธีที่ถูก |
|---|---|---|
| แถบแท็บ/หัว modal หายหรือเตี้ยผิดปกติ เนื้อหาดูทับกัน | header/tabs/footer เป็น flex item ที่ถูกบีบเมื่อชน `max-height` | `flex: 0 0 auto` ให้ 3 ชั้นนั้น + `min-height: 0` ที่ body (§7.1) |
| เลื่อนใน modal แล้วหน้าเว็บด้านหลังเลื่อนตาม | scroll chaining + ล็อกแค่ `body` | `overscroll-behavior: contain` + ล็อก `html` และ `body` |
| Empty State / "ไม่พบผลลัพธ์" ไปโผล่ชิดขวาของตาราง | วาง state ไว้ใน `<td colSpan={N}>` ของตารางที่กว้างเกินจอ → เนื้อหาถูกจัดกึ่งกลางจากความกว้างทั้งตาราง (ซึ่งล้นออกนอกจอ) | วาง state **นอก**ตาราง (`.xxx-table-state` แทนที่ตารางทั้งก้อนเมื่อไม่มีแถว) |
| การ์ดสรุปเรียงแถวแล้วมีช่องแหว่ง (เช่น 7 ใบในแถวเดียว + 2 ใบล่าง) | `repeat(auto-fill, minmax(...))` ปล่อยให้จำนวนคอลัมน์ลอยตัว | กำหนดจำนวนคอลัมน์ให้เป็นตัวหารของจำนวนการ์ด (`repeat(3, 1fr)`) หรือเติมชิปให้เต็มแถว |
| สลับแท็บแล้วหน้าต่างกระโดด (สูง/ต่ำเปลี่ยน) | ความสูงตามเนื้อหา (`height: auto` + `max-height`) | เลือกอย่างใดอย่างหนึ่งแล้วทดสอบทุกแท็บ: ปล่อยความสูงตามเนื้อหา (แท็บสั้นกระชับ) หรือตรึง `height` (ไม่กระโดดแต่แท็บสั้นเหลือที่ว่าง) — ค่าเริ่มต้นของโปรเจกต์คือ **ความสูงตามเนื้อหา + `max-height`** |
| ตัวเลข/เงินในคอลัมน์ไม่ตรงหลัก | ไม่มี `tabular-nums` หรือทศนิยมไม่คงที่ | `font-variant-numeric: tabular-nums` + `minimumFractionDigits: 2, maximumFractionDigits: 2` |
| ไฟล์ภาษาไทยเพี้ยน (mojibake) หลังแก้ด้วยสคริปต์ | round-trip ไฟล์ UTF-8 ผ่าน PowerShell `Get-Content`/`Set-Content` (อ่านเป็น ANSI) | ใช้เครื่องมือ `edit` ของ harness หรืออ่าน/เขียนด้วย `[System.IO.File]::ReadAllText/WriteAllText(path, [Text.Encoding]::UTF8)` เท่านั้น |
