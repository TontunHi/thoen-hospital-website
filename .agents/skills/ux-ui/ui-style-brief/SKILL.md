---
name: ui-style-brief
description: Thoen Hospital UI design system, anti-AI-slop craft workflow, and component/table/modal standards (Sarabun, #0D7446 quiet chrome, Thai Buddhist years, role-appropriate PHI display, single centered table header, flex-pinned dialog shell). Use when designing prototypes, writing UI briefs, or auditing and refactoring pages, dashboards, tables, forms, detail modals/popups, or /member and /service portals.
---

# UI Style Brief — โรงพยาบาลเถิน

ระบบเว็บและพอร์ทัลโรงพยาบาลเถิน (Next.js 16 App Router, React 19, CSS Modules / `page.css`, Centralized API Gateway)
ตอบเป็นภาษาไทยเสมอเมื่อสื่อสารกับผู้ใช้ และสรุปข้อมูลเทคนิคเป็นตารางเพื่อให้สแกนได้เร็ว

---

## 3 โหมดการทำงาน

| โหมด | ใช้เมื่อ | สิ่งที่ส่งมอบ |
|---|---|---|
| **A. Prototype** | ออกแบบหน้าใหม่ หรือปรับโฉมหน้าเดิมจากภาพ/แนวคิด | Interactive Prototype ที่กดทดสอบได้ + ไฟล์ Design Spec (`.md`) จาก [references/spec-template.md](references/spec-template.md) |
| **B. Design Brief** | ผู้ใช้ขอ Prompt / Brief เพื่อส่งต่อให้ AI หรือทีมอื่นออกแบบ | Brief ที่กรอกบริบทจริงครบจาก [references/brief-template.md](references/brief-template.md) |
| **C. Audit & Refactor** | ตรวจหรือปรับปรุงโค้ดจริงในโปรเจกต์ (`src/app/**`) | รายการ Slop ที่พบ + โค้ดที่แก้ตาม 9 Passes + สรุปผลตาม [references/review-checklist.md](references/review-checklist.md) |

---

## ทิศทางงานออกแบบ (Hospital Product Direction)

ก่อนแก้โค้ดหรือวางเลย์เอาต์ ให้ยึด Direction ของโรงพยาบาลเถินเป็นเข็มทิศเดียว:

- **บุคลิก (Character):** สงบ แม่นยำ เป็นมิตร และเชื่อถือได้ (*calm, exact, welcoming*) — เหมาะกับบุคลากรหน้างานที่ทำงานแข่งกับเวลา และประชาชน/ผู้สูงอายุที่ไม่คุ้นเคยเทคโนโลยี
- **โลกของผลิตภัณฑ์ (World):** แฟ้มเวชระเบียนที่สะอาดตาและกระดาษคลินิกโทนอบอุ่น — พื้นผิวเป็นโทนกลางเจือเขียวจาง (`#FAFCFB`, `#FFFFFF`, `#F4F7F5`) เพื่อให้หน้าจอที่จ้องทั้งวันไม่ล้าสายตา
- **กฎ "Quiet Chrome, Rich Content":**
- **กฎ "Quiet Chrome, Rich Content":**
  - ให้ **ตัวข้อมูล สถานะ และกราฟหลัก 1 ตัว** เป็นจุดรับสายตาที่ชัดเจน
  - ตัวกรอบนำทาง การ์ด แถบเครื่องมือ และเส้นขอบ ต้องเงียบ เรียบ และสม่ำเสมอด้วยเส้นขอบบาง (`#E2E8E4` หรือหมึกจาง 6–10%)
  - ใช้สีเขียวแบรนด์ (`#0D7446`) **เฉพาะจุดที่ต้องการชี้นำ** (ปุ่ม Primary 1 ปุ่มต่อมุมมอง, แท็บที่เลือก, Focus ring, และจุดเน้นของกราฟหลัก) — อย่าระบายสีเขียวหรือใส่กล่องไอคอนสีทุกการ์ดจนไม่มีจุดเด่น
- **กฎ "More Visual = More Information & Craft" (ไม่ใช่ More Color):** งานออกแบบระดับพรีเมียมใช้โทนสีเกือบ Monochrome (Neutral Ramp + เขียวแบรนด์ 1 จุด) ความสวยงามเกิดจาก **สัดส่วนที่ประณีต ลำดับชั้นที่อ่านง่าย และข้อมูลที่เห็นความหมายชัดเจน** ไม่ใช่การสาดสีรุ้งหรือใส่การ์ดแฟนซี

---

## มาตรฐานคุณภาพ OpenDesigner 9-Line Scorecard (เกณฑ์ประเมิน UI ระดับสากล)

ทุกหน้าจอ ส่วน หรือคอมโพเนนต์ที่ผ่านการออกแบบหรือปรับปรุง ต้องผ่านเกณฑ์ประเมินคุณภาพทั้ง 9 มิติ (คะแนน 1–5; ผ่านระดับใช้งานจริงที่ระดับ `>= 4`):

| # | มิติการประเมิน (Quality Dimension) | ความหมายและสิ่งที่ต้องเห็นในระบบโรงพยาบาลเถิน |
|---|---|---|
| **Q1** | **Fits the Clinical Job** | เข้ากับบริบทการใช้งานจริง: ความหนาแน่นและโทนสีสบายตาสำหรับการจ้อง 8+ ชม. ค้นหาเคสได้เร็ว ลดภาระสมอง (Cognitive Load) |
| **Q2** | **Real Content** | ใช้ข้อมูลการแพทย์และประกันจริง: รหัสโรค (ICD-10), รหัสหัตถการ (ICD-9), รหัส ADP, วันที่ พ.ศ. ไทย, HN/CID จริง ไร้ข้อมูลสมมติที่ไร้ความหมาย |
| **Q3** | **One System** | ยึดมั่น Token ชุดเดียว: สเกล 4px, ฟอนต์ Sarabun, ตัวแปรสีจาก `tokens.md` ไร้ค่าสีหรือขนาด Hard-coded |
| **Q4** | **Clear First Read** | ลำดับการกวาดสายตาชัดเจน: มีปุ่ม Primary เด่น 1 ปุ่มต่อมุมมอง, หัวข้อและยอดสรุปหลักเด่นทันที ไม่แย่งความสนใจกัน |
| **Q5** | **Visual Craft & Precision** | ความประณีตทุกจุด: ตัวเลข `tabular-nums`, Nested Radius Math ถูกต้อง, ตาราง Align ตรงกัน 100%, จัดระยะหายใจให้เมนูและตาราง |
| **Q6** | **Data Shown as Data** | แสดงข้อมูลเชิงลึก: แสดงยอดปัญหา/ความเสี่ยงควบคู่ยอดปกติ (เช่น ส่วนที่ขาดรหัสคัดกรอง Not OK, เคสผลผิดปกติ), สถานะมี 1 สัญญาณ + ข้อความกำกับ |
| **Q7** | **Anti-Slop Restraint** | ละเว้นสิ่งตกแต่งไร้สาระ: 0 Emoji ใน UI ทางการ, ไร้แสง Glow, ไร้ Gradient แฟนซี, ไร้แถบสีหนา 4px บนหัวการ์ด |
| **Q8** | **Purposeful Motion** | เคลื่อนไหวเมื่อมีหน้าที่: Transition 150ms สำหรับการตอบสนองคลิก/Focus, ปลอดภัยต่อ Reduced Motion, ไร้ปุ่มเด้งดิ้น (Dancing Buttons) |
| **Q9** | **Crisp Presentation & Surface** | พื้นผิวสะอาดตา: ระดับพื้นผิวแบบ Tactile Surface Steps, ใช้หมึก Off-Black (`#111E14`) ไม่ใช้ดำสนิทบนขาว, คอนทราสต์ `>= 4.5:1` |

---

## กระบวนการ 9 Passes (ทำเรียงลำดับ ไม่ข้ามขั้น)

ไม่ว่าจะออกแบบใหม่ (โหมด A) หรือ Refactor โค้ดจริง (โหมด C) ให้ไล่ปรับทีละชั้นตามลำดับนี้:

### Pass 1: Spacing & 4px Rhythm (จัดระยะหายใจ)
- ทุก Margin, Padding, Gap และความสูงมาตรฐานต้องอยู่บนสเกล `4px` (`4, 8, 12, 16, 20, 24, 32, 48px`) ตัดค่าเศษแปลกปลอม (`13px`, `19px`, `7px`) ออกทั้งหมด
- **Proximity Rule:** ระยะห่างภายในกลุ่มข้อมูลต้องเล็กกว่าระยะห่างระหว่างกลุ่มเสมอ (Card padding `20–24px`, Section gap `24–32px`, แถวตารางสูง `>= 52–56px`)
- **Lists & Sidebars Breathe (OpenDesigner Craft):**
  - รายการแถวในเมนู/Sidebar ต้องมี Inset ห่างจากขอบ Container อย่างน้อย `6–8px` ไม่ชิดติดขอบ
  - ช่องว่างระหว่างไอคอนกับข้อความต้องมีระยะอย่างน้อยครึ่งหนึ่งของขนาดไอคอน (`8–10px` สำหรับไอคอน `16–18px`) เพื่อไม่ให้ไอคอนและตัวอักษรกลายเป็นรูปทรงก้อนเดียวกัน
  - ระยะห่างระหว่างกลุ่มเมนู (Group gap) ต้องกว้างกว่าระยะห่างระหว่างแถวในกลุ่มอย่างน้อย 2–3 เท่า
- พี่น้องในแถวหรือรายการเดียวกันต้องมีขนาด ช่องว่าง และ Padding เท่ากันทั้งหมด

### Pass 2: Color, Tactile Surfaces & Off-Black (คุมโทนสีและพื้นผิว)
- ใช้ Neutral Ramp ชุดเดียวจาก [references/tokens.md](references/tokens.md) (`--bg-main`, `--bg-surface`, `--bg-subtle`, `--gray-900/700/500`, `--gray-200/100`)
- **Off-Black Rule (STD-visual-details-66):** ห้ามใช้สีดำสนิท (`#000000`) บนพื้นขาว ให้ใช้โทน Off-black จาก Neutral Ramp (`#111E14` สำหรับหัวข้อ/ข้อความสำคัญ, `#334237` สำหรับข้อความทั่วไป) เพื่อลดความล้าสายตา
- **Tactile Surface Steps:** แบ่งระดับพื้นผิวอย่างสงบ:
  - ระดับ 0 (Page Ground): `--bg-main` (`#FAFCFB` เขียวจางลดแสงสะท้อน)
  - ระดับ 1 (Cards, Ledger Tables, Panels): `--bg-surface` (`#FFFFFF` ตัดด้วยขอบบาง 1px)
  - ระดับ 2 (Toolbars, Table Headers, Filter Strips): `--bg-subtle` (`#F4F7F5`)
  - ระดับ 3 (Hover / Selection): `--primary-subtle` (`#F0FDF4` เขียวมิ้นต์จางละมุน)
- **1 สี = 1 ความหมาย:** สีสถานะ (`success`, `warning`, `danger`, `info`) ใช้พื้นอ่อน + ตัวอักษรเข้มคอนทราสต์ `>= 4.5:1` พร้อมข้อความกำกับเสมอ
- พื้นผิวการ์ดและพื้นหลังใช้สีพื้นทึบสะอาดตัดกันด้วยเส้นขอบบาง 1px (`#E2E8E4`) — ปลอด Gradient แฟนซี, แสง Glow, Glassmorphism และ **ตัดแถบขอบสีหนา 4px บนหัวการ์ดหรือด้านซ้ายออก**

### Pass 3: Typography & Thai Readability (ตัวอักษรและระยะบรรทัด)
- ฟอนต์หลักคือ **Sarabun** (`var(--font-family)`), ระยะบรรทัด `1.6–1.7` เพื่อไม่ให้สระบน-ล่างภาษาไทยชนกัน
- **สร้างลำดับชั้นด้วยขนาดและสี ไม่ใช่ความหนาหนัก:** ใช้น้ำหนัก `400` (เนื้อหา), `500` (ป้ายกำกับ/หัวตาราง), `600` (หัวข้อ/ตัวเลขสำคัญ) เป็นหลัก หลีกเลี่ยง `700–900` พร่ำเพรื่อ และไม่ใช้ตัวเอียง (*italic*) เพื่อเน้นข้อความ
- **ห้าม** ใช้ตัวพิมพ์ใหญ่ห่างๆ (`NAVIGATION` + `letter-spacing` กว้าง) และห้ามใส่ `letter-spacing` ติดลบกับข้อความขนาดเล็ก (เล็กสุดคือ `13px`)
- ตัวเลข เงิน วันที่ และรหัสในตาราง/KPI ใช้ `font-variant-numeric: tabular-nums` และรูปแบบทศนิยมเดียวกันทั้งหน้า

### Pass 4: Icons & Visual Anchors (ไอคอนนำสายตา)
- ใช้ชุดไอคอนเดียวทั้งหน้า (`lucide-react` หรือ `material-symbols-outlined`) ขนาดคงที่ (`16–18px`, stroke `1.5`)
- **ไอคอนต้องนิ่งและเงียบกว่าข้อความ:** รับสีจากบทบาทข้อความรอง (Secondary/Muted Ink) ไม่ใส่สีรุ้งแยกทุกกล่อง
- **ทุกไอคอนต้องมีหน้าที่นำสายตาหรือเป็นปุ่มกดได้** (เช่น ปฏิทินหน้าวันที่, แว่นขยายในช่องค้นหา, เตือนหน้าแบนเนอร์) — ตัดไอคอนประดับหัวการ์ดและ **ห้ามใส่ Emoji** ในหัวข้อ เมนู หรือข้อความระบบ

### Pass 5: Layout & Visual Hierarchy (จัดสัดส่วนและทลายหน้าตาเทมเพลต)
- **ทลายกำแพงการ์ดสี่เหลี่ยมหน้าตาเหมือนกัน 8 ใบ:** หลีกเลี่ยงการเรียง KPI Cards ที่หน้าตา/ขนาด/ไอคอนซ้ำกันหมดแบบ AI Template; จัดให้แถวบนสมมาตรไร้ช่องโหว่แหว่ง (`3x2`, `4x1` หรือ `2x2` บนแท็บเล็ต) **สร้างจังหวะความสำคัญแบบ Tiered Summary** เช่น แยกการ์ดหลัก (Primary Summary) ออกจาก Stat Strip/Filter Chips หรือจับคู่กราฟหลัก 1 ชิ้นกับตารางสรุปด้านข้าง
- **1 มุมมอง 1 ปุ่ม Primary:** มีปุ่มหลักเด่นชัด 1 ปุ่ม ส่วนปุ่มรองและลิงก์วางอย่างสงบไม่แย่งความสนใจ
- **Single-Row Date Selector Ribbon:** แท็บสลับโหมด (`กำหนดเอง` | `เดือน` | `ปีงบประมาณ`) และตัวเลือกวันที่ต้องเรียงในบรรทัดเดียวกันบนเดสก์ท็อป คั่นด้วยเส้นตั้งบาง (`1px` divider); **ไม่ใส่ label ข้อความนำหน้า dropdown ปีงบประมาณ** (ค่าในตัวเลือกบอกอยู่แล้ว)
- **Unified Global Search:** ช่องค้นหา 1 ช่องค้นได้ทุกมิติพร้อมกัน (HN, CID, ชื่อ-สกุล, VN/AN, รหัสโรค, สิทธิ) โดยไม่ต้องมีดรอปดาวน์เลือกฟิลด์ค้นหา
- **Dialog / Detail Popup:** ใช้โครง flex 4 ชั้น (header → tabs → body → footer) ตรึงหัว/แท็บ/ท้าย (`flex: 0 0 auto`) และให้ **เฉพาะ body** เลื่อน (`flex: 1 1 auto; min-height: 0`) — อ่าน [components.md §7–§8](references/components.md) ก่อนแก้ popup ทุกครั้ง (มี gotchas ที่เคยทำแถบแท็บยุบหาย)
- รายละเอียดโครงสร้างทุกส่วนดูใน [references/components.md](references/components.md)

### Pass 6: Table Craft & Alignment (ระเบียบตารางมาตรฐานโรงพยาบาล)
- **หัวตาราง (`<th>`): แถวเดียว + ทุกช่องกึ่งกลาง** — ห้ามมีแถบหัวกลุ่มคอลัมน์ซ้อน (เช่น `ข้อมูลผู้รับบริการ` / `เกณฑ์ Palliative Care` / `การชดเชย e-Claim`) และห้ามปล่อยหัวช่องชิดซ้าย/ขวาแม้ข้อมูลด้านล่างจะเป็นข้อความหรือเงิน; ใช้ `position: sticky; top: 0` + พื้น `--bg-subtle` + ขอบล่าง 2px (ดู [components.md §4.1](references/components.md))
- **เซลล์ (`<td>`) จัดตามชนิดข้อมูล (ไม่ต้องตรงกับหัวเสมอไป):**
  - **จัดกึ่งกลาง (`col-center`):** ลำดับ, วันที่, เวลา, HN, CID, ชื่อ-สกุลผู้ป่วย (กึ่งกลางแกน X), ป้ายสถานะ Badge, จำนวนนับ, ปุ่ม Action
  - **จัดชิดซ้าย (`col-left`):** ข้อความบรรยายยาว (เช่น การวินิจฉัย, รายการยา/หัตถการ, หมายเหตุ, ชื่อไฟล์)
  - **จัดชิดขวา (`col-right`):** เฉพาะคอลัมน์เงิน/บัญชีที่ต้องเทียบหลักทศนิยมตรงกัน
- **Empty / No-results State ห้ามอยู่ใน `<td colSpan={N}>`** ของตารางที่กว้างเกินจอ (จะถูกจัดกึ่งกลางจากความกว้างทั้งตารางจนไปโผล่นอกจอ) — วาง state นอกตารางแทน
- **Sort Icon Inline Cohesion:** ครอบชื่อหัวข้อและไอคอน Sort ด้วย `inline-flex; align-items: center; gap: 4px; white-space: nowrap;` แสดงไอคอนจางๆ ในสถานะปกติเพื่อไม่ให้ขนาดคอลัมน์กระตุกเลื่อนเมื่อกด Sort
- **ชื่อ-สกุลผู้ป่วย (Intact Surname Wrap):** ให้อยู่บรรทัดเดียวเป็นหลัก (`min-width: 160–180px`) ถ้าจอแคบต้องครอบชื่อและนามสกุลด้วย `display: inline-block; white-space: nowrap;` เพื่อให้ยกไปทั้งนามสกุลโดยไม่ตัดกลางคำ
- **อายุและหน่วยอยู่บรรทัดเดียวกันเสมอ:** `{age}&nbsp;ปี` พร้อม `white-space: nowrap`
- **Row-Clickable Records:** คลิกทั้งแถว (`<tr>`) เพื่อเปิด Detail Modal ได้โดยตรง ตัดคอลัมน์ปุ่ม "ดูรายละเอียด" และตัดปุ่มไอคอน Copy ซ้ำซ้อนข้าง HN/CID ในเซลล์ตารางออก
- **ตัดแถวสรุปท้ายตาราง (`<tfoot>`) ซ้ำซ้อน:** เมื่อ Pagination Bar ด้านล่างและ KPI ด้านบนบอกยอดรวมและช่วงแถวไว้แล้ว ให้ตัดแถว `รวมทั้งหมดในหน้านี้...` ท้ายตารางออกเพื่อให้ตารางจบลงอย่างสะอาด

### Pass 7: Copy & Smart Subtraction (ภาษาสุภาพและตัดสิ่งเกินจำเป็น)
- ข้อความภาษาไทยต้องสุภาพ ชัดเจน ไร้ศัพท์เทคนิคไอที ไร้เครื่องหมายตกใจ (`!`) และไร้คำโฆษณาเกินจริง
- **Smart Subtraction (ตัดส่วนเกินที่ทำให้หน้าตาเป็นเทมเพลต AI):**
  - ขึ้นหัวหน้าด้วย `<h1>` และคำอธิบายสั้นได้เลย — **ตัด** Eyebrow/Pill Badge ลอยเหนือ `<h1>` (ใช้ Breadcrumb ข้อความเรียบแทนหากต้องบอกตำแหน่งชั้น)
  - **ตัด** ตัวเลขลำดับนำหน้าชื่อเมนู, `<h1>`, Metadata title, Breadcrumb และแท็บช่วงเวลา (`1. 2. 3.`) — ใช้ Badge ชิปแยกต่างหากเฉพาะเมื่อจำเป็นต้องแสดงรหัสหัวข้อ
  - **ตัด** ข้อความช่วงวันที่ซ้ำซ้อนในวงเล็บต่อท้ายปีงบประมาณ/เดือน และตัด Badge แสดงช่วงวันที่ซ้ำซ้อนในแถบควบคุม เช่น `(1 ต.ค. ... - 30 ก.ย. ...)`
  - **ตัด** Pill Tag คำนวณซ้ำซ้อนข้างข้อมูลปกติ (เช่น แปะ `[ กลุ่มเป้าหมาย ]` ข้างตัวเลขอายุในตาราง/Modal)
  - **ตัด** แถวสรุป `<tfoot>` ท้ายตารางที่ระบุจำนวนรายการซ้ำกับแถบ Pagination

### Pass 8: Charts & Nested Details (กราฟและรายละเอียดเชิงลึก)
- **1 หน้าจอ 1 กราฟหลัก (ถ้ามีกราฟ):** ให้กราฟหลัก 1 ตัวใหญ่และประณีต ข้อมูลรองใช้ตารางสั้นหรือ Ranked List — ห้ามวางกราฟขนาดเท่ากันแข่งกันหลายใบหรือใช้แท่งสีรุ้ง
- กราฟใช้เส้นกริดสีจาง แกนตัวเลข `tabular-nums` สีหลัก 1 สีสำหรับชุดข้อมูลเป้าหมาย และโทนเทาสำหรับค่าเปรียบเทียบ
- **Nested Radius Math (กฎรัศมีมุมซ้อน):** `innerRadius = max(4px, outerRadius - innerPadding)` (เช่น การ์ด `16px` + padding `16px` -> ปุ่ม/ช่องกรอกด้านใน `8px`; ลดการใช้ `9999px` พร่ำเพรื่อ เหลือไว้เฉพาะ Status Dot/Badge สั้นๆ)
- **Tactile Feedback:** ปุ่มตอบสนองต่อการคลิกด้วยการเปลี่ยนสีและขยับลง 1px (`transform: translateY(1px)`) หรือ Scale เล็กน้อย (`0.98`) โดย **ห้ามทำปุ่มเด้งดิ้น ขยายใหญ่ (hover:scale) หรือการ์ดกระตุก**

### Pass 9: Motion, States & Responsive (ความเคลื่อนไหวและทุกสถานะ)
- **Motion with a Job:** ระบุ Property ชัดเจน (`transition: background-color 150ms var(--ease-out), border-color 150ms var(--ease-out)`), ห้ามใช้ `transition: all`, ห้าม `hover:scale` บนการ์ด, ห้าม `animate-pulse` บนข้อความหรือกล่องที่ไม่ใช่ Skeleton โหลดข้อมูล
- **ทุกหน้าต้องมี 4 สถานะ:** ว่าง (Empty State ที่ชวนไปต่อ), ไม่พบผลค้นหา (พร้อมปุ่มล้างคำค้น), กำลังโหลด (Skeleton ขนาดเท่ากล่องจริง ไม่กระตุกเลย์เอาต์), ข้อผิดพลาด (ภาษาเข้าใจง่าย พร้อมปุ่มลองใหม่)
- **Responsive & Touch:** เป้าสัมผัสทุกจุด `>= 44–48px`; มือถือ (`< 768px`) แปลงตารางเป็น Card View ที่อ่านง่าย

---

## มาตรฐานข้อมูลโรงพยาบาลและบริบท PHI (Hospital Standards & Context)

1. **ปี พ.ศ. ไทยเสมอ:** แสดงวันที่เป็น พ.ศ. ไทยทุกจุด (เช่น `1 พ.ย. 2569`) ใช้ `@/lib/formatters` (`formatThaiDate`)
2. **การแสดงผลข้อมูลส่วนบุคคล (PHI) แยกตามบริบทสิทธิ์:**
   - **หน้าสาธารณะ / ผู้ป่วย / งานทั่วไป (`/check-date`, พอร์ทัล `/member` ทั่วไป):** Mask เลขบัตรประชาชนและ HN แสดงเฉพาะ **4 หลักท้าย** (`x-xxxx-xxxxx-xx-1` หรือ `•••1234`)
   - **หน้าตรวจสอบภายในระบบ RCM (`/service/dashboard-rcm/**`):** เป็นพอร์ทัลเฉพาะเจ้าหน้าที่การเงิน/เวชระเบียนที่ยืนยันสิทธิ์ Role-based Auth และบันทึก `logThrottledAudit('READ', ...)` แล้ว — แสดงเลขบัตรประชาชน **ครบ 13 หลัก** และ HN/VN เต็มเพื่อใช้กระทบยอด e-Claim/REP สปสช. ได้ทันทีโดยไม่ต้องทำปุ่มซ่อน/แสดงให้รก UI
3. **เกณฑ์ตรวจคุณภาพ:** อ่าน [references/review-checklist.md](references/review-checklist.md) และทำ **"Template Test"** ทุกครั้ง — *ถ้าเอาชื่อโรงพยาบาลออก หน้านี้ยังดูเป็นเทมเพลตทั่วไปหรือไม่?* ถ้าใช่ ให้ปรับ Direction, Hierarchy และ Copy ให้ชัดขึ้นอีก

---

## หลักการแก้ไข UI อย่างแม่นยำและไม่หลุดโฟกัส (AI Craft & Precision Protocol)

เพื่อป้องกันการหลุดสไตล์หรือทำลายโครงสร้างและฟังก์ชันของหน้าจอ:

1. **Pinning Target Components (ล็อคเฉพาะคอมโพเนนต์เป้าหมาย):**
   - เจาะจงระบุไฟล์คอมโพเนนต์และจุดที่ต้องการปรับปรุงให้ชัดเจน (เช่น `DateSelector.tsx`, `SummaryCards.tsx`) หลีกเลี่ยงการสั่งแก้ทั้งหน้าจอพร้อมกัน
2. **Sequential Passes (ทำตามลำดับ Passes ไม่ข้ามขั้น):**
   - ไล่แก้ทีละประเด็นตามลำดับ 9 Passes (จัด Spacing/Grid → ปรับ Token สี → จัด Typography/Alignment) เพื่อป้องกันการใส่คลาส CSS ตีกันหรือเลย์เอาต์พัง
3. **Preserve Interactive State & Logic (คงตรรกะและฟังก์ชันเดิม):**
   - เมื่อปรับแต่งสไตล์ CSS Modules หรือ Tailwind ต้องรักษา Event Handler (`onClick`, `onChange`), State Hooks, Sorting/Filter Logic, และการรองรับ Accessibility ไว้อย่างครบถ้วน
4. **Anti-Slop Restraint (คุมโทนโรงพยาบาลอย่างเคร่งครัด):**
   - ยึดหลัก *Quiet Chrome, Rich Content* ตัดสิ่งเกินจำเป็น (ห้ามใส่ Emoji ในระบบ, ห้ามใส่การ์ด Gradient แฟนซี, ห้ามใช้ Pill Badge ลอยซ้ำซ้อน)
5. **Visual Verification (ตรวจสอบบนหน้าจอจริงทันที):**
   - ใช้เครื่องมือ Browser Preview (`preview_*`) หรือ Snapshot ตรวจสอบผลลัพธ์จริงทั้งบนเดสก์ท็อปและมุมมองอุปกรณ์พกพาหลังแก้เสร็จ
   - **สูตรที่ใช้ได้จริงในโปรเจกต์นี้ (หน้า RCM ต้อง login ก่อน):** สร้าง test ชั่วคราวใน `__preview__/` ที่ `render()` คอมโพเนนต์จริงด้วยข้อมูลสมมติ → เขียน `container.innerHTML` + CSS (`globals.css` + `page.css`/`VnDetailModal.css`) ลงไฟล์ HTML ใน `%TEMP%` → screenshot ด้วย Chrome headless:
     `"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --hide-scrollbars --window-size=1440,1000 --screenshot=out.png "file:///.../preview.html"`
   - **ข้อควรระวัง:** (1) headless บังคับความกว้างหน้าต่างขั้นต่ำ ~`500px` — ถ้าต้องทดสอบ `390px` ให้ครอบ HTML ด้วย `<iframe width="390">`; (2) ใส่ `*{animation:none !important}` กันภาพจับช่วง fade-in; (3) ถ้าสงสัย layout ให้ฉีดสคริปต์วัด geometry (`getBoundingClientRect`, `scrollHeight`, `clientHeight`) แล้ว screenshot รายงานผล — "ตาเห็นว่าแปลก" อาจวัดไม่เจอ และกลับกัน; (4) **ลบโฟลเดอร์ `__preview__` ก่อนจบงานทุกครั้ง** (ห้าม commit)
   - ตรวจ DOM จริงเสมอเมื่อเกี่ยวกับ layout: ตัวอย่างบั๊กจริงที่เจอ — `.vn-modal-tabs` ถูกบีบสูง `48px → 9px` เพราะเป็น flex item ที่ shrink ได้

---

## ตัวอย่างอ้างอิงในโปรเจกต์ (Reference Implementations)

เวลาจะทำหน้า/คอมโพเนนต์ใหม่ ให้ลอกโครงจากของจริงเหล่านี้แทนการเริ่มจากศูนย์:

| ส่วน | ไฟล์ต้นแบบ | จุดที่ควรลอก |
|---|---|---|
| **หน้ารายงาน RCM** (ตาราง + ตัวกรอง + KPI) | [`pc-3/page.css`](../../../src/app/service/dashboard-rcm/palliative-care/pc-3/page.css) + [`pc-3/PalliativeCareClient.tsx`](../../../src/app/service/dashboard-rcm/palliative-care/pc-3/PalliativeCareClient.tsx) | token scope `.pc3-page`, Tiered Summary (3 ยอดหลัก + ชิปกรอง), Single-Row Date Ribbon + Unified Search (debounce 300ms), ตารางหัวแถวเดียวกึ่งกลาง + row-clickable, 4 states, Skeleton, Card View บนมือถือ |
| **Modal รายละเอียดคลินิก / Drill-down** | [`components/VnDetailModal.css`](../../../src/app/service/dashboard-rcm/palliative-care/components/VnDetailModal.css) + [`components/VnDetailModal.tsx`](../../../src/app/service/dashboard-rcm/palliative-care/components/VnDetailModal.tsx) | โครง flex 4 ชั้น (§7), แท็บ 3 ใบ 48px, แถบระบุตัวตน `<dl>`, Vitals 3×3, ตารางใน modal + `min-width`, แถบสรุปการเงิน 3 ยอด, alert dialog ซ้อน + Esc สองระดับ |
