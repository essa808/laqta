@echo off
rem Builds LaqtaMenu.dll with the Visual Studio C++ build tools (x64).
setlocal enabledelayedexpansion
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
rem delayed expansion: the "(x86)" in the path would otherwise close the for loop's parentheses
for /f "usebackq delims=" %%i in (`"!VSWHERE!" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VS=%%i"
if not defined VS (echo Visual Studio C++ build tools not found & exit /b 1)
call "%VS%\VC\Auxiliary\Build\vcvars64.bat" >nul || exit /b 1
cd /d "%~dp0"
cl /nologo /LD /EHsc /O2 /utf-8 /W4 /DUNICODE /D_UNICODE LaqtaMenu.cpp /link /DEF:LaqtaMenu.def /OUT:LaqtaMenu.dll || exit /b 1
del /q LaqtaMenu.obj LaqtaMenu.exp LaqtaMenu.lib 2>nul
echo built %~dp0LaqtaMenu.dll
