@echo off
title ระบบคัดกรองตรวจนอกพื้นที่ - โรงพยาบาลเถิน
echo ===============================================================
echo   กำลังเปิดระบบคัดกรองตรวจนอกพื้นที่ (รพ.เถิน)
echo ===============================================================
echo.
REM พยายามเปิดด้วย Google Chrome พร้อมตั้งค่าความปลอดภัยสำหรับเครื่องอ่านบัตรอัตโนมัติ
start chrome --unsafely-treat-insecure-origin-as-secure="http://localhost:8084,http://127.0.0.1:8084" --user-data-dir="%TEMP%\ThoenScreeningKiosk" https://thlp.moph.go.th/service/screening/scan
if %errorlevel% neq 0 (
    REM หากไม่มี Chrome ให้เปิดด้วย Microsoft Edge
    start msedge --unsafely-treat-insecure-origin-as-secure="http://localhost:8084,http://127.0.0.1:8084" --user-data-dir="%TEMP%\ThoenScreeningKiosk" https://thlp.moph.go.th/service/screening/scan
)
