# 4. สถาปัตยกรรมและแผนการบูรณาการ Dashboard-RCM สู่ระบบบริการโรงพยาบาลเถิน

Date: 2026-10-12

## สถานะ (Status)
ยอมรับแล้ว (Accepted)

## บริบท (Context)
เดิมระบบ Dashboard-RCM (Hospital Revenue Cycle Management) ถูกพัฒนาแยกเป็นโปรเจกต์เดี่ยว (`dashboard-rcm`) โดยมี 3 หน้าจอรายงานหลัก ได้แก่:
1. `/sss-dental`: รายงาน 2.1.1.1 การให้บริการทันตกรรมสิทธิ์ประกันสังคม จำแนกรายทันตแพทย์
2. `/opd-doctor`: รายงาน 2.1.1.2 สรุปค่าบริการผู้ป่วยนอก OPD จำแนกรายแพทย์ และตัวกรอง 37 สิทธิ e-Claim
3. `/ipd`: รายงาน 2.1.2.1 สรุปการให้บริการผู้ป่วยใน IPD (วันนอน, CMI, AdjRW, สรุปชาร์ตค้าง) พร้อมระบบแจ้งเตือนเข้า Telegram

โรงพยาบาลเถินต้องการนำระบบดังกล่าวมาผนวกเข้าสู่ระบบหลัก (`thoen-hospital-website`) ภายใต้เส้นทาง `/service` ในชื่อ **"Dashboard-RCM"** โดยคงโครงสร้างการสลับดู 3 แท็บเดิมไว้ แต่ต้องสอดคล้องกับมาตรฐานความปลอดภัย สถาปัตยกรรม Thin-route / Deep Domain Service และ Design System ของโรงพยาบาล

## การตัดสินใจ (Decision)

1. **โครงสร้าง Routing และการจัดการ 3 Tab (Nested Routes with Shared Layout):**
   - ใช้โครงสร้างโฟลเดอร์แบบ Nested Routes:
     - `src/app/service/dashboard-rcm/layout.tsx`: เป็น Shared Layout แสดงส่วนหัวและแถบ 3 Tab ด้านบนร่วมกัน
     - `src/app/service/dashboard-rcm/page.tsx`: Redirect อัตโนมัติไปยังแท็บแรก (`/service/dashboard-rcm/sss-dental`)
     - `src/app/service/dashboard-rcm/sss-dental/page.tsx`: แท็บที่ 1 ทันตกรรม ปกส.
     - `src/app/service/dashboard-rcm/opd-doctor/page.tsx`: แท็บที่ 2 สรุป OPD รายแพทย์
     - `src/app/service/dashboard-rcm/ipd/page.tsx`: แท็บที่ 3 สรุปผู้ป่วยใน IPD
   - ข้อดี: ผู้ใช้สามารถ Bookmark หรือแชร์ลิงก์เจาะจงแต่ละแท็บได้ ปุ่ม Back/Forward ของเบราว์เซอร์ทำงานได้ถูกต้อง และโค้ดแต่ละแท็บแยกกันอย่างชัดเจนไม่ปะปนกันในไฟล์ยักษ์ไฟล์เดียว

2. **ระบบสไตล์และส่วนประสานงาน (Hospital CSS Design System):**
   - ไม่ติดตั้ง Tailwind CSS เข้ามาเพื่อป้องกัน CSS Reset Preflight ชนกับสไตล์หลักของเว็บไซต์โรงพยาบาล (`src/app/globals.css`)
   - แปลงสไตล์เป็น scoped CSS (`page.css` และคลาสมาตรฐานโรงพยาบาล) โดยใช้ธีมสีเขียวโรงพยาบาลเถิน (Emerald/Teal Theme) บัตรข้อมูล (Cards), ตาราง (Responsive Tables), และฟอร์มตัวกรองที่สอดคล้องกับหน้าอื่นๆ ใน `/service`

3. **การแสดงผลกราฟิกและชาร์ต (Charting with Recharts):**
   - ติดตั้ง `recharts` ในโปรเจกต์ `thoen-hospital-website` เพื่อคงกราฟ BarChart การกระจายผู้ป่วย/รายได้แยกตามหอผู้ป่วย และการกระจายวันสรุปชาร์ตในหน้า IPD ไว้ตามเดิม
   - รองรับ React 19 โดยใช้เวอร์ชันที่เข้ากันได้ (`^3.10.x`)

4. **การควบคุมสิทธิ์และการคุ้มครองข้อมูล (RBAC & PDPA):**
   - ตรวจสอบเซสชัน Server-Side (`verifyMemberSession()`) หากยังไม่ล็อกอิน ให้ redirect ไปยัง `/member/login`
   - อนุญาตเฉพาะบทบาท `staff` และ `admin` เท่านั้น (บล็อกบทบาท `subdistrict` รพ.สต.)
   - การแสดงเลขบัตรประชาชน (CID): เนื่องจากเป็นระบบ Intranet ภายในโรงพยาบาลที่ต้องล็อกอินเพื่อปฏิบัติงานจริง จึงแสดงเลข 13 หลักเต็มตามความต้องการของฝ่ายการเงินและแพทย์
   - บันทึกการเข้าดูข้อมูลลง Audit Log ผ่าน `logThrottledAudit()` ทุกครั้งที่มีการเรียกดูข้อมูลผู้ป่วย

5. **การเชื่อมต่อฐานข้อมูลและสถาปัตยกรรม Backend (Domain Service Seam):**
   - ไม่เขียนคำสั่ง SQL ใน API Route โดยตรง แต่สร้าง Deep Domain Service กลางที่ `src/lib/clinical/rcmDashboardService.ts`
   - เรียกใช้ Singleton Connection Pool ของ HOSxP ผ่าน `queryClinicalDb` จาก `@/lib/clinicalDb.ts` (ใช้ Text protocol ป้องกัน Error 1615)
   - ใช้ `getCachedData()` จาก `@/lib/cache.ts` สำหรับบันทึก Cache ชั่วคราว ลดภาระของฐานข้อมูล HOSxP
   - สร้าง API Route เป็น Thin Adapters ภายใต้ `src/app/api/service/dashboard-rcm/**`:
     - `/api/service/dashboard-rcm/sss-dental`
     - `/api/service/dashboard-rcm/opd-doctor-summary`
     - `/api/service/dashboard-rcm/opd-report`
     - `/api/service/dashboard-rcm/ipd-report`
     - `/api/service/dashboard-rcm/telegram-notify`

6. **ระบบแจ้งเตือน Telegram ชาร์ตค้าง IPD:**
   - ใช้ Telegram Bot Service เดิมของโรงพยาบาล (`@/lib/telegramService.ts` / `sendTelegramMessage`) แทนบอทเดิมของ dashboard-rcm
   - เพิ่มปุ่มกดส่งทดสอบในหน้า IPD (ยิงผ่าน API Route ที่มีการตรวจสอบเซสชัน)
   - สร้างสคริปต์ standalone bot `scripts/ipdChartNotificationBot.ts` และเพิ่มคำสั่งใน `package.json` เป็น `npm run bot:ipd-chart` เพื่อใช้ตั้ง Cron ทำงานอัตโนมัติทุกเช้า

## ผลกระทบ (Consequences)
- ระบบได้รับรายงานทางการเงิน 3 ด้าน (ทันตกรรม ปกส., OPD รายแพทย์, IPD สรุปชาร์ต) ที่เชื่อมตรงฐานข้อมูลโรงพยาบาล
- โครงสร้างโค้ดเป็นไปตามมาตรฐานการแพทย์และ Clean Architecture ของระบบโรงพยาบาลเถิน
- มีการบันทึกประวัติการเข้าถึงข้อมูลตามมาตรฐานการตรวจสอบความมั่นคงปลอดภัย
