# Bat toan bo moi truong dev de DEMO / test SONG SONG khach hang + nhan vien:
#   Mongo + Redis (Docker), API :4044, Web Khach hang :5173,
#   App Nhan vien :8082 (Expo), App Khach hang mobile :8083 (Expo)
# Moi server mot cua so rieng, dong cua so = tat server do.
#
# Chay (trong thu muc code):
#   powershell -ExecutionPolicy Bypass -File .\start-dev.ps1             # API dung .env (Atlas neu da noi) - de DEMO
#   powershell -ExecutionPolicy Bypass -File .\start-dev.ps1 -Local      # API dung CSDL local (Docker) - de TEST
#   powershell -ExecutionPolicy Bypass -File .\start-dev.ps1 -Emulator   # them: bat may ao Android, mo App Khach hang
#
# File nay chi dung ky tu ASCII: PowerShell 5.1 doc .ps1 khong BOM theo bang ma
# ANSI, tieng Viet co dau se bi vo.
param(
  [switch]$Local,
  [switch]$Emulator
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$localUri = "mongodb://localhost:27018/edms?directConnection=true"

Write-Host "[1/5] Mongo + Redis (Docker)..." -ForegroundColor Cyan
docker compose -f "$root\docker-compose.yml" up -d
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker chua chay. Mo Docker Desktop, doi 1 phut roi chay lai script." -ForegroundColor Red
  exit 1
}

function Start-DevWindow($title, $dir, $command) {
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "`$Host.UI.RawUI.WindowTitle = '$title'; Set-Location -LiteralPath '$dir'; $command"
  )
}

# Chon card mang co default gateway (card that ra Internet, vd Wi-Fi). Khong loc
# theo ten: may co card ao VMware/Hyper-V se bi chon nham, dien thoai khong toi duoc.
$lanIp = (Get-NetIPConfiguration -ErrorAction SilentlyContinue |
  Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } |
  Select-Object -First 1).IPv4Address.IPAddress

# Ep Expo quang ba dung IP nay trong ma QR. App lay dia chi API theo chinh IP nay
# (src/config.js), nen sai IP la dien thoai khong goi duoc API.
if ($lanIp) { $env:REACT_NATIVE_PACKAGER_HOSTNAME = $lanIp }

# CSDL API se dung: -Local ep ve Docker; khong thi theo MONGO_URI trong .env (khong in mat khau).
$envFile = Join-Path $root "apps\api\.env"
$cloud = (-not $Local) -and (Test-Path $envFile) -and ((Get-Content $envFile | Where-Object { $_ -match '^MONGO_URI=' }) -match 'mongodb\+srv://|mongodb\.net')
$apiCommand = if ($Local) { "`$env:MONGO_URI='$localUri'; npm run dev" } else { "npm run dev" }
$dbLabel = if ($cloud) { "MongoDB Atlas (cloud, theo .env)" } else { "MongoDB local (Docker)" }

Write-Host "[2/5] API :4044 - CSDL: $dbLabel" -ForegroundColor Cyan
Start-DevWindow "EDMS API :4044" "$root\apps\api" $apiCommand

Write-Host "[3/5] Web Khach hang :5173 (--host de dien thoai mo duoc)" -ForegroundColor Cyan
Start-DevWindow "EDMS Web Khach hang :5173" "$root\apps\web" "npm run dev -- --host"

Write-Host "[4/5] App Nhan vien :8082 (Expo)" -ForegroundColor Cyan
Start-DevWindow "EDMS App Nhan vien :8082" "$root\apps\staff" "npm start"

Write-Host "[5/5] App Khach hang mobile :8083 (Expo)" -ForegroundColor Cyan
Start-DevWindow "EDMS App Khach hang :8083" "$root\apps\customer-mobile" "npm start"

Write-Host ""
Write-Host "May tinh (doi ~30 giay cho server khoi dong):" -ForegroundColor Green
Write-Host "  Web Khach hang        : http://localhost:5173"
Write-Host "  App Nhan vien (web)   : http://localhost:8082"
Write-Host "  App Khach hang (web)  : http://localhost:8083"
Write-Host "  Swagger API           : http://localhost:4044/api-docs"
if ($lanIp) {
  Write-Host ""
  Write-Host "Dien thoai that (cung Wi-Fi voi may nay):" -ForegroundColor Green
  Write-Host "  Web Khach hang : http://${lanIp}:5173"
  Write-Host "  App Nhan vien  : mo Expo Go, quet ma QR trong cua so 'EDMS App Nhan vien :8082'"
  Write-Host "  App Khach hang : mo Expo Go, quet ma QR trong cua so 'EDMS App Khach hang :8083'"
  Write-Host ""
  Write-Host "Dien thoai khong ket noi duoc? Mo PowerShell (Run as Administrator) chay 1 lan:" -ForegroundColor Yellow
  Write-Host "  New-NetFirewallRule -DisplayName 'EDMS dev' -Direction Inbound -Protocol TCP -LocalPort 4044,5173,8082,8083 -Action Allow -Profile Private"
}
Write-Host ""
Write-Host "Tai khoan test (mat khau 123456): admin@edms.vn | kho1..3@edms.vn | taixe1..5@edms.vn | khach1..6@edms.vn | shop1..4@edms.vn"
if ($cloud) {
  Write-Host "Luu y: API dang dung du lieu Atlas. Truoc khi chay test tu dong, tat cua so API va chay lai voi -Local." -ForegroundColor Yellow
}

if ($Emulator) {
  . "$root\scripts\mobile-common.ps1"
  Write-Host ""
  Write-Host "Cho Metro App Khach hang (:8083) san sang..." -ForegroundColor Cyan
  for ($i = 0; $i -lt 90 -and -not (Test-Url "http://localhost:8083"); $i++) { Start-Sleep -Seconds 2 }
  $serial = Start-EmulatorIfNeeded
  Initialize-Emulator $serial
  Open-ExpoApp $serial "customer"
  Write-Step "Da mo App Khach hang tren may ao. Doi sang App Nhan vien: code\test-mobile.ps1 -OpenOnly -App staff"
}
