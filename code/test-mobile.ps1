# Test App Nhan vien tren may ao Android bang Maestro.
#   - Tu bat may ao neu chua chay, noi cong ve may dev, tat cac hop thoai gay nhieu
#   - Chay toan bo flow trong apps/staff/.maestro (hoac 1 flow), xuat bao cao HTML
#
# Can chay truoc: API (4044) + Metro App Nhan vien (8082) -> code\start-dev.ps1
#
# Cach dung (trong thu muc code):
#   powershell -ExecutionPolicy Bypass -File .\test-mobile.ps1                 # chay het
#   powershell -ExecutionPolicy Bypass -File .\test-mobile.ps1 -Flow 03-admin-trang-chu
#   powershell -ExecutionPolicy Bypass -File .\test-mobile.ps1 -OpenOnly       # chi mo app tren may ao
param(
  [string]$Flow,
  [switch]$OpenOnly
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\scripts\mobile-common.ps1"

Assert-Tools
Assert-Servers
$serial = Start-EmulatorIfNeeded
Initialize-Emulator $serial

if ($OpenOnly) {
  & $script:Adb -s $serial shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8082" host.exp.exponent | Out-Null
  Write-Step "Da mo App Nhan vien tren may ao"
  exit 0
}

$staffDir = Join-Path $PSScriptRoot "apps\staff"
$reportDir = Join-Path $staffDir "maestro-report"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$target = if ($Flow) { ".maestro\$($Flow -replace '\.yaml$', '').yaml" } else { ".maestro" }

Write-Step "Chay Maestro: $target"
Push-Location $staffDir
try {
  # Duong dan TUONG DOI: duong dan tuyet doi cua du an co chu tieng Viet co dau,
  # di qua maestro.bat bi vo bang ma -> Java bao InvalidPathException.
  & $script:MaestroBin test $target --format HTML --output "maestro-report\bao-cao.html" --test-output-dir "maestro-report\chi-tiet"
  $code = $LASTEXITCODE
} finally {
  Pop-Location
}

Remove-MobileTestData
Write-Host ""
if ($code -eq 0) {
  Write-Host "TAT CA FLOW MOBILE PASS" -ForegroundColor Green
} else {
  Write-Fail "Co flow mobile that bai (ma thoat $code)"
}
Write-Host "Bao cao: $reportDir\bao-cao.html"
Write-Host "Anh chup / log tung buoc: $reportDir\chi-tiet"
exit $code
