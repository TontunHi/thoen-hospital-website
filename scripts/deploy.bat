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
:: ขั้นตอนที่ 1: หยุด Service เดิมที่พอร์ต 6060 (ถ้ามี)
:: -----------------------------------------------------------------
echo [1/4] หยุดโปรเซสเดิมที่ใช้งานพอร์ต 6060...
powershell -NoProfile -Command ^
    "$conns = Get-NetTCPConnection -LocalPort 6060 -ErrorAction SilentlyContinue; " ^
    "if ($conns) { " ^
    "  $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique; " ^
    "  foreach ($p in $pids) { " ^
    "    if ($p -gt 0) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } " ^
    "  } " ^
    "}"
echo      - เคลียร์พอร์ต 6060 เรียบร้อย
echo.

:: -----------------------------------------------------------------
:: ขั้นตอนที่ 2: ดึงโค้ดล่าสุดจาก Git และอัปเดต Dependencies
:: -----------------------------------------------------------------
echo [2/4] กำลังดึงโค้ดและอัปเดตแพ็กเกจ (Git pull & NPM install)...
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
:: ขั้นตอนที่ 3: คอมไพล์โปรเจกต์ Next.js สำหรับ Production
:: -----------------------------------------------------------------
echo [3/4] กำลังคอมไพล์โปรเจกต์ (Next.js Build)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] npm run build ล้มเหลว!
    goto ERROR_HANDLER
)
echo      - คอมไพล์โปรเจกต์สำเร็จ
echo.

:: -----------------------------------------------------------------
:: ขั้นตอนที่ 4: เริ่มต้นระบบบนพอร์ต 6060 และตรวจสอบสถานะ (Health Check)
:: -----------------------------------------------------------------
echo [4/4] กำลังสตาร์ทเซิร์ฟเวอร์ที่พอร์ต 6060...
start "Thoen Hospital Production Server (Port 6060)" /min cmd.exe /c "npm start -- -p 6060 -H 127.0.0.1"

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
echo   เว็บไซต์โรงพยาบาลเถินเปิดให้บริการตามปกติ
echo =================================================================
echo ท่านสามารถเปิดตรวจสอบหน้าเว็บผ่านเบราว์เซอร์บนเซิร์ฟเวอร์ได้ที่:
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
