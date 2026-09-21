@echo off
chcp 65001 > nul

:: กำหนด Path โฟลเดอร์โปรเจกต์บน Windows Server
set "APP_DIR=C:\inetpub\wwwroot\thoen-hospital-website"
set "LOCAL_BACKUP_DIR=%APP_DIR%\backups"
set "NAS_SERVER=\\192.168.130.2"
set "NAS_SHARE=\\192.168.130.2\งาน it"
set "NAS_USER=tontun"
set "NAS_PASS=141800Kid"
set "DRIVE_LETTER=Z:"

cd /d "%APP_DIR%"

if not exist "%LOCAL_BACKUP_DIR%" (
    mkdir "%LOCAL_BACKUP_DIR%"
)

echo ======================================================== >> "%LOCAL_BACKUP_DIR%\scheduler.log"
echo [%date% %time%] Starting Daily Thoen Hospital DB Backup... >> "%LOCAL_BACKUP_DIR%\scheduler.log"

:: 1. รันสำรองข้อมูลฐานข้อมูลลงเครื่องเซิร์ฟเวอร์
call npm run db:backup >> "%LOCAL_BACKUP_DIR%\scheduler.log" 2>&1

:: 2. เคลียร์ Session เก่าที่อาจค้างอยู่
net use %DRIVE_LETTER% /delete /y > nul 2>&1
net use "%NAS_SHARE%" /delete /y > nul 2>&1

:: 3. เชื่อมต่อและ Map เป็น Network Drive Z:
echo [%date% %time%] Connecting to NAS (%NAS_SHARE%) as %DRIVE_LETTER%... >> "%LOCAL_BACKUP_DIR%\scheduler.log"
net use %DRIVE_LETTER% "%NAS_SHARE%" "%NAS_PASS%" /user:%NAS_USER% /persistent:no >> "%LOCAL_BACKUP_DIR%\scheduler.log" 2>&1

if errorlevel 1 (
    echo [%date% %time%] [ERROR] Cannot connect to NAS! Check credential or network. >> "%LOCAL_BACKUP_DIR%\scheduler.log"
    goto END
)

:: 4. ตรวจสอบและสร้างโฟลเดอร์เป้าหมายบน Drive Z: (Z:\Pisut Yimkuson\backups)
set "TARGET_DIR=%DRIVE_LETTER%\Pisut Yimkuson\backups"
if not exist "%TARGET_DIR%" (
    echo [%date% %time%] Creating target folder: "%TARGET_DIR%" >> "%LOCAL_BACKUP_DIR%\scheduler.log"
    mkdir "%TARGET_DIR%" >> "%LOCAL_BACKUP_DIR%\scheduler.log" 2>&1
)

:: 5. คัดลอกไฟล์สำรองข้อมูลไปยัง NAS
echo [%date% %time%] Copying files to NAS... >> "%LOCAL_BACKUP_DIR%\scheduler.log"
robocopy "%LOCAL_BACKUP_DIR%" "%TARGET_DIR%" *.sql.gz /xo /r:2 /w:3 >> "%LOCAL_BACKUP_DIR%\scheduler.log" 2>&1

:: 6. ยกเลิกการ Map Drive Z:
net use %DRIVE_LETTER% /delete /y >> "%LOCAL_BACKUP_DIR%\scheduler.log" 2>&1

:END
echo [%date% %time%] Daily Backup Finished. >> "%LOCAL_BACKUP_DIR%\scheduler.log"

