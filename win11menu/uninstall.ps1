# Removes Laqta from the Windows 11 right-click menu. App files are not touched.
Get-AppxPackage -Name 'Laqta.ContextMenu' | Remove-AppxPackage
Write-Host 'Removed.'
