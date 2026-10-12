@echo off
chcp 65001 > nul
setlocal

:: Resolve Project Directory dynamically
set "PROJECT_DIR=%~dp0.."
cd /d "%PROJECT_DIR%"

set "LOG_DIR=%PROJECT_DIR%\scripts"
set "LOG_FILE=%LOG_DIR%\ipd-chart-bot.log"

echo ======================================================== >> "%LOG_FILE%"
echo [%date% %time%] Starting Daily IPD Incomplete Chart Summary... >> "%LOG_FILE%"

:: Execute Bot Script
call cmd.exe /c "npx tsx scripts/ipdChartNotificationBot.ts --now" >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    echo [%date% %time%] [ERROR] IPD Chart Summary failed with code %errorlevel% >> "%LOG_FILE%"
) else (
    echo [%date% %time%] [SUCCESS] IPD Chart Summary sent successfully >> "%LOG_FILE%"
)

endlocal
