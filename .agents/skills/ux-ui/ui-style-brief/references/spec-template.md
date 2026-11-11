# โครงร่าง Design Spec ที่ต้องส่งมอบ (Spec Template)

ตั้งชื่อไฟล์: `<ชื่อหน้า>-design-spec.md` ใช้ภาษาไทย กระชับ และเน้นตารางสรุป

---

```markdown
# Design Spec: <ชื่อหน้า / ระบบ>

- **Path:** `<เช่น /service/dashboard-rcm/funds/... หรือ /member/...>`
- **กลุ่มผู้ใช้งาน:** <เจ้าหน้าที่การเงิน/เวชระเบียน / พยาบาล / ผู้ป่วย / ผู้สูงอายุ>
- **Direction:** Quiet Chrome, Rich Content — สงบ แม่นยำ สบายตาแบบเวชระเบียนโรงพยาบาลเถิน
- **Design Tokens:** อิง `src/app/globals.css` (Sarabun 400/500/600, `--primary: #0D7446`, `--bg-main: #FAFCFB`)

---

## 1. ปัญหาเดิมและแนวทางแก้ไข
| # | ปัญหาเดิม / AI Slop ที่พบ | การปรับปรุงในเวอร์ชันใหม่ |
|---|---|---|
| 1 | <เช่น การ์ด 8 ใบหน้าตาซ้ำกันหมด กลบความสำคัญ> | <แยกยอดหลัก 4 ตัว + แถบ Filter Chips กระชับ> |
| 2 | <เช่น ตารางเอียงไม่ตรงหัวข้อ ปุ่ม Copy รกทุกแถว> | <จัด col-center ตรงกัน 100% + Row-clickable Modal> |

---

## 2. โครงสร้างหน้าและสเกลระยะห่าง (4px Grid)
| จุดใช้งาน | ค่าที่ใช้ | หมายเหตุ |
|---|---|---|
| **Header & Breadcrumb** | ขึ้น `<h1>` ทันที ไม่มี Eyebrow Pill / เลขลำดับ | ปุ่ม Primary 1 ปุ่มชิดขวา |
| **Toolbar & Date Selector** | แถวเดียวบนเดสก์ท็อป + Unified Search 1 ช่อง | ไม่มีดรอปดาวน์เลือกฟิลด์ / ไม่มีวงเล็บช่วงวันที่ |
| **Card Padding / Section Gap** | `20–24px` / `24–32px` | มือถือ `16px` |
| **Table Row & Touch Target** | แถวสูง `>= 54px` / ปุ่ม `>= 44–48px` | `tabular-nums` ทุกหลักตัวเลข |

---

## 3. มาตรฐานข้อมูลและ PHI
- **วันที่:** พ.ศ. ไทยทั้งหมด (`formatThaiDate`)
- **การแสดง PHI:** <ระบุ: หน้าสาธารณะ Mask 4 ตัวท้าย / ภายใน RCM แสดง CID 13 หลักเต็มภายใต้ RBAC + Audit Log>
- **สถานะ 4 แบบ:** Empty, No Search Results, Loading Skeleton (ไม่กระตุก), Error ภาษาไทยสุภาพ

---

## 4. โทนสีสื่อความหมาย (1 สี = 1 ความหมาย)
| บทบาท | Token | การใช้งาน |
|---|---|---|
| Primary Accent | `var(--primary)` (`#0D7446`) | ปุ่มหลัก 1 ปุ่ม, Active Tab, Focus Ring |
| Success / Warning / Danger | `var(--success-*)`, `var(--warning-*)`, `var(--danger-*)` | ป้ายสถานะพร้อมข้อความกำกับ (คอนทราสต์ >= 4.5:1) |

---

## 5. Responsive & Motion
- **Desktop (`>= 1024px`):** ตารางเต็มคอลัมน์เรียงกึ่งกลางสมดุล
- **Mobile (`< 768px`):** Card View (`padding: 16px`), เป้าสัมผัส `>= 44–48px`
- **Motion:** ระบุ property ชัดเจน (`150ms var(--ease-out)`), ไม่ใช้ `transition: all`

---

## 6. ขอบเขตต้นแบบ vs ระบบจริง
| ส่วนงาน | สถานะ | รายละเอียด |
|---|---|---|
| **ข้อมูล / API** | <เชื่อมต่อ API Gateway จริง / Mock Data> | <ระบุ endpoint หรือสิ่งที่ยังจำลองอยู่> |
```
