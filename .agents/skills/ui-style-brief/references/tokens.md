# Design Tokens & CSS Variables — โรงพยาบาลเถิน

อ้างอิงตัวแปรจาก `src/app/globals.css` เพื่อให้ต้นแบบและโค้ดจริงใช้โทเคนชุดเดียวกัน 100%

---

## 1. Quiet Neutral Ramp & Brand Accent

**หลักการ:** พื้นหลังและกรอบนำทางต้องสงบ (Quiet Chrome) เพื่อให้ข้อมูลทางคลินิกและสถานะเป็นตัวนำสายตา

| Token | ค่าสี HEX | บทบาทการใช้งาน |
|---|---|---|
| `var(--bg-main)` | `#FAFCFB` | พื้นหลังหลักของหน้า อมเขียวจางลดแสงจ้าเมื่อจ้องทั้งวัน |
| `var(--bg-surface)` | `#FFFFFF` | พื้นผิวการ์ด ตาราง แผงควบคุม และโมดอล |
| `var(--bg-subtle)` | `#F4F7F5` | หัวตาราง แถบสรุป แถบเครื่องมือ ช่องกรอกแบบอ่านอย่างเดียว |
| `var(--gray-900)` | `#111E14` | **Primary Ink:** หัวข้อเรื่อง ข้อความหลัก ตัวเลข KPI |
| `var(--gray-700)` | `#334237` | **Secondary Ink:** ข้อความรอง คำอธิบาย ชื่อคอลัมน์ |
| `var(--gray-500)` | `#6B7B70` | **Muted Ink:** คำอธิบายย่อย หน่วย เวลาอ้างอิง (คอนทราสต์ `>= 4.5:1` บนพื้นขาว) |
| `var(--gray-200)` | `#E2E8E4` | **Hairline Border:** เส้นขอบการ์ด ขอบ input (หรือใช้ `rgba(17, 30, 20, 0.08)`) |
| `var(--gray-100)` | `#F1F5F3` | เส้นคั่นแถวในตาราง (Row divider) |
| `var(--primary)` | `#0D7446` | **Single Brand Accent:** ปุ่ม Primary 1 ปุ่ม, แท็บที่เลือก, Focus ring, จุดเน้นหลักในกราฟ |
| `var(--primary-hover)` | `#0B633C` | สี hover ของปุ่มหลัก |
| `var(--primary-dark)` | `#095C38` | สี active ขณะกด และข้อความบนพื้น `--primary-light` |
| `var(--primary-light)` | `#E8F5E9` | พื้นหลังสถานะเลือกเบาๆ หรือปุ่มรองเน้นขอบเขต |
| `var(--primary-subtle)` | `#F0FDF4` | พื้นแถวตารางที่เลือก/hover และการ์ดที่ถูกกรอง (Selected state) |
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

- **Nested Radius Rule:** `innerRadius = max(4px, outerRadius - innerPadding)` เพื่อไม่ให้มุมด้านในดูอ้วนหรือแหลมผิดสัดส่วน

| รายการ | ค่ามาตรฐาน (`globals.css`) | ข้อกำหนด |
|---|---|---|
| **แผงใหญ่ / Modal** | `16px` (`var(--radius-lg)`) | ภายในมี padding `20–24px` |
| **การ์ด / ตาราง** | `12px` (`var(--radius-md)`) | เส้นขอบ `1px solid var(--gray-200)` |
| **ปุ่ม / Input / Select** | `8px` (`var(--radius)`) | สูงอย่างน้อย **44px** (`44–48px` บนมือถือ/จุดกดหลัก) |
| **Status Tag / Badge** | `6px` (`var(--radius-sm)`) หรือ `9999px` | ใช้ Pill (`9999px`) เฉพาะป้ายสถานะสั้น ไม่ใช้กับทุกกล่อง |
| **เงาการ์ด (Rest)** | `var(--shadow-card)` | `0 1px 3px rgba(13, 116, 70, 0.05), 0 4px 12px rgba(13, 116, 70, 0.04)` (หรือ hairline อย่างเดียวในตารางแน่น) |
| **เงา Hover** | `var(--shadow-hover)` | ใช้เฉพาะการ์ดที่คลิกกรอง/เปิดดูได้เท่านั้น ไม่ใส่กับการ์ดสถิติที่กดไม่ได้ |
| **Transition** | `--dur-fast: 150ms`, `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` | ระบุ property ที่เปลี่ยนเสมอ (`transition: background-color 150ms ..., border-color 150ms ...`) **ห้าม `transition: all`** |
| **Focus Ring** | `outline: 3px solid var(--primary); outline-offset: 2px;` | คงไว้ทุก interactive element เพื่อ Keyboard accessibility |
