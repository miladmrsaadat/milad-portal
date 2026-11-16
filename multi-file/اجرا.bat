@echo off
setlocal
cd /d "%~dp0"
title Portal Milad
echo Starting local portal...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve-portal.ps1"
if errorlevel 1 (
  echo.
  echo Could not start. Close this window and try again, or double-click the stop file first.
  pause
)
