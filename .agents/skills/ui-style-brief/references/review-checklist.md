# เช็กลิสต์ตรวจสอบ UI ก่อนส่งมอบ (Redline Review Checklist)

ใช้ตรวจสอบในโหมด A (Prototype), B (Brief), และ C (Refactor โค้ดจริง) — ทุกข้อควรตรวจให้ผ่านก่อนส่งงาน

---

## 1. Anti-AI-Slop & Template Audit

| หมวด | สิ่งที่ตรวจ | เกณฑ์ผ่าน |
|---|---|---|
| **Quiet Chrome** | สีพื้น, เส้นขอบ, เงา | พื้นหลังเป็น Neutral Ramp (`#FAFCFB` / `#FFFFFF`), ไม่มี Gradient ม่วง-น้ำเงิน, ไม่มี Glow สี, ไม่มี Glassmorphism ฟุ้งๆ, ไม่มีแถบขอบสีหนาซ้ายการ์ด |
| **Accent Restraint** | สีเขียวแบรนด์ `#0D7446` | ใช้เฉพาะ Primary Action, Active Tab, Focus Ring, และจุดเน้นหลัก ไม่ระบายใส่กล่องไอคอนทุกการ์ด |
| **Typography** | Sarabun, น้ำหนัก, Tracking | ใช้น้ำหนัก `400/500/600` เป็นหลัก (ไม่ใช้ `800–900` พร่ำเพรื่อ), ไม่มี `italic`, ไม่มีตัวพิมพ์ใหญ่ห่างๆ, ไม่มี negative tracking บนตัวเล็ก |
| **Icons & Copy** | Emoji, คำพูด, ป้ายตกแต่ง | **0 Emoji** ใน UI ทางการ, ไม่มีเครื่องหมาย `!`, ไม่มีคำโฆษณา, ใช้ไอคอนชุดเดียวขนาด `16–18px` ที่มีหน้าที่นำสายตาจริง |
| **Visual Hierarchy** | รูปแบบ KPI และกราฟ | ไม่เป็นกำแพงการ์ด 8 ใบหน้าตาซ้ำกันหมดแบบเทมเพลต AI (หากใช้ KPI Grid ต้องสมมาตรไร้แถวแหว่ง และมีจังหวะความสำคัญชัดเจน), กราฟหลักไม่เกิน 1 ชิ้นใหญ่ ไม่มีแท่งสีรุ้ง |
| **Smart Subtraction** | ตัดส่วนเกิน | ไม่มี Eyebrow Pill Badge เหนือ `<h1>`, ไม่มีเลขลำดับ `1. 2. 3.` หน้าชื่อเมนู/หัวข้อ/แท็บวันที่, ไม่มีวงเล็บช่วงวันที่ต่อท้ายปีงบประมาณ, ไม่มีดรอปดาวน์เลือกฟิลด์ค้นหา, ไม่มี Tag ช่วงอายุแปะข้างข้อมูลปกติ, ไม่มีปุ่ม Copy ในเซลล์ตาราง |
| **Motion** | CSS Transitions | ไม่มี `transition: all`, ไม่มี `hover:scale` บนการ์ด, ไม่มี `animate-pulse` บน element ที่ไม่ได้กำลังโหลด |

---

## 2. Spacing, Table Alignment & Cohesion

| หัวข้อ | เกณฑ์ผ่าน |
|---|---|
| **4px Grid & Breathing Room** | ทุก Margin/Padding/Gap ลงตัวบนสเกล `4px`, Card padding `20–24px`, Section gap `24–32px`, แถวตารางสูง `>= 52–56px` |
| **Nested Radius Math** | มุมด้านใน `= max(4px, outerRadius - innerPadding)` (ปุ่ม/Input `8px`, การ์ด `12–16px`) |
| **Single-Row Date Bar** | `กำหนดเอง \| เดือน \| ปีงบประมาณ` และตัวเลือกวันที่อยู่บรรทัดเดียวกันบนเดสก์ท็อป คั่นด้วยเส้นตั้งบาง |
| **Row-Clickable Table** | คลิกทั้ง `<tr>` เปิด Modal ได้โดยตรง มี hover feedback ชัดเจน ไม่เพิ่มคอลัมน์ปุ่มเปิดดู |
| **`<th>` / `<td>` Harmony** | Alignment ตรงกัน 100%; จัดกึ่งกลาง (`col-center`) สำหรับ ลำดับ, วันที่/เวลา, HN, CID, ชื่อ-สกุล (แกน X), Badge, จำนวนนับ, ชดเชย (บาท) |
| **Sort Icon Inline** | ข้อความหัวตารางและไอคอน Sort อยู่บรรทัดเดียวกันเสมอ (`inline-flex; white-space: nowrap`) |
| **Name & Age Wrap** | ชื่อ-สกุลยกไปทั้งนามสกุลเมื่อจอแคบ ไม่ตัดกลางพยางค์; อายุและคำว่า `ปี` อยู่บรรทัดเดียวกัน (`18 ปี`) |
| **Tabular Numbers** | ตัวเลข วันที่ เวลา และเงินทุกจุดใช้ `tabular-nums` และทศนิยมรูปแบบเดียวกัน |

---

## 3. Accessibility, States & Hospital Standards

| หัวข้อ | เกณฑ์ผ่าน |
|---|---|
| **Touch Target & Contrast** | ปุ่มและจุดกดสูง `>= 44–48px`, คอนทราสต์ตัวอักษร `>= 4.5:1` (AA), มี `:focus-visible` ชัดเจน |
| **4 Reassuring States** | มีครบทั้ง Empty, No Search Results, Loading Skeleton (ไม่กระตุก), และ Error State ภาษาไทยสุภาพ |
| **ปี พ.ศ. ไทย** | วันที่ทุกจุดแสดงเป็น พ.ศ. ไทย (`formatThaiDate`) ห้ามปน ค.ศ. |
| **PHI ตามบริบทสิทธิ์** | • หน้าสาธารณะ / ทั่วไป: Mask เลขบัตรและ HN เหลือ 4 หลักท้าย<br>• หน้าตรวจสอบภายใน RCM (`/service/dashboard-rcm/**`): แสดง CID 13 หลักและ HN/VN เต็ม (มี Role Auth + `logThrottledAudit`) |
| **Template Test** | *ถ้าสลับชื่อระบบเป็นองค์กรอื่น หน้านี้ยังดูเป็นโรงพยาบาลเถินไหม?* (ตรวจภาษา ข้อมูลตัวอย่าง และ Visual Anchor ให้ตรงบริบทโรงพยาบาลจริง) |
