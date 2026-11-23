# Registers Laqta in the Windows 11 right-click menu (current user only).
# Needs Developer Mode: Settings > System > For developers > Developer Mode = On.
# Undo with uninstall.ps1.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dev = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock' -ErrorAction SilentlyContinue).AllowDevelopmentWithoutDevLicense
if ($dev -ne 1) {
  Write-Host 'Developer Mode is off. Turn it on: Settings > System > For developers > Developer Mode, then run this again.' -ForegroundColor Yellow
  Start-Process 'ms-settings:developers'
  exit 1
}
if (-not (Test-Path "$PSScriptRoot\LaqtaMenu.dll")) { throw "LaqtaMenu.dll missing - run build.cmd first" }
Get-AppxPackage -Name 'Laqta.ContextMenu' | Remove-AppxPackage   # re-register cleanly (e.g. after moving the folder)
Add-AppxPackage -Register (Join-Path $root 'AppxManifest.xml') -ForceApplicationShutdown
Write-Host 'Done. Right-click the desktop or inside a folder to see "Laqta".' -ForegroundColor Green
