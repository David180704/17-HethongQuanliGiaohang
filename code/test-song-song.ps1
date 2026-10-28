# Test SONG SONG tren cung mot backend (API phai dung CSDL local):
#
#   Giai doan 1 - chay dong thoi:
#     [Trinh duyet] Playwright: Web Khach hang, App Nhan vien (web), App Khach hang (web)
#     [May ao]      Maestro:    App Nhan vien + App Khach hang tren Android
#   Giai doan 2 - lien thiet bi, nhu giao dich that (ben nay thao tac, ben kia kiem tra ngay):
#     a) Nhan vien tren MAY AO (App Nhan vien) -> khach tren WEB
#        (apps/web/tests-e2e/mobile-cross.spec.js): them/xoa khu vuc, khoa/mo tai khoan khach3
#     b) Nhan vien tren WEB (App Nhan vien)    -> khach tren MAY AO (App Khach hang)
#        (apps/customer-mobile/tests-e2e/cross-device.spec.js): khoa/mo tai khoan khach4, them/xoa khu vuc
#
# Can chay truoc: code\start-dev.ps1 -Local (API CSDL local, Web 5173, Metro 8082 + 8083).
# Cach dung (trong thu muc code):
#   powershell -ExecutionPolicy Bypass -File .\test-song-song.ps1
#   powershell -ExecutionPolicy Bypass -File .\test-song-song.ps1 -OnlyCross   # chi giai doan 2
param([switch]$OnlyCross)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\scripts\mobile-common.ps1"

Assert-Tools
Assert-Servers -NeedWeb -NeedStaff -NeedCustomer
Assert-LocalDatabase
$serial = Start-EmulatorIfNeeded
Initialize-Emulator $serial

$webDir = Join-Path $PSScriptRoot "apps\web"
$customerDir = Join-Path $PSScriptRoot "apps\customer-mobile"
$logDir = Join-Path $PSScriptRoot "test-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$results = [ordered]@{}

# Chay lenh nen qua cmd, giu doi tuong Process de lay ExitCode. Khong dung
# Start-Process -PassThru: tren PowerShell 5.1 ExitCode cua no co the rong
# (da gap: bao FAIL trong khi log ghi test pass).
function Start-Logged($arguments, $workingDir) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "cmd.exe"
  $psi.Arguments = $arguments
  $psi.WorkingDirectory = $workingDir
  $psi.UseShellExecute = $false
  return [System.Diagnostics.Process]::Start($psi)
}

if (-not $OnlyCross) {
  Write-Step "Giai doan 1: trinh duyet (Playwright x3) va may ao (Maestro 2 app) chay DONG THOI"
  $webLog = Join-Path $logDir "web.log"
  $mobileLog = Join-Path $logDir "mobile.log"
  $web = Start-Logged "/d /c powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\scripts\run-playwright-all.ps1`" > `"$webLog`" 2>&1" $PSScriptRoot
  $mobile = Start-Logged "/d /c powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\test-mobile.ps1`" -App all > `"$mobileLog`" 2>&1" $PSScriptRoot
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while (-not ($web.HasExited -and $mobile.HasExited)) {
    Start-Sleep -Seconds 15
    $state = "trinh duyet: $(if ($web.HasExited) { 'xong' } else { 'dang chay' }) | may ao: $(if ($mobile.HasExited) { 'xong' } else { 'dang chay' })"
    Write-Host ("  [{0:mm\:ss}] {1}" -f $sw.Elapsed, $state)
  }
  $web.WaitForExit()
  $mobile.WaitForExit()
  $results["Trinh duyet (Playwright x3)"] = $web.ExitCode
  $results["May ao (Maestro 2 app)"] = $mobile.ExitCode
  Write-Host "  Log: $webLog | $mobileLog"
}

Write-Step "Giai doan 2: lien thiet bi (may ao <-> trinh duyet)"
$env:E2E_MOBILE = "1"
try {
  Push-Location $webDir
  & npx playwright test tests-e2e/mobile-cross.spec.js
  $results["NV may ao -> khach web"] = $LASTEXITCODE
  Pop-Location
  Push-Location $customerDir
  & npx playwright test tests-e2e/cross-device.spec.js
  $results["NV web -> khach may ao"] = $LASTEXITCODE
  Pop-Location
} finally {
  Remove-Item Env:\E2E_MOBILE
}

Remove-MobileTestData
Write-Host ""
Write-Host "KET QUA" -ForegroundColor Cyan
$failed = 0
foreach ($name in $results.Keys) {
  $ok = $results[$name] -eq 0
  if (-not $ok) { $failed++ }
  Write-Host ("  {0,-28} {1}" -f $name, $(if ($ok) { "PASS" } else { "FAIL (ma $($results[$name]))" })) `
    -ForegroundColor $(if ($ok) { "Green" } else { "Red" })
}
exit $failed
