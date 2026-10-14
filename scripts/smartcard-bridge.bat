@echo off
chcp 65001 >nul
title โรงพยาบาลเถิน - Smart Card Bridge
echo ===================================================
echo   โรงพยาบาลเถิน - Thoen Smart Card Bridge v1.0
echo ===================================================
echo.

if exist "public\downloads\thoen-smartcard-bridge.exe" (
    echo กำลังเริ่มโปรแกรมเชื่อมต่อเครื่องอ่านบัตร...
    "public\downloads\thoen-smartcard-bridge.exe"
) else (
    echo กำลังคอมไพล์โปรแกรม Thoen Smart Card Bridge...
    C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:exe /out:public\downloads\thoen-smartcard-bridge.exe scripts\SmartCardBridge.cs
    "public\downloads\thoen-smartcard-bridge.exe"
)
pause
