@echo off
chcp 65001 > nul
setlocal

:: Resolve Project Directory dynamically
set "PROJECT_DIR=%~dp0.."
cd /d "%PROJECT_DIR%"

set "LOG_DIR=%PROJECT_DIR%\scripts"
set "LOG_FILE=%LOG_DIR%\ipd-chart-bot.log"

echo ======================================================== >> "%LOG_FILE%"
echo [%date% %time%] [DISABLED] IPD Chart Summary Notification is temporarily disabled. Skipping execution. >> "%LOG_FILE%"
endlocal
exit /b 0
