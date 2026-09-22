@echo off
chcp 65001 > nul
title Thoen Hospital - Appointment Mismatch Telegram Bot

echo ========================================================
echo  Thoen Hospital Appointment Mismatch Telegram Bot
echo  Starting Service (24/7 with Daily 08:00 & 16:00 Report)
echo ========================================================

cd /d "%~dp0\.."

:loop
echo [%date% %time%] Starting Telegram Bot Service...
call cmd.exe /c "npx tsx scripts/appointmentMismatchBot.ts"

echo --------------------------------------------------------
echo [%date% %time%] Bot process stopped or crashed.
echo Restarting in 10 seconds... (Press Ctrl+C to cancel)
echo --------------------------------------------------------
timeout /t 10 /nobreak > nul
goto loop
