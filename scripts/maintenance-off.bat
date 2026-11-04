@echo off
chcp 65001 >nul
cd /d "%~dp0\.."

echo [MAINTENANCE OFF] กำลังปลดโหมดปรับปรุงระบบ...
if exist "maintenance.flag" del /f /q "maintenance.flag"
if exist "public\maintenance.flag" del /f /q "public\maintenance.flag"

echo.
echo 🎉 ปลดโหมด Maintenance เรียบร้อยแล้ว!
echo เว็บไซต์โรงพยาบาลเถินเปิดให้บริการตามปกติ
echo.
pause
