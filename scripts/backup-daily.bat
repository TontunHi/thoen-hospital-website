@echo off
chcp 65001 > nul
cd /d "C:\Users\Tontun\Documents\thoen-hospital-website"

echo [%date% %time%] Starting Daily Thoen Hospital DB Backup... >> backups\scheduler.log
call npm run db:backup >> backups\scheduler.log 2>&1
echo [%date% %time%] Daily Backup Finished. >> backups\scheduler.log
