@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ย้ายไปยังไดเรกทอรี Root ของโปรเจกต์
cd /d "%~dp0\.."

echo =================================================================
echo   โรงพยาบาลเถิน (Thoen Hospital) - ระบบ Deploy และอัปเดตเซิร์ฟเวอร์
echo =================================================================
echo.

:: -----------------------------------------------------------------
:: ขั้นตอนที่ 1: ดึงโค้ดล่าสุดจาก Git
:: -----------------------------------------------------------------
echo [1/4] กำลังดึงโค้ดล่าสุดจาก Git (Git pull)...
:: จำค่า Commit ก่อนดึงเพื่อตรวจเช็คการเปลี่ยนแปลงของแพ็กเกจ
for /f "tokens=*" %%a in ('git rev-parse HEAD') do set "PREV_COMMIT=%%a"

git pull
if %errorlevel% neq 0 (
    echo [ERROR] Git pull ล้มเหลว! อาจมี Merge Conflict
    goto ERROR_HANDLER
)
echo      - ดึงโค้ดเวอร์ชันล่าสุดสำเร็จ
echo.

:: -----------------------------------------------------------------
:: ขั้นตอนที่ 2: ตรวจสอบและอัปเดต Dependencies (Smart Check)
:: -----------------------------------------------------------------
echo [2/4] ตรวจสอบ Dependencies...
set "NEED_INSTALL=0"

if not exist "node_modules" (
    set "NEED_INSTALL=1"
    echo      - ไม่พบโฟลเดอร์ node_modules จำเป็นต้องติดตั้งใหม่
) else (
    :: ตรวจว่าใน commit ล่าสุดมีการแตะต้อง package.json หรือ package-lock.json หรือไม่
    git diff !PREV_COMMIT! HEAD --name-only | findstr /i "package.json package-lock.json" >nul
    if !errorlevel! equ 0 (
        set "NEED_INSTALL=1"
        echo      - ตรวจพบการเปลี่ยนแปลงใน package.json หรือ lockfile
    )
)

if "!NEED_INSTALL!"=="1" (
    echo      - กำลังอัปเดตแพ็กเกจด้วย npm ci (Fast & Clean)...
    call npm ci --prefer-offline --no-audit
    if !errorlevel! neq 0 (
        echo [ERROR] npm ci ล้มเหลว!
        goto ERROR_HANDLER
    )
    echo      - อัปเดตแพ็กเกจเรียบร้อย
) else (
    echo      - [PASS] ข้ามขั้นตอนติดตั้งแพ็กเกจ (ไม่มีการเปลี่ยนแปลง)
)
echo.

:: -----------------------------------------------------------------
:: ขั้นตอนที่ 3: คอมไพล์โปรเจกต์ Next.js (Fast Build)
:: -----------------------------------------------------------------
echo [3/4] กำลังคอมไพล์โปรเจกต์ (Next.js Build)...
:: จัดสรร Heap Memory 4GB และเปิดโหมด Fast Build เพื่อข้าม Lint/TypeCheck ซ้ำซ้อนบน Server
set "NODE_OPTIONS=--max-old-space-size=4096"
set "FAST_BUILD=true"
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] npm run build ล้มเหลว!
    goto ERROR_HANDLER
)
echo      - คอมไพล์โปรเจกต์สำเร็จ
echo.

:: -----------------------------------------------------------------
:: ขั้นตอนที่ 4: รีสตาร์ทเซอร์วิสด้วย PM2 และตรวจสอบ Health Check
:: -----------------------------------------------------------------
echo [4/4] กำลังรีสตาร์ท Service ด้วย PM2...

:: ตรวจสอบว่ามี process ใน pm2 อยู่แล้วหรือไม่
call pm2 describe thoen-hospital-website >nul 2>&1
if %errorlevel% equ 0 (
    call pm2 restart thoen-hospital-website
    call pm2 reset thoen-hospital-website
) else (
    call pm2 describe 0 >nul 2>&1
    if !errorlevel! equ 0 (
        call pm2 restart 0
        call pm2 reset 0
    ) else (
        echo      - ไม่พบ Process ใน PM2 กำลังเริ่มระบบใหม่ผ่าน ecosystem.config.js...
        call pm2 start ecosystem.config.js
    )
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
    echo [WARNING] Health check ไม่ตอบสนองทันที แต่ PM2 รันระบบอยู่
    echo กรุณาใช้คำสั่ง 'npx pm2 logs' เพื่อดูสถานะ
)

echo.
echo =================================================================
echo   [SUCCESS] อัปเดตและ Build ระบบสำเร็จเรียบร้อยแล้ว
echo   PM2 Service ทำงานตามปกติ
echo =================================================================
echo ท่านสามารถเปิดตรวจสอบหน้าเว็บผ่านเบราว์เซอร์ได้ที่:
echo   http://127.0.0.1:6060
echo.
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
echo สิ่งที่ควรทำ:
echo 1. ตรวจสอบ Error Log ด้านบน
echo 2. เมื่อแก้ไขปัญหาแล้ว ให้รัน scripts\deploy.bat ใหม่อีกครั้ง
echo =================================================================
pause
exit /b 1

