# Test 2 app mobile tren may ao Android bang Maestro:
#   App Nhan vien   (apps/staff/.maestro,           Metro 8082)
#   App Khach hang  (apps/customer-mobile/.maestro, Metro 8083)
#   - Tu bat may ao neu chua chay, noi cong ve may dev, tat cac hop thoai gay nhieu
#   - Chay cac flow (hoac 1 flow), xuat bao cao HTML trong maestro-report cua tung app
#
# Can chay truoc: code\start-dev.ps1 -Local  (API dung CSDL local + Metro 2 app)
#
# Cach dung (trong thu muc code):
#   powershell -ExecutionPolicy Bypass -File .\test-mobile.ps1                          # ca 2 app
#   powershell -ExecutionPolicy Bypass -File .\test-mobile.ps1 -App customer            # chi App Khach hang
#   powershell -ExecutionPolicy Bypass -File .\test-mobile.ps1 -App staff -Flow 03-admin-trang-chu
#   powershell -ExecutionPolicy Bypass -File .\test-mobile.ps1 -OpenOnly -App customer # chi mo app de demo
param(
  [ValidateSet("all", "staff", "customer")][string]$App = "all",
  [string]$Flow,
  [switch]$OpenOnly
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\scripts\mobile-common.ps1"

$apps = if ($App -eq "all") { @("staff", "customer") } else { @($App) }
$needStaff = $apps -contains "staff"
$needCustomer = $apps -contains "customer"
if ($OpenOnly -and $App -eq "all") { $needCustomer = $false }

Assert-Tools
Assert-Servers -NeedStaff:$needStaff -NeedCustomer:$needCustomer
$serial = Start-EmulatorIfNeeded
Initialize-Emulator $serial

if ($OpenOnly) {
  $openApp = if ($App -eq "customer") { "customer" } else { "staff" }
  Open-ExpoApp $serial $openApp
  Write-Step ("Da mo " + $(if ($openApp -eq "customer") { "App Khach hang" } else { "App Nhan vien" }) + " tren may ao")
  exit 0
}

Assert-LocalDatabase

$failed = 0
foreach ($name in $apps) {
  $appDir = Join-Path $PSScriptRoot $(if ($name -eq "customer") { "apps\customer-mobile" } else { "apps\staff" })
  $label = if ($name -eq "customer") { "App Khach hang" } else { "App Nhan vien" }
  $reportDir = Join-Path $appDir "maestro-report"
  New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
  $target = if ($Flow) { ".maestro\$($Flow -replace '\.yaml$', '').yaml" } else { ".maestro" }

  Write-Step "Chay Maestro ($label): $target"
  Push-Location $appDir
  try {
    # Duong dan TUONG DOI: duong dan tuyet doi cua du an co chu tieng Viet co dau,
    # di qua maestro.bat bi vo bang ma -> Java bao InvalidPathException.
    & $script:MaestroBin test $target --format HTML --output "maestro-report\bao-cao.html" --test-output-dir "maestro-report\chi-tiet"
    if ($LASTEXITCODE -ne 0) { $failed++ ; Write-Fail "$label co flow that bai (ma thoat $LASTEXITCODE)" }
  } finally {
    Pop-Location
  }
  Write-Host "  Bao cao: $reportDir\bao-cao.html"
}

Remove-MobileTestData
Write-Host ""
if ($failed -eq 0) {
  Write-Host "TAT CA FLOW MOBILE PASS" -ForegroundColor Green
} else {
  Write-Fail "$failed app co flow mobile that bai"
}
exit $failed
