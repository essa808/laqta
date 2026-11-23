@echo off
rem Double-click to remove Laqta from the Windows 11 right-click menu.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
pause
