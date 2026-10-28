# Chay lan luot 3 bo Playwright tren trinh duyet: Web Khach hang, App Nhan vien (web),
# App Khach hang mobile (ban web). Ma thoat = so bo that bai (0 = tat ca pass).
# Dung trong code\test-song-song.ps1; chay rieng cung duoc:
#   powershell -ExecutionPolicy Bypass -File code\scripts\run-playwright-all.ps1
# Chi dung ky tu ASCII (PowerShell 5.1 doc .ps1 khong BOM theo bang ma ANSI).
$root = Split-Path $PSScriptRoot -Parent
$suites = [ordered]@{
  "Web Khach hang"       = Join-Path $root "apps\web"
  "App Nhan vien (web)"  = Join-Path $root "apps\staff"
  "App Khach hang (web)" = Join-Path $root "apps\customer-mobile"
}
$failed = 0
$summary = @()
foreach ($name in $suites.Keys) {
  Write-Host ""
  Write-Host "===== Playwright: $name =====" -ForegroundColor Cyan
  Push-Location $suites[$name]
  try {
    & npx playwright test --reporter=list
    $code = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  if ($code -ne 0) { $failed++ }
  $summary += ("  {0,-22} {1}" -f $name, $(if ($code -eq 0) { "PASS" } else { "FAIL (ma $code)" }))
}
Write-Host ""
Write-Host "KET QUA PLAYWRIGHT" -ForegroundColor Cyan
$summary | ForEach-Object { Write-Host $_ }
exit $failed
