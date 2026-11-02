# Design Spec: บริการ Palliative Care End Of Life (PC.1)

หน้า: `/service/dashboard-rcm/palliative-care/pc-1` (เจ้าหน้าที่การเงิน/RCM และบุคลากรทางการแพทย์)  
อ้างอิง: รหัสบริการ สปสช. ADP Code 30001 (ค่าบริการ Palliative Care ระยะท้าย / End Of Life)

---

## 1. วัตถุประสงค์และฟังก์ชัน
- แสดงรายชื่อและประวัติการรับบริการของผู้ป่วย Palliative Care ระยะท้ายที่ได้รับบริการตามรหัส ADP Code `30001`
- รองรับการตรวจสอบสถานะการชดเชยค่ารักษาพยาบาล (Rep, Compensated, TransactionType, Invoice, Invoice Compensated, Subfund)
- รองรับการกรองช่วงเวลา 3 รูปแบบ:
  1. **กำหนดเอง (วันถึงวัน):** เลือกวันที่เริ่มต้น (ds1) ถึงวันที่สิ้นสุด (ds2)
  2. **รายเดือน:** เลือกระบุเดือนไทย (ม.ค. - ธ.ค.) และปี พ.ศ. (2572 - 2565)
  3. **รายปีงบประมาณ:** เลือกปีงบประมาณ พ.ศ. (1 ต.ค. ปีก่อนหน้า ถึง 30 ก.ย. ปีที่เลือก)
- ช่องค้นหา Live Search (ค้นหา HN, CID, VN, ชื่อผู้ป่วย, รหัสโรค PDX, หรือรายการ)
- แท็บสลับหน้าด่วนระหว่าง **PC.1 บริการ End Of Life** และ **PC.3 ตามกลุ่มโรค**
- ไม่มีปุ่มย้อนกลับซ้ำซ้อน (อาศัย Breadcrumb และ Sidebar ของ Dashboard-RCM)

---

## 2. โครงสร้างข้อมูล (Data Mapping)

| ฟิลด์ | แหล่งที่มา / ตรรกะ | ความหมาย |
|---|---|---|
| `no` | ลำดับตัวเลข 1, 2, 3... | ลำดับที่ |
| `vn` | `o.vn` | รหัสผู้ป่วยนอก (VN) |
| `hn` | `o.hn` | รหัสประจำตัวผู้ป่วย (HN) |
| `cid` | `pt.cid` | เลขบัตรประจำตัวประชาชน 13 หลักเต็ม (ไม่ mask) |
| `ptname` | `pt.pname + pt.fname + ' ' + pt.lname` | ชื่อ-นามสกุลผู้ป่วย (แนวนอนแถวเดียว `nowrap`) |
| `age` | `TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)` | อายุ (ปี) |
| `nation` | `nationality.name` | สัญชาติ |
| `vstdate` | `DATE_FORMAT(o.vstdate, '%Y-%m-%d')` | วันที่รับบริการ |
| `vsttime` | `TIME_FORMAT(o.vsttime, '%H:%i:%s')` | เวลารับบริการ |
| `authencode` | `rcmdb.authencode.AuthenCode` | รหัส Authen Code สปสช. |
| `pttypename` | `pttype.name` | ชื่อสิทธิการรักษา |
| `department` | `kskdepartment.department` | จุดบริการ / แผนก |
| `clinic` | `spclty.name` | คลินิก / แผนกความเชี่ยวชาญ |
| `pdx, dx0-dx5` | `vn_stat.pdx, dx0..dx5` | การวินิจฉัย (Merged Header: การวินิจฉัย) |
| `op0-op5` | `vn_stat.op0..op5` | หัตถการ (Merged Header: หัตถการ) |
| `listname` | `s_drugitems` (ADP 30001) | รายการบริการ (เช่น ค่าเยี่ยมบ้านPaliative care) |
| `rep` | `rcmdb.repdata.rep` | เลขหนังสือตอบรับการจ่าย (Rep) |
| `compensated` | `rcmdb.repdata.compensated` | ยอดเงินชดเชยที่ได้รับจริง (บาท) |
| `transaction_type`| `rcmdb.repdata.TransactionType` | ประเภทธุรกรรม e-Claim |
| `invoice` | `rcmdb.repeclaim.rep` | เลขที่ใบแจ้งหนี้ / Invoice |
| `invoice_compensated` | `rcmdb.repeclaim.compensated` | ยอดเงินชดเชยตาม Invoice (บาท) |
| `subfund` | `rcmdb.repdata.subfund` | กองทุนย่อย (Subfund) |
| `remark` | `rcmdb.repdata.remark` | หมายเหตุ |

---

## 3. การแสดงผลและสถานะสี (Color Striping)
- **แถบสีเขียว** (`#10b981` / พื้นหลัง `#ecfdf5`): รายการที่ได้รับเงินชดเชยแล้ว (`compensated > 0`)
- **การจัดวางชื่อ-สกุล:** กำหนด `white-space: nowrap` ทั้งส่วนหัวตารางและเซลล์ข้อมูล
- **ตัวเลข:** ใช้ `tabular-nums` จัดชิดขวาสำหรับคอลัมน์การเงิน

---

## 4. สถาปัตยกรรมและการเชื่อมต่อ (Zero-DB Architecture)
- 100% Zero-Database Socket: ส่งคำสั่ง SQL SELECT ผ่าน `apiGateway.clinical.query` ของ Thoen Hospital API Gateway
- แคชระดับ Memory Cache TTL 5 นาที (300 วินาที)
- ความปลอดภัย: ตรวจสอบสิทธิ์ Member Session (`admin`, `staff`, `member`) และบันทึก Audit Log ทุกครั้งที่มีการเรียกดูข้อมูล
