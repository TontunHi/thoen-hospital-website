@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: เปลี่ยนไดเรกทอรีไปยัง Root ของโปรเจกต์
cd /d "%~dp0\.."

echo =================================================================
echo   โรงพยาบาลเถิน (Thoen Hospital) - ระบบ Deploy และอัปเดตเซิร์ฟเวอร์
echo =================================================================
echo.

:: -----------------------------------------------------------------
:: ขั้นตอนที่ 1: เปิด Maintenance Mode
:: -----------------------------------------------------------------
echo [1/6] กำลังเปิดโหมดบำรุงรักษา (Maintenance Mode)...
echo maintenance > "maintenance.flag"
echo maintenance > "public\maintenance.flag"
echo      - สร้างไฟล์ maintenance.flag เรียบร้อย
echo      - ผู้ใช้งานภายนอกจะเห็นหน้า "กำลังปรับปรุงระบบชั่วคราว" ทันที
echo.

:: -----------------------------------------------------------------
:: ขั้นตอนที่ 2: หยุดการทำงานชั่วคราวของ PM2 (ถ้ากำลังรันอยู่)
:: -----------------------------------------------------------------
echo [2/6] สั่งพักการทำงานชั่วคราวของ PM2...
call npx pm2 stop thoen-hospital-website >nul 2>&1
echo      - หยุด Service สำเร็จ (IIS จะแสดงหน้า Maintenance รองรับอัตโนมัติ)
echo.

:: -----------------------------------------------------------------
:: ขั้นตอนที่ 3: ดึงโค้ดล่าสุดจาก Git และอัปเดต Dependencies
:: -----------------------------------------------------------------
echo [3/6] กำลังดึงโค้ดและอัปเดตแพ็กเกจ (Git pull & NPM install)...
git pull
if %errorlevel% neq 0 (
    echo [ERROR] Git pull ล้มเหลว! อาจมี Merge Conflict
    goto ERROR_HANDLER
)

call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install ล้มเหลว!
    goto ERROR_HANDLER
)
echo      - อัปเดตแพ็กเกจเรียบร้อย
echo.

:: -----------------------------------------------------------------
:: ขั้นตอนที่ 4: ซิงค์ฐานข้อมูล Prisma (Generate & Push)
:: -----------------------------------------------------------------
echo [4/6] กำลังสร้าง Prisma Client และตรวจสอบฐานข้อมูล...
call npx prisma generate
if %errorlevel% neq 0 (
    echo [ERROR] prisma generate ล้มเหลว!
    goto ERROR_HANDLER
)

call npx prisma db push --skip-generate
if %errorlevel% neq 0 (
    echo [ERROR] prisma db push ล้มเหลว!
    goto ERROR_HANDLER
)
echo      - ฐานข้อมูลพร้อมใช้งาน
echo.

:: -----------------------------------------------------------------
:: ขั้นตอนที่ 5: คอมไพล์โปรเจกต์ Next.js สำหรับ Production
:: -----------------------------------------------------------------
echo [5/6] กำลังคอมไพล์โปรเจกต์ (Next.js Build)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] npm run build ล้มเหลว!
    goto ERROR_HANDLER
)
echo      - คอมไพล์โปรเจกต์สำเร็จ
echo.

:: -----------------------------------------------------------------
:: ขั้นตอนที่ 6: เริ่มต้นระบบ PM2 และตรวจสอบสุขภาพระบบ (Health Check)
:: -----------------------------------------------------------------
echo [6/6] สั่งเริ่มระบบบน PM2 และตรวจสอบสถานะ (Health Check)...
call npx pm2 start ecosystem.config.js
if %errorlevel% neq 0 (
    echo [WARN] pm2 start มีข้อผิดพลาด ลองสั่ง pm2 restart...
    call npx pm2 restart thoen-hospital-website
)

echo      - รอ Service บูตระบบและเช็ค Health Check ที่พอร์ต 6060...
powershell -NoProfile -Command ^
    "$ok = $false; " ^
    "for ($i=1; $i -le 15; $i++) { " ^
    "  try { " ^
    "    $res = Invoke-RestMethod -Uri 'http://127.0.0.1:6060/api/health' -TimeoutSec 3 -ErrorAction Stop; " ^
    "    if ($res.status -in @('healthy', 'degraded')) { $ok = $true; break } " ^
    "  } catch {} " ^
    "  Write-Host ('       กำลังรอระบบพร้อมใช้งาน... (' + $i + '/15)'); " ^
    "  Start-Sleep -Seconds 2 " ^
    "}; " ^
    "if (-not $ok) { exit 1 }"

if %errorlevel% neq 0 (
    echo [ERROR] Health check ไม่ผ่านภายใน 30 วินาที! พอร์ต 6060 อาจยังไม่พร้อม
    goto ERROR_HANDLER
)

echo.
echo =================================================================
echo   [SUCCESS] อัปเดตและ Build ระบบสำเร็จเรียบร้อยแล้ว (200 OK)
echo =================================================================
echo ท่านสามารถเปิดตรวจสอบหน้าเว็บผ่านเบราว์เซอร์บนเซิร์ฟเวอร์ได้ที่:
echo   http://127.0.0.1:6060
echo.
echo * หมายเหตุ: ผู้ใช้งานภายนอกยังคงเห็นหน้า Maintenance จนกว่าท่านจะกด Enter
echo.
set /p CONFIRM="กด [Enter] เพื่อปลดหน้า Maintenance และเปิดให้บริการสู่สาธารณะ... "

:: ปลด Maintenance Flag
if exist "maintenance.flag" del /f /q "maintenance.flag"
if exist "public\maintenance.flag" del /f /q "public\maintenance.flag"

echo.
echo 🎉 ปลดโหมด Maintenance เรียบร้อยแล้ว! เว็บไซต์โรงพยาบาลเถินเปิดให้บริการตามปกติ
echo =================================================================
pause
exit /b 0

:: -----------------------------------------------------------------
:: จัดการเมื่อเกิดข้อผิดพลาด
:: -----------------------------------------------------------------
:ERROR_HANDLER
echo.
echo =================================================================
echo   [FATAL ERROR] เกิดข้อผิดพลาดระหว่างกระบวนการ Deploy!
echo =================================================================
echo [SAFETY LOCK] หน้า Maintenance ยังคงเปิดใช้งานอยู่ (maintenance.flag)
echo เพื่อป้องกันไม่ให้ผู้ใช้งานเห็นหน้าพังหรือข้อผิดพลาด
echo.
echo สิ่งที่ควรทำ:
echo 1. ตรวจสอบ Error Log ด้านบน
echo 2. ตรวจสอบ Log ของ PM2 ด้วยคำสั่ง: npx pm2 logs thoen-hospital-website
echo 3. เมื่อแก้ไขปัญหาแล้ว ให้รัน scripts\deploy.bat ใหม่อีกครั้ง
echo    หรือหากต้องการปลดหน้า Maintenance เอง ให้รัน scripts\maintenance-off.bat
echo =================================================================
pause
exit /b 1
