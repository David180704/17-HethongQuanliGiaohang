# Test SONG SONG web + mobile tren cung mot backend.
#
#   Giai doan 1 - chay dong thoi:
#     [Web]    Playwright: Web Khach hang (apps/web)
#     [Mobile] Maestro:    App Nhan vien tren may ao Android (apps/staff/.maestro)
#   Giai doan 2 - lien thiet bi (cac chuc nang lien quan den nhau):
#     Playwright dieu khien web, goi Maestro dieu khien may ao xen ke tung buoc
#     (apps/web/tests-e2e/mobile-cross.spec.js):
#       - admin them/xoa khu vuc tren may ao -> khach thay/khong thay tren web
#       - admin khoa/mo tai khoan tren may ao -> khach bi chan/vao lai tren web
#
# Can chay truoc: code\start-dev.ps1 (API 4044, Web 5173, Metro 8082).
# Cach dung (trong thu muc code):
#   powershell -ExecutionPolicy Bypass -File .\test-song-song.ps1
#   powershell -ExecutionPolicy Bypass -File .\test-song-song.ps1 -OnlyCross   # chi giai doan 2
param([switch]$OnlyCross)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\scripts\mobile-common.ps1"

Assert-Tools
Assert-Servers -NeedWeb
$serial = Start-EmulatorIfNeeded
Initialize-Emulator $serial

$webDir = Join-Path $PSScriptRoot "apps\web"
$staffDir = Join-Path $PSScriptRoot "apps\staff"
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
  Write-Step "Giai doan 1: Web (Playwright) va Mobile (Maestro) chay DONG THOI"
  $webLog = Join-Path $logDir "web.log"
  $mobileLog = Join-Path $logDir "mobile.log"
  $web = Start-Logged "/d /c npx playwright test > `"$webLog`" 2>&1" $webDir
  $mobile = Start-Logged "/d /c `"`"$script:MaestroBin`" test .maestro --format HTML --output maestro-report\bao-cao.html > `"$mobileLog`" 2>&1`"" $staffDir
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while (-not ($web.HasExited -and $mobile.HasExited)) {
    Start-Sleep -Seconds 10
    $state = "web: $(if ($web.HasExited) { 'xong' } else { 'dang chay' }) | mobile: $(if ($mobile.HasExited) { 'xong' } else { 'dang chay' })"
    Write-Host ("  [{0:mm\:ss}] {1}" -f $sw.Elapsed, $state)
  }
  $web.WaitForExit()
  $mobile.WaitForExit()
  $results["Web (Playwright)"] = $web.ExitCode
  $results["Mobile (Maestro)"] = $mobile.ExitCode
  Write-Host "  Log: $webLog | $mobileLog"
}

Write-Step "Giai doan 2: lien thiet bi (may ao <-> trinh duyet)"
$env:E2E_MOBILE = "1"
Push-Location $webDir
try {
  & npx playwright test tests-e2e/mobile-cross.spec.js
  $results["Lien thiet bi"] = $LASTEXITCODE
} finally {
  Pop-Location
  Remove-Item Env:\E2E_MOBILE
}

Remove-MobileTestData
Write-Host ""
Write-Host "KET QUA" -ForegroundColor Cyan
$failed = 0
foreach ($name in $results.Keys) {
  $ok = $results[$name] -eq 0
  if (-not $ok) { $failed++ }
  Write-Host ("  {0,-20} {1}" -f $name, $(if ($ok) { "PASS" } else { "FAIL (ma $($results[$name]))" })) `
    -ForegroundColor $(if ($ok) { "Green" } else { "Red" })
}
exit $failed
