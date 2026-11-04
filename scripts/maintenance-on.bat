@echo off
chcp 65001 >nul
cd /d "%~dp0\.."

echo [MAINTENANCE ON] กำลังเปิดโหมดปรับปรุงระบบ...
echo maintenance > "maintenance.flag"
echo maintenance > "public\maintenance.flag"

echo.
echo ✅ เปิดโหมด Maintenance เรียบร้อยแล้ว!
echo ผู้ใช้งานภายนอกจะเห็นหน้า "กำลังปรับปรุงระบบชั่วคราว"
echo (หากต้องการปลด ให้รัน scripts\maintenance-off.bat)
echo.
pause
