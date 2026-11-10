# แผนงาน Refactor UX/UI — โรงพยาบาลเถิน
> มาตรฐาน: `ui-style-brief` (Quiet Chrome · Rich Content · 9-Pass · Off-Black · 4px Grid · Anti-Slop)
> อ้างอิงต้นแบบ: `pc-3/page.css` + `VnDetailModal.css/tsx`

---

## วิธีอ่านแผนนี้

| สัญลักษณ์ | ความหมาย |
|---|---|
| 🔴 **MUST** | ต้องแก้ก่อนใช้งานจริง (Slop/Token ผิด/Accessibility พัง) |
| 🟡 **SHOULD** | ควรแก้ใน Sprint เดียวกัน (ส่งผลต่อ Q-Score) |
| 🟢 **NICE** | ปรับปรุงคุณภาพเพิ่มเติม (ทำได้ทีหลัง) |
| **ทุกหน้า** | ใช้กับทุกหน้าที่ยังไม่ถูกแก้ |

---

## 🌐 ทุกหน้า — Global Issues (แก้ก่อนลงรายละเอียด)

### Pass 1 · Spacing
- 🔴 `service/page.css`, `screening/page.css`, `ward-status/page.css`, `lab/page.css` ใช้ค่า px ตรงๆ นอกสเกล (1.25rem = 20px ✓ แต่ 1.45rem, 0.9rem, 2.25rem = ค่าเศษ) → เปลี่ยนเป็น `var(--space-*)` จาก tokens.md ทุกจุด
- 🔴 `service/page.css` padding บน: `calc(var(--navbar-height, 72px) + 8px)` → ค่า `8px` ไม่อยู่บนสเกล เปลี่ยนเป็น `var(--space-2)` (8px)

### Pass 2 · Color & Token
- 🔴 หลายไฟล์ CSS ประกาศตัวแปรสีซ้ำซ้อนนอก `globals.css`:
  - `kpi-tracker.css` → `:root { --bg: #F4F7F6; --accent: #0F6B63; ... }` (เขียวต่างจาก brand `#0D7446`)
  - `screening/page.css` → `font-family: 'IBM Plex Sans Thai'` (ไม่ใช่ Sarabun)
  - `service/page.css` → `font-family: 'IBM Plex Sans Thai'` + `color: #10231c` (ไม่ใช่ Off-black token)
  - `ward-status/page.css` → `background-color: #f8fafc` (Tailwind gray ไม่ใช่ `var(--bg-main)`)
  - `lab/page.css` → `background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)` (Gradient หลักต้องพื้นแบน)
  - **แนวทาง:** ลบ local `:root` ทุกอัน → ใช้ token จาก `globals.css` เท่านั้น

- 🔴 **Off-Black Rule:** `lab/page.css` → `.lab-search-title { color: #0f172a }` (Tailwind slate-900 ไม่ใช่ `--gray-900 #111E14`) — เปลี่ยนทุกจุดในโปรเจกต์

### Pass 3 · Typography
- 🔴 ห้ามใช้ `font-family: 'IBM Plex Sans Thai'` — ฟอนต์หลักต้องเป็น `Sarabun` / `var(--font-family)` เท่านั้น (พบใน screening, service, kpi-tracker)
- 🔴 `kpi-tracker.css` → `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai...')` → ลบ Google Fonts import ออก (ใช้ self-hosted Sarabun)
- 🟡 `font-weight: 800` หลายหน้า → ลดเป็น `700` สูงสุด (ตามมาตรฐาน: 400/500/600/700)

### Pass 7 · Anti-Slop (ทุกหน้า)
- 🔴 `transition: all var(--dur-fast) var(--ease-out)` พบในหลายไฟล์ → ระบุ property ชัดเจนเสมอ (เช่น `background-color 150ms, border-color 150ms`)
- 🔴 `transform: translateY(-2px)` / `hover:scale(1.05)` บนการ์ด → ห้ามการ์ดขยับขึ้น (เด้งดิ้น) ให้ใช้เฉพาะ `border-color` + `box-shadow` เปลี่ยน

---

## 📄 หน้าหลัก (`/`) — `src/app/page.tsx` + `page.css`

### ✅ สิ่งที่ดีอยู่แล้ว
- ใช้ token ถูก (`var(--primary)`, `var(--gray-*)`, spacing scale ถูกต้อง)
- Responsive ครบ, `touch-target` ถูก
- Typography hierarchy สมเหตุสมผล

### 🔧 สิ่งที่ต้องแก้

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P1 | Service card `hover: transform: translateY(-2px)` → ตัดออก เพิ่ม `box-shadow: var(--shadow-hover)` แทน | 🔴 |
| P2 | CTA section: `background: linear-gradient(135deg, #063d2e 0%, #0c6e55 60%, #094738 100%)` → ยอมรับได้ (CTA section เป็น brand accent zone พิเศษ ไม่ใช่ Gradient แฟนซี) อนุมัติให้คงไว้ | 🟢 |
| P2 | `service-card__icon-wrap` → `hover: scale(1.05)` → ตัดออก (ห้าม scale บนการ์ด) | 🔴 |
| P4 | `service-card__icon-wrap`: กล่องไอคอนสีพาสเทลบนการ์ดทุกใบ → ลดสีลง ใช้ `color: var(--gray-500)` ไอคอนเรียบ ไม่ใส่กล่องสีเขียว (Quiet Chrome: ไอคอนไม่ควรดังกว่าข้อมูล) | 🟡 |
| P7 | `.cta__badge` Pill ลอยเหนือ H2 (CTA section) → ยอมรับได้ (เป็น section พิเศษ ไม่ใช่หัวหน้า) | 🟢 |
| P7 | `.service-card__action { font-weight: 600; color: var(--primary) }` → ทำให้การ์ดมีจุดเด่นสีเขียว 2 จุด (icon + action) → เลือกอย่างใดอย่างหนึ่ง ตัดสีเขียวออกจาก action text หรือ icon | 🟡 |
| P9 | `news-forum-row:hover { transform: translateY(-1px) }` → ตัดออก | 🔴 |
| P9 | `org-link-badge:hover { transform: translateY(-1px) }` → ตัดออก | 🔴 |

---

## 📄 หน้าตรวจสอบนัดหมาย (`/check-date`) — `CheckDateClientView.tsx` + `page.css`

### ✅ สิ่งที่ดีอยู่แล้ว
- 4 States ครบ (Empty, Loading, Error, Result)
- PHI Mask ถูก (แสดง 4 หลักท้าย เหมาะสำหรับหน้าสาธารณะ)
- Token ส่วนใหญ่ถูกต้อง

### 🔧 สิ่งที่ต้องแก้

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P1 | `.dateBlockHeader { font-size: 10px; padding: 4px 0 }` → ขนาดต่ำกว่า 13px ห้าม → เปลี่ยนเป็น `12px` หรือ `var(--font-size-xs)` (13px) | 🔴 |
| P2 | `.appointmentCardItem.upcoming { border-left: 4px solid var(--primary) }` → **ห้ามแถบสีหนาด้านซ้าย** → เปลี่ยนเป็น `border: 2px solid var(--primary)` รอบกล่อง + `background: var(--primary-subtle)` | 🔴 |
| P2 | `.appointmentCardItem.past { border-left: 4px solid var(--gray-400) }` → แก้เหมือนกัน | 🔴 |
| P2 | `.dateBlockHeader { text-transform: uppercase; letter-spacing: 0.05em }` → ห้ามตัวพิมพ์ใหญ่ห่างๆ บนภาษาไทย → ตัดออก | 🔴 |
| P2 | `.statusBadge--upcoming { background: #E8F5E9; color: #2E7D32 }` → เปลี่ยนเป็น `var(--success-bg)`, `var(--success)` | 🟡 |
| P3 | `.dateBlock__day { font-weight: 800 }` → ลดเป็น `600` | 🟡 |
| P7 | `.pulseDot { animation: pulseAnimation }` → ห้าม `animate-pulse` บนสถานะที่ไม่ใช่ Skeleton โหลด → เปลี่ยนเป็นจุดสีเขียว static | 🔴 |
| P9 | `.appointmentCardItem:hover { transform: translateY(-2px) }` → ตัดออก | 🔴 |

---

## 📄 หน้า `/service` (Service Portal) — `page.tsx` + `page.css`

### 🔧 สิ่งที่ต้องแก้

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P2 | `font-family: 'IBM Plex Sans Thai'` → เปลี่ยนเป็น `var(--font-family)` | 🔴 |
| P2 | `color: #10231c` → เปลี่ยนเป็น `var(--gray-900)` | 🔴 |
| P2 | `.serviceKicker { text-transform: uppercase; letter-spacing: 0.08em }` → ลบคลาสนี้และ HTML ที่ใช้ (Q7 Anti-Slop: ห้าม Eyebrow uppercase) | 🔴 |
| P4 | `.iconWrapper` ใน serviceCard → ไอคอนอยู่ในกล่องสีพาสเทลทุกการ์ด → ทำให้ Quiet Chrome: ใช้ `color: var(--gray-500)` ไม่มีกล่องพื้นสี หรือถ้ามีกล่องให้ใช้ `--bg-subtle` ไม่ใช่สีเขียว | 🟡 |
| P5 | จำนวนการ์ดในแต่ละหมวดอาจไม่สมมาตร → ตรวจและล็อกจำนวนคอลัมน์ให้หารลงตัว | 🟡 |

---

## 📄 หน้าผลแล็บ (`/service/lab`) — `LabSearchClient.tsx` + `page.css`

### 🔧 สิ่งที่ต้องแก้

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P1 | `.lab-search-page { padding-bottom: 6rem }` → 6rem = 96px ไม่อยู่บนสเกล → เปลี่ยนเป็น `var(--space-12)` (48px) หรือ `calc(var(--space-12) * 2)` | 🟡 |
| P2 | `background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)` → เปลี่ยนเป็นพื้นแบน `var(--bg-main)` | 🔴 |
| P2 | `.lab-search-badge` Eyebrow Pill ลอยเหนือหัวข้อ → ลบออก (Q7: ห้าม Eyebrow Pill) | 🔴 |
| P2 | `.lab-search-title { color: #0f172a }` → เปลี่ยนเป็น `var(--gray-900)` | 🔴 |
| P2 | `.lab-search-subtitle { color: #475569 }` → เปลี่ยนเป็น `var(--gray-500)` | 🟡 |
| P2 | `.search-box { border-radius: 18px; border: 1.5px }` → เปลี่ยน radius เป็น `var(--radius-lg)` (16px), border เป็น `1px solid var(--gray-200)` | 🟡 |
| P3 | `.lab-search-title { font-weight: 800; letter-spacing: -0.5px }` → ลด weight เป็น `700` และ ตัด letter-spacing ออก (ห้าม tracking ติดลบกับภาษาไทย) | 🔴 |
| P5 | ตรวจสอบ Detail Modal (ถ้ามี) ว่าใช้โครง flex 4 ชั้นถูกต้อง | 🟡 |

---

## 📄 Lab Tracker (`/service/lab-tracker`) — `LabTrackerClient.tsx` + `page.css`

> *ต้องอ่านไฟล์ก่อนเริ่มแก้ — หน้านี้ยังไม่ได้สำรวจแบบ full scan*

### 🔧 สิ่งที่ต้องแก้ (ตาม pattern เดียวกับ `/service/lab`)

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P2 | ตรวจ local color token / font-family ที่ไม่ใช่ globals | 🔴 |
| P6 | ตรวจหัวตาราง: แถวเดียว + ทุกช่องกึ่งกลาง, sticky `--bg-subtle` | 🟡 |
| P6 | ตรวจ Empty State: ต้องอยู่นอกตาราง ไม่ใช่ใน `<td colSpan>` กว้าง | 🔴 |
| P9 | ตรวจ Responsive: มือถือแปลงตารางเป็น Card View ครบหรือยัง | 🟡 |

---

## 📄 TB-CXR Tracker (`/service/tb-cxr-tracker`) — `TbCxrTrackerClient.tsx` + `page.css`

> *pattern เดียวกับ lab-tracker — ต้องอ่านไฟล์ก่อน*

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P2 | ตรวจ local token / font | 🔴 |
| P6 | หัวตาราง, alignment, sticky header | 🟡 |
| P6 | Empty State position | 🔴 |

---

## 📄 KPI Tracker (`/service/kpi-tracker`) — `KpiTrackerClient.tsx` + `kpi-tracker.css`

### 🔧 สิ่งที่ต้องแก้ (Critical — Token divergence ชัดมาก)

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P2 | ลบ local `:root { --bg, --accent, --ink, ... }` ทั้งหมดออก → แมปกับ globals.css token: `--bg → var(--bg-main)`, `--accent → var(--primary)`, `--ink → var(--gray-900)`, `--ink-muted → var(--gray-500)`, `--border → var(--gray-200)` | 🔴 |
| P2 | `--accent: #0F6B63` ≠ brand `#0D7446` → ใช้ `var(--primary)` | 🔴 |
| P2 | ลบ `@import url('https://fonts.googleapis.com/...')` → ใช้ Sarabun self-hosted | 🔴 |
| P3 | ตรวจ font-family ทุก rule → เปลี่ยนเป็น `var(--font-family)` | 🔴 |
| P5 | ตรวจ KPI Cards: กล่องไอคอนสีพาสเทลทุกใบ → ลด visual noise ลง | 🟡 |
| P6 | ตรวจตาราง KPI: sort icon, alignment, empty state | 🟡 |

---

## 📄 Screening Dashboard (`/service/screening`) — `ScreeningDashboardClient.tsx` + `page.css`

### 🔧 สิ่งที่ต้องแก้ (Critical — Header gradient + font ผิด)

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P2 | `.screeningHeaderCard { background: linear-gradient(135deg, #065f46 0%, #047857...) }` → Header card สีรุ้งเขียวเข้ม → เปลี่ยนเป็น `background: var(--bg-surface); border: 1px solid var(--gray-200)` ธรรมดา | 🔴 |
| P2 | `.screeningIconBadge { color: #fef08a }` (เหลือง) บนพื้นเขียวเข้ม → ลบ icon badge สีพิเศษออก | 🔴 |
| P2 | `font-family: 'IBM Plex Sans Thai'` → เปลี่ยนเป็น `var(--font-family)` | 🔴 |
| P2 | `background-color: #f8fafc` → เปลี่ยนเป็น `var(--bg-main)` | 🔴 |
| P2 | `color: #1e293b` → เปลี่ยนเป็น `var(--gray-900)` | 🔴 |
| P3 | `.screeningTitleSection h1 { color: #fef08a }` (เหลือง) → ถ้าแก้ header แล้ว เปลี่ยนเป็น `var(--gray-900)` | 🔴 |
| P5 | ตรวจ Status Chip / Filter Chips สมมาตรไหม | 🟡 |
| P6 | ตรวจตาราง screening: alignment ผู้ป่วย, empty state | 🟡 |

---

## 📄 Ward Status (`/service/ward-status`) — `WardStatusClient.tsx` + `page.css`

### 🔧 สิ่งที่ต้องแก้

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P2 | `background-color: #f8fafc` → เปลี่ยนเป็น `var(--bg-main)` | 🔴 |
| P2 | `.wardIconBadge { background: #ecfdf5; color: #059669 }` → กล่องไอคอนสีพาสเทลบน Header → ลดลง ใช้ `var(--bg-subtle)` + `var(--primary)` | 🟡 |
| P2 | `.wardHeaderCard { border: 1px solid #e2e8f0 }` → เปลี่ยนเป็น `var(--gray-200)` | 🟡 |
| P2 | `.wardTitleSection h1 { color: #0f172a }` → เปลี่ยนเป็น `var(--gray-900)` | 🔴 |
| P2 | `.wardSubtitle { color: #64748b }` → เปลี่ยนเป็น `var(--gray-500)` | 🟡 |
| P2 | `.wardStatusPage { transition: all 0.3s ease }` → ห้าม transition: all → ระบุ property | 🔴 |
| P5 | ตรวจ Ward Section: `badgeColor`, `accentColor` ที่ส่งมาใน data → ต้องอิงกับ semantic token ไม่ใช่สีแข็ง | 🟡 |

---

## 📄 Status Drug (`/service/status-drug`) — `StatusDrugClient.tsx` + `page.css`

> *ต้องอ่านไฟล์ก่อน — pattern เดียวกับ ward-status*

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P2 | ตรวจ local color / font / gradient | 🔴 |
| P6 | ตรวจตาราง dispensing: alignment, sticky header | 🟡 |

---

## 📄 Loratadine Dispense (`/service/loratadine-dispense`) — `LoratadineDispenseClient.tsx` + `page.css`

> *ต้องอ่านไฟล์ก่อน*

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P2 | ตรวจ local token | 🔴 |
| P6 | ตาราง monitor: alignment, tabular-nums สำหรับตัวเลข | 🟡 |

---

## 📄 MOK (`/service/mok`) — `MokClient.tsx` + `page.css`

> *ต้องอ่านไฟล์ก่อน*

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P2 | ตรวจ local token | 🔴 |
| P6 | ตรวจตาราง | 🟡 |

---

## 📄 Outgoing Document (`/service/outgoing-document`) — `OutgoingDocClient.tsx` + `page.css`

> *ต้องอ่านไฟล์ก่อน*

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P2 | ตรวจ local token / font | 🔴 |
| P5 | Form layout: label บน input เสมอ, gap 20px | 🟡 |
| P6 | ถ้ามีตาราง: ตรวจ alignment | 🟡 |

---

## 📄 Screening Scan (`/service/screening/scan`) — `ScreeningScanClient.tsx` + `page.css`

> *ต้องอ่านไฟล์ก่อน — หน้า SmartCard reader*

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P2 | ตรวจ local token | 🔴 |
| P5 | ตรวจ Layout: SmartCard reader UI ตรงไปตรงมาหรือยัง | 🟡 |
| P9 | Touch target ≥ 44px ทุกปุ่ม (สำคัญสำหรับ tablet) | 🔴 |

---

## 📄 ER In Status (`/service/er-in-status`) + TV Mode — `page.tsx` + `page.css`

> *TV Mode — ดูบนหน้าจอขนาดใหญ่*

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P2 | ตรวจ token: TV mode อาจมีสีแข็ง | 🔴 |
| P9 | ตรวจ Motion: TV mode ต้องไม่มี `animate-pulse` ที่ไม่ใช่ Skeleton | 🟡 |

---

## 📄 `/systems` — Systems Hub + Sub-pages

### `/systems` (index) — `SystemsClientView.tsx` + `page.css`
### `/systems/ward-status` — `WardStatusPublicClient.tsx` + `page.css`
### `/systems/er-out-status` — `page.tsx` + `page.css`
### `/systems/status-or` — `StatusOrClient.tsx` + `page.css`
### `/systems/e-office-status` — `EOfficeStatusClient.tsx` + `page.css`

> *ต้องอ่านทุกไฟล์ก่อน — pattern แนวเดียวกับ /service sub-pages*

| Pass | จุดแก้ (ทุกหน้าใน /systems) | ระดับ |
|---|---|---|
| P2 | ตรวจ local token / hard-coded สี / font ที่ไม่ใช่ Sarabun | 🔴 |
| P9 | ตรวจ Motion: ห้าม `transition: all` | 🔴 |
| P9 | ตรวจ Responsive: Touch target ≥ 44px | 🔴 |

---

## 📄 RCM Dashboard (`/service/dashboard-rcm`) — ทุกหน้าย่อย

> หน้าเหล่านี้มีต้นแบบที่ดีที่สุดในโปรเจกต์ (`pc-3`) — ใช้เป็น Reference แล้ว ตรวจ Consistency กับหน้าอื่นๆ

### หน้า RCM ที่ต้องตรวจ (ไม่ใช่แก้ใหม่ แต่ตรวจว่าใช้ token ถูกครบหรือยัง)

| หน้า | จุดตรวจ |
|---|---|
| `palliative-care/pc-3` | ✅ Reference — ใช้เป็นต้นแบบ |
| หน้า RCM อื่นๆ | ตรวจ Single-Row Date Ribbon ครบหรือยัง |
| ทุก VN Modal | ตรวจ flex 4 ชั้น: `flex: 0 0 auto` สำหรับ header/tabs/footer, `min-height: 0` สำหรับ body |
| ทุกตาราง RCM | ตรวจ Empty State: อยู่นอก `<td colSpan>` |

---

## 📄 `/member` — Member Portal (Staff)

### `/member` (Dashboard) — `MemberDashboardClient.tsx` + `page.css`

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P2 | ตรวจ local token | 🔴 |
| P5 | ProfileBanner: ตรวจ Layout สมมาตร | 🟡 |
| P7 | ตรวจ Copy: ห้าม Emoji ในระบบ, ไร้เลขลำดับนำหน้า | 🔴 |

### `/member/news/news` — News Admin + Create/Edit

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P5 | Form: label บน input, gap สม่ำเสมอ | 🟡 |
| P6 | ถ้ามีตาราง: alignment ครบ | 🟡 |

### `/member/member` — Members Admin

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P6 | ตาราง member: alignment ผู้ใช้, sticky header, sort icon inline | 🟡 |
| P6 | Empty State นอก `<td colSpan>` | 🔴 |

### `/member/registrations` — Registration Admin

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P6 | ตาราง + filter chips: สมมาตร, sticky header | 🟡 |
| P9 | 4 States ครบ (Empty, No Results, Loading Skeleton, Error) | 🟡 |

### `/member/outgoing-document` — Outgoing Doc Admin

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P5 | Form layout: label บน, gap 20px | 🟡 |
| P6 | ถ้ามีตาราง: alignment | 🟡 |

### `/member/upload-salary` — Upload Salary

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P2 | ตรวจ local token | 🔴 |
| P5 | Upload UI: Drop zone ใหญ่พอ, touch-friendly | 🟡 |

### `/member/signature`, `/member/repairs/new`, `/member/rdu`, `/member/settings`, `/member/organization`

| Pass | จุดแก้ (ทุกหน้าใน /member) | ระดับ |
|---|---|---|
| P2 | ตรวจ local token / font | 🔴 |
| P5 | Form: label บน input, gap 20px | 🟡 |
| P7 | ห้าม Emoji ใน label/heading | 🔴 |

---

## 📄 News (`/news`, `/news/[id]`) — Public Pages

> *ต้องอ่านไฟล์ก่อน*

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P2 | ตรวจ local token / gradient | 🔴 |
| P3 | ตรวจ typography: `font-weight` ไม่เกิน `700`, `font-style: normal` (ห้าม italic) | 🟡 |
| P7 | ตรวจ Copy: ห้าม Pill ลอยเหนือ H1 | 🔴 |

---

## 📄 Components — Global Shared

### `Navbar.css` / `Navbar.tsx`

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P9 | ตรวจ Mobile nav: Touch target ≥ 44px ทุกลิงก์ | 🟡 |
| P2 | Navbar ใช้ Token ถูก (พื้น `rgba(255,255,255,0.94)`) — ✅ รับได้ | 🟢 |

### `Footer.css` / `Footer.tsx`

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P2 | `background: linear-gradient(180deg, var(--primary-dark), #063D25)` → Footer gradient รับได้ (Brand zone) | 🟢 |

### `Breadcrumb.tsx`

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P5 | ตรวจ Breadcrumb: ข้อความเรียบ ไม่มี Pill, สี `var(--gray-500)`, ขนาด `≥ 44px` | 🟡 |

### `ConfirmDialog.tsx`

| Pass | จุดแก้ | ระดับ |
|---|---|---|
| P5 | ตรวจ โครง flex 4 ชั้น: header/body/footer pin ถูกต้อง | 🟡 |
| P7 | ตรวจ ปุ่ม Destructive: ใช้ `var(--danger-bg)` + `var(--danger)` | 🟡 |

---

## 📄 `/terms-of-use`, `/unauthorized`, `/contact`, `/about` — Public Info Pages

| Pass | จุดแก้ (ทุกหน้าสาธารณะ) | ระดับ |
|---|---|---|
| P2 | ตรวจ local token / font | 🔴 |
| P3 | Line-height ≥ 1.65 สำหรับ body text ภาษาไทย | 🟡 |
| P7 | ห้าม Eyebrow Pill เหนือ H1, ห้ามเลขลำดับนำหน้าหัวข้อ | 🔴 |

---

## ลำดับการทำงานแนะนำ (Priority Queue)

```
Sprint 1 (Critical Token Fix)
├── globals.css → ตรวจว่า token ครบ (ต้องมี --bg-main, --bg-surface, --bg-subtle, semantic status colors)
├── kpi-tracker.css → ลบ local :root + Google Fonts import
├── screening/page.css → แก้ header gradient + font
├── service/page.css → แก้ font + serviceKicker uppercase
└── lab/page.css → แก้ gradient + badge + letter-spacing

Sprint 2 (Anti-Slop Pass)
├── ทุกหน้า → ลบ transform: translateY(-2px/-1px) บนการ์ด
├── ทุกหน้า → ลบ hover:scale บน icon-wrap
├── ทุกหน้า → เปลี่ยน transition:all → transition: specific props
├── check-date → แก้ border-left 4px + pulseDot animation
└── lab → แก้ Eyebrow Pill badge

Sprint 3 (Table & Modal Craft)
├── ทุกตาราง → ตรวจ sticky header, alignment, sort icon
├── ทุกตาราง → ย้าย Empty State ออกนอก <td colSpan>
├── ทุก Modal → ตรวจ flex 4 ชั้น
└── RCM pages → ตรวจ Single-Row Date Ribbon ครบ

Sprint 4 (Typography & States)
├── ทุกหน้า → ตรวจ font-weight ไม่เกิน 700
├── ทุกหน้า → ตรวจ Off-Black (#0f172a → var(--gray-900), #475569 → var(--gray-500))
├── ทุกหน้า → ตรวจ 4 States ครบ
└── mobile → ตรวจ Card View บน < 768px
```

---

## Checklist ก่อนถือว่าหน้าผ่าน (Template Test)

> *"ถ้าเอาชื่อโรงพยาบาลออก หน้านี้ยังดูเป็นเทมเพลตทั่วไปหรือไม่?"*

- [ ] ไม่มี gradient หลักในพื้นหน้า
- [ ] ไม่มี gradient header card
- [ ] ไม่มี Eyebrow Pill ลอยเหนือ H1
- [ ] ไม่มีตัวเลขลำดับนำหน้าชื่อเมนูหรือหัวข้อ
- [ ] ไม่มี font-family ที่ไม่ใช่ Sarabun
- [ ] ไม่มี local :root token ซ้ำซ้อนนอก globals.css
- [ ] ไม่มี transition: all
- [ ] ไม่มี transform: translateY(-Npx) บนการ์ด hover
- [ ] ไม่มี animate-pulse บนสถานะที่ไม่ใช่ Skeleton
- [ ] ไม่มี border-left 4px สี บนการ์ด
- [ ] ไม่มี font-size ต่ำกว่า 13px
- [ ] ไม่มี font-weight > 700 (ยกเว้น H1 บางหน้า)
- [ ] ไม่มี text-transform: uppercase บนภาษาไทย
- [ ] ไม่มี letter-spacing กว้างบน Thai text
- [ ] Empty State อยู่นอก `<td colSpan>`
- [ ] หัวตาราง: แถวเดียว + ทุกช่องกึ่งกลาง + sticky
- [ ] PHI Mask ถูกต้องตามบริบท (4 หลักท้ายบนหน้าสาธารณะ, เต็มบน RCM)
- [ ] วันที่ทุกจุดแสดงเป็น พ.ศ. ไทย
