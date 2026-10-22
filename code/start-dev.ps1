# Bat toan bo moi truong dev de test SONG SONG khach hang + nhan vien:
#   Mongo + Redis (Docker), API :4044, Web Khach hang :5173, App Nhan vien :8082
# Moi server mot cua so rieng, dong cua so = tat server do.
#
# Chay:  cd code
#        powershell -ExecutionPolicy Bypass -File .\start-dev.ps1
#
# File nay chi dung ky tu ASCII: PowerShell 5.1 doc .ps1 khong BOM theo bang ma
# ANSI, tieng Viet co dau se bi vo.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "[1/4] Mongo + Redis (Docker)..." -ForegroundColor Cyan
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

# Ep Expo quang ba dung IP nay trong ma QR. App Nhan vien lay dia chi API theo
# chinh IP nay (src/config.js), nen sai IP la dien thoai khong goi duoc API.
if ($lanIp) { $env:REACT_NATIVE_PACKAGER_HOSTNAME = $lanIp }

Write-Host "[2/4] API :4044" -ForegroundColor Cyan
Start-DevWindow "EDMS API :4044" "$root\apps\api" "npm run dev"

Write-Host "[3/4] Web Khach hang :5173 (--host de dien thoai mo duoc)" -ForegroundColor Cyan
Start-DevWindow "EDMS Web Khach hang :5173" "$root\apps\web" "npm run dev -- --host"

Write-Host "[4/4] App Nhan vien :8082 (Expo)" -ForegroundColor Cyan
Start-DevWindow "EDMS App Nhan vien :8082" "$root\apps\staff" "npm start"

Write-Host ""
Write-Host "May tinh (doi ~30 giay cho server khoi dong):" -ForegroundColor Green
Write-Host "  Web Khach hang : http://localhost:5173"
Write-Host "  App Nhan vien  : http://localhost:8082"
Write-Host "  Swagger API    : http://localhost:4044/api-docs"
if ($lanIp) {
  Write-Host ""
  Write-Host "Dien thoai (cung Wi-Fi voi may nay):" -ForegroundColor Green
  Write-Host "  Web Khach hang : http://${lanIp}:5173"
  Write-Host "  App Nhan vien  : mo Expo Go, quet ma QR trong cua so 'EDMS App Nhan vien'"
  Write-Host ""
  Write-Host "Dien thoai khong ket noi duoc? Mo PowerShell (Run as Administrator) chay 1 lan:" -ForegroundColor Yellow
  Write-Host "  New-NetFirewallRule -DisplayName 'EDMS dev' -Direction Inbound -Protocol TCP -LocalPort 4044,5173,8082 -Action Allow -Profile Private"
}
Write-Host ""
Write-Host "Tai khoan demo (mat khau Password123!): admin@edms.vn, hubstaff1@edms.vn, shipper1@edms.vn, customer1@edms.vn"
