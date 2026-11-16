@echo off
cd /d "%~dp0"
title Stop Portal Milad
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve-portal.ps1" -Stop
echo.
echo Done. You can close this window.
ping -n 3 127.0.0.1 >nul
