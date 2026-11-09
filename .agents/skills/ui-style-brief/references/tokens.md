# Design Tokens & CSS Variables — โรงพยาบาลเถิน

อ้างอิงตัวแปรจาก `src/app/globals.css` เพื่อให้ต้นแบบและโค้ดจริงใช้โทเคนชุดเดียวกัน 100%

---

## 1. Quiet Neutral Ramp, Tactile Surfaces & Off-Black

**หลักการ OpenDesigner:** พื้นหลังและกรอบนำทางต้องสงบ (Quiet Chrome) เพื่อให้ข้อมูลทางคลินิกและสถานะเป็นตัวนำสายตา
ใช้หมึก Off-Black เพื่อความคมชัดโดยไม่สร้างความล้าสายตา (ห้ามใช้สีดำสนิท `#000000` บนขาว)

### 1.1 Tactile Surface Levels (ลำดับขั้นพื้นผิว)

| ระดับพื้นผิว | Token | ค่าสี HEX | บทบาทการใช้งาน |
|---|---|---|---|
| **Level 0 (Page Ground)** | `var(--bg-main)` | `#FAFCFB` | พื้นหลังหลักของหน้า อมเขียวจางลดแสงจ้าเมื่อจ้องทั้งวัน |
| **Level 1 (Surface/Card)** | `var(--bg-surface)` | `#FFFFFF` | พื้นผิวการ์ด ตาราง แผงควบคุม และโมดอล (ขอบ 1px) |
| **Level 2 (Toolbar/Header)** | `var(--bg-subtle)` | `#F4F7F5` | หัวตาราง แถบสรุป แถบเครื่องมือ ช่องกรอกแบบอ่านอย่างเดียว |
| **Level 3 (Selection/Hover)** | `var(--primary-subtle)` | `#F0FDF4` | พื้นแถวตารางที่เลือก/hover และการ์ดที่ถูกกรอง |

### 1.2 Off-Black Typography Ramp (หมึกข้อความ)

| บทบาทข้อความ | Token | ค่าสี HEX | อัตราส่วน Contrast บนขาว | การใช้งาน |
|---|---|---|---|---|
| **Primary Ink** | `var(--gray-900)` | `#111E14` | ~15.2:1 | หัวข้อเรื่อง (`H1`, `H2`), ข้อความสำคัญ, ตัวเลข KPI |
| **Secondary Ink** | `var(--gray-700)` | `#334237` | ~9.8:1 | ข้อความทั่วไป, คำอธิบายคอลัมน์, ป้ายกำกับตัวกรอง |
| **Muted Ink** | `var(--gray-500)` | `#6B7B70` | ~4.7:1 (>= 4.5:1 AA) | คำอธิบายย่อย, หน่วยนับ, เวลาอ้างอิง, Breadcrumb |

### 1.3 Borders & Brand Accent

| Token | ค่าสี HEX | บทบาทการใช้งาน |
|---|---|---|
| `var(--gray-200)` | `#E2E8E4` | **Hairline Border:** เส้นขอบการ์ด 1px, ขอบ input (หรือ `rgba(17, 30, 20, 0.08)`) |
| `var(--gray-100)` | `#F1F5F3` | เส้นคั่นแถวในตาราง (Row divider) |
| `var(--primary)` | `#0D7446` | **Single Brand Accent:** ปุ่ม Primary 1 ปุ่ม, แท็บที่เลือก, Focus ring, จุดเน้นหลักในกราฟ |
| `var(--primary-hover)` | `#0B633C` | สี hover ของปุ่มหลัก |
| `var(--primary-dark)` | `#095C38` | สี active ขณะกด และข้อความบนพื้น `--primary-light` |
| `var(--primary-light)` | `#E8F5E9` | พื้นหลังสถานะเลือกเบาๆ หรือปุ่มรองเน้นขอบเขต |
| `var(--accent-gold-dark)` | `#8C6D1F` | สีทองเข้มสำหรับเน้นตราสัญลักษณ์หรือข้อความพิเศษ (คอนทราสต์ `>= 4.5:1`) |

---

## 2. สีสื่อความหมาย (Semantic Status — 1 สี = 1 ความหมาย)

ทุกสถานะต้องมีข้อความกำกับชัดเจนเพื่อรองรับผู้ที่มีภาวะตาบอดสี

| สถานะ | พื้นหลัง | ตัวอักษร | เส้นขอบ | การใช้งาน |
|---|---|---|---|---|
| **สำเร็จ / ชดเชยแล้ว** | `var(--success-bg)` (`#DCFCE7`) | `var(--success)` (`#15803D`) | `var(--success-border)` (`#86EFAC`) | เสร็จสิ้น, ชดเชยแล้ว, มี Authen, ออนไลน์ |
| **เตือน / รอดำเนินการ** | `var(--warning-bg)` (`#FEF3C7`) | `var(--warning)` (`#B45309`) | `var(--warning-border)` (`#FDE68A`) | รอชดเชย, รอตรวจ, ข้อมูลไม่ครบ, เคลมซ้ำ |
| **เสี่ยง / ผิดพลาด / ยกเลิก** | `var(--danger-bg)` (`#FEE2E2`) | `var(--danger)` (`#B91C1C`) | `var(--danger-border)` (`#FCA5A5`) | ปฏิเสธ, ยกเลิก, Error code, ไม่อนุมัติ |
| **ข้อมูล / ชี้แจง** | `var(--info-bg)` (`#E0F2FE`) | `var(--info)` (`#0369A1`) | `var(--info-border)` (`#BAE6FD`) | คำแนะนำระบบ, เอกสารอ้างอิง |

---

## 3. Typography (Sarabun & Hierarchical Restraint)

**หลักการ:** สร้างลำดับชั้นด้วยขนาดและโทนสีหมึก (`--gray-900/700/500`) แทนการใส่ตัวหนา `700–900` พร่ำเพรื่อ

| บทบาท | ขนาด | น้ำหนักแนะนำ | รายละเอียด |
|---|---|---|---|
| **ฟอนต์หลัก** | `var(--font-family)` | `400, 500, 600` | Sarabun; อักษรปกติไม่ใช้ `italic` และไม่บีบ tracking |
| **หัวข้อหน้า (`H1`)** | `1.5rem - 1.875rem` (24–30px) | `600` (หรือ `700` เฉพาะหน้าหลัก) | `line-height: 1.35`, สี `--gray-900` |
| **หัวข้อส่วนย่อย (`H2`)** | `1.125rem - 1.25rem` (18–20px) | `600` | สี `--gray-900` |
| **ตัวเลข KPI เด่น** | `1.5rem - 2rem` (24–32px) | `600` | บังคับ `font-variant-numeric: tabular-nums` |
| **ข้อความหลัก (Body)** | `1rem` (16px) | `400` | `line-height: 1.65 - 1.7` (กันสระไทยซ้อน) |
| **ตาราง / ป้ายกำกับ (SM)** | `0.875rem` (14px) | `400` (ข้อมูล) / `500` (หัวตาราง/label) | ห้ามทำตัวพิมพ์ใหญ่ห่างๆ (`letter-spacing > 0.02em`) |
| **ข้อมูลย่อยสุด (XS)** | `0.8125rem` (13px) | `400 - 500` | **ห้ามเล็กกว่า 13px** และห้ามใช้ negative tracking |

---

## 4. Spacing Scale (Strict 4px Grid)

ห้ามใช้ค่าเศษอย่าง `7px`, `11px`, `13px`, `19px`

| Token | ค่า | การใช้งานมาตรฐาน |
|---|---|---|
| `var(--space-1)` | `4px` | ช่องว่างชิดระหว่างป้ายย่อย หรือ padding เล็กสุด |
| `var(--space-2)` | `8px` | ระยะห่างไอคอนกับข้อความ, ช่องว่างระหว่างปุ่มในกลุ่ม |
| `var(--space-3)` | `12px` | ระยะห่างแนวนอนระหว่างกลุ่มตัวกรองย่อย |
| `var(--space-4)` | `16px` | Padding มือถือ, ช่องว่างระหว่างการ์ดใน Grid |
| `var(--space-5)` | `20px` | Padding การ์ดขนาดกลาง, แถวฟอร์ม |
| `var(--space-6)` | `24px` | **Padding การ์ดมาตรฐาน (20–24px)**, ระยะห่าง Toolbar กับตาราง |
| `var(--space-8)` | `32px` | **Section Gap**, ขอบซ้าย-ขวาหน้าแดชบอร์ดบนเดสก์ท็อป |
| `var(--space-12)` | `48px` | ระยะห่างหัว-ท้ายหน้าเว็บหลัก |

---

## 5. Radius Math, Elevation & Purposeful Motion

### 5.1 Nested Radius Math Formula
`innerRadius = max(4px, outerRadius - innerPadding)` เพื่อให้ความโค้งของขอบนอกและส่วนประกอบด้านในสอดรับกันอย่างกลมกลืน

| ส่วนประกอบนอก (Outer) | Radius ภายนอก | Padding ด้านใน | คำนวณ Inner Radius | Element ภายในที่ใช้ |
|---|---|---|---|---|
| **Modal / Panel** | `16px` (`--radius-lg`) | `20–24px` | `max(4px, 16 - 20) = 4–8px` | ปุ่ม, Input, Search Bar ภายใน |
| **Card / Box** | `12px` (`--radius-md`) | `16–20px` | `max(4px, 12 - 16) = 6–8px` | Filter Chips, Sub-buttons |
| **Toolbar Ribbon** | `10px` | `8–12px` | `6–8px` | Date Tabs, Quick Selectors |

### 5.2 Elevation, Shadows & Motion

| รายการ | ค่ามาตรฐาน (`globals.css`) | ข้อกำหนด |
|---|---|---|
| **เงาการ์ด (Rest)** | `var(--shadow-card)` | `0 1px 3px rgba(17, 30, 20, 0.04), 0 2px 6px rgba(17, 30, 20, 0.02)` |
| **เงา Modal / Popover** | `var(--shadow-lg)` | `0 8px 24px -4px rgba(17, 30, 20, 0.12), 0 4px 8px -2px rgba(17, 30, 20, 0.06)` |
| **เงา Hover (Interactive)** | `var(--shadow-hover)` | ใช้เฉพาะการ์ดหรือแถวที่คลิกกรองได้เท่านั้น (ไม่ใส่กับการ์ดสถิตินิ่ง) |
| **Transition** | `--dur-fast: 150ms`, `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` | ระบุ property ที่เปลี่ยนเสมอ (`transition: background-color 150ms var(--ease-out), border-color 150ms var(--ease-out)`) **ห้าม `transition: all`** |
| **Tactile Press** | `transform: translateY(1px)` หรือ `scale(0.98)` | ตอบสนองต่อการคลิกนิ่งๆ **ห้ามปุ่มเด้งดิ้น ขยายใหญ่ (hover:scale)** |
| **Focus Ring** | `outline: 3px solid var(--primary); outline-offset: 2px;` | คงไว้ทุก interactive element เพื่อ Keyboard accessibility |
