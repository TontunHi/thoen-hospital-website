# 🏥 Thoen Hospital Go Backend Service (บริการประมวลผลประสิทธิภาพสูง)

โมดูลบริการฝั่ง Backend พัฒนาด้วยภาษา **Go (Golang)** เพื่อรองรับการทำงานที่มี Concurrency สูง, มีการ Polling ถี่ (เช่น จอ TV ห้องฉุกเฉิน และระบบติดตามผลแลป), ลดการใช้ RAM (~20–30 MB) และควบคุม Connection Pool ไปยังฐานข้อมูล HOSxP ได้อย่างแม่นยำ

---

## 🚀 คุณลักษณะการทำงาน (Features)

1. **High-Performance Routing (Gin Framework):** ทำงานรวดเร็ว Response time < 5ms
2. **Dedicated HOSxP Connection Pool:**
   - `MaxOpenConns: 15`
   - `MaxIdleConns: 5`
   - `ConnMaxLifetime: 5 นาที`
   - `ConnMaxIdleTime: 1 นาที`
   - ป้องกันปัญหา HOSxP Connection ล้นหรือค้างจากหน้าจอ Polling
3. **In-Memory Caching Layer:**
   - แคชผลลัพธ์ ER Live Status อายุ 8 วินาที (Thread-safe `sync.RWMutex`) ช่วยลดภาระ HOSxP ได้กว่า 90%
4. **Shared Member Session Authentication:**
   - ตรวจสอบคุกกี้ `member_session` ด้วยระบบ HMAC-SHA256 แบบ Timing-safe ร่วมกับ Next.js ได้โดยตรง
5. **Endpoints ที่พร้อมใช้งาน (Phase 1 & Phase 2):**
   - `GET /health` — Health check
   - `GET /api/appointment` — ค้นหาวันนัดหมายแพทย์สำหรับประชาชน (In-Memory IP Rate Limiting 30 req/15min + PDPA Thai Name Masking)
   - `GET /api/stream` — สตรีมมิ่งวิดีโอ Hero Slides และไฟล์มีเดีย (HTTP 206 Partial Content / Range Requests Zero-copy)
   - `GET /api/er/status` — สถานะห้องฉุกเฉินเรียลไทม์ (รองรับโหมด TV: `?mode=tv` และ In-Memory Cache 8 วินาที)
   - `GET /api/service/loratadine-dispense` — มอนิเตอร์การสั่งจ่ายยาลอราทาดีน (กรองอายุ `?age=adult` และสรุปสถิติ)
   - `GET /api/service/lab-tracker/report` — รายงานความคืบหน้าการส่งตรวจ LAB (รองรับกรองแพทย์: `?id=...`)
   - `GET /api/service/lab-tracker/doctors` — รายชื่อแพทย์และเจ้าหน้าที่ผู้สั่งตรวจประจำวัน
   - `GET /api/service/lab-tracker/detail` — รายละเอียดผลตรวจและรายการค้างตรวจรายบุคคล (`?hn=...`)

---

## 🛠️ วิธีการรันและทดสอบ (Getting Started)

### 1. ทดสอบรันในโหมดพัฒนา (Development Mode)
```bash
cd backend-go
go run ./cmd/server
```

### 2. คอมไพล์เป็นไฟล์ Executable (.exe สำหรับ Production)
```bash
cd backend-go
go build -ldflags="-s -w" -o thoen-backend.exe ./cmd/server
```

### 3. รัน Unit Tests
```bash
cd backend-go
go test -v ./...
```

---

## 🔄 การเชื่อมต่อกับ Next.js (Strangler Fig Gateway)
เมื่อต้องการให้หน้าเว็บ Next.js ส่งต่อคำขอของ ER Status และ Lab Tracker มายัง Go Backend:
1. เปิดใช้งานในไฟล์ `.env` ที่โฟลเดอร์หลัก:
   ```env
   GO_BACKEND_URL="http://localhost:8080"
   ```
2. รีสตาร์ท Next.js — ระบบจะทำการ Proxy คำขอจากเบราว์เซอร์มายัง Go Backend ที่ Port 8080 อัตโนมัติ โดยไม่ต้องแก้โค้ดหน้าบ้านใดๆ
