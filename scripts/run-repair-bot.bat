@echo off
chcp 65001 > nul
title Thoen Hospital - Telegram Repair Polling Service

echo ========================================================
echo  Thoen Hospital Telegram Staff & Notification Polling
echo  Starting Service (24/7 Outbound Long-Polling)
echo ========================================================

cd /d "%~dp0\.."

:loop
echo [%date% %time%] Starting Telegram Polling Bot...
call cmd.exe /c "npx tsx scripts/telegramRepairPollingBot.ts"

echo --------------------------------------------------------
echo [%date% %time%] Bot process stopped or crashed.
echo Restarting in 10 seconds... (Press Ctrl+C to cancel)
echo --------------------------------------------------------
timeout /t 10 /nobreak > nul
goto loop
