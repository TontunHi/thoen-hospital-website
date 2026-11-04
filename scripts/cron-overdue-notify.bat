@echo off
chcp 65001 >nul

:: กำหนด URL ปลายทาง (Default พอร์ต Production 6060, สามารถ Override ผ่านตัวแปร CRON_API_URL ได้)
if "%CRON_API_URL%"=="" (
    set "CRON_API_URL=http://127.0.0.1:6060/api/cron/equipment-overdue-notify"
)

:: ตรวจสอบ Token จาก Environment หรือใช้ค่า Default
if "%CRON_SECRET%"=="" (
    set "CRON_SECRET=c7e39a2b8f41065d83e91a5c2d7e4b901f683a42c5b9e071"
)

echo [%date% %time%] Dispatching equipment overdue notification to: %CRON_API_URL%
curl -s -X POST -H "Authorization: Bearer %CRON_SECRET%" "%CRON_API_URL%"
echo.
