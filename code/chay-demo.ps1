# CHAY DEMO tu dau: Web Khach hang (trinh duyet) + App Nhan vien (may ao Android) chay DONG THOI.
#
#   Mo folder du an trong VS Code -> Terminal -> New Terminal, roi chay:
#     powershell -ExecutionPolicy Bypass -File .\code\chay-demo.ps1
#   (hoac Terminal -> Run Task -> "EDMS: CHAY DEMO")
#
#   Tuy chon:
#     -Atlas        dung CSDL MongoDB Atlas trong apps\api\.env (mac dinh: CSDL local trong Docker).
#                   Atlas khong ket noi duoc (IP chua co trong Network Access) -> tu quay ve local.
#     -NoEmulator   khong bat may ao (chi chay web)
#
# Script tu lam:
#   1. Bat Docker (Mongo cong 27018 + Redis), cho Mongo san sang
#   2. Tat cac tien trinh EDMS cu (cua so start-dev chay truoc, server bi sot) de giai phong cong
#   3. Cai thu vien neu thieu, nap du lieu mau neu CSDL rong
#   4. Mo khoa tai khoan test (xoa khoa dang nhap 15 phut sau 5 lan sai)
#   5. Mo 3 cua so: API :4044 -> Web Khach hang :5173 -> App Nhan vien :8082, cho tung cai san sang
#   6. Bat may ao Android, mo App Nhan vien trong Expo Go; mo trinh duyet vao Web Khach hang
#
# Chi dung ky tu ASCII: PowerShell 5.1 doc .ps1 khong BOM theo bang ma ANSI.
param(
  [switch]$Atlas,
  [switch]$NoEmulator
)

# Continue: docker/npm/adb in tien do ra stderr; voi "Stop" PowerShell 5.1 coi do la loi va dung
# ngang script. Moi buoc tu kiem tra ket qua va exit khi that su loi.
$ErrorActionPreference = "Continue"
$root = $PSScriptRoot
$apps = Join-Path $root "apps"
. "$root\scripts\mobile-common.ps1"
$localUri = "mongodb://localhost:27018/edms?directConnection=true"

function Write-Ok($text) { Write-Host "    OK  $text" -ForegroundColor Green }

function Wait-Url($url, $seconds, $name) {
  for ($i = 0; $i -lt $seconds; $i += 2) {
    if (Test-Url $url) { Write-Ok "$name san sang ($url)"; return $true }
    Start-Sleep -Seconds 2
  }
  Write-Fail "$name chua san sang sau $seconds giay ($url) - xem cua so '$name'"
  return $false
}

function Start-DevWindow($title, $dir, $command) {
  Start-Process powershell -ArgumentList @(
    "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
    "`$Host.UI.RawUI.WindowTitle = '$title'; Set-Location -LiteralPath '$dir'; $command"
  ) | Out-Null
}

# ---------------------------------------------------------------- 1. Docker
Write-Step "1/6 Docker: MongoDB (cong 27018) + Redis"
$dockerOk = $false
docker info *> $null
if ($LASTEXITCODE -eq 0) { $dockerOk = $true }
if (-not $dockerOk) {
  $desktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  if (Test-Path $desktop) {
    Write-Host "    Docker chua chay -> mo Docker Desktop, cho toi da 2 phut..."
    Start-Process $desktop
    for ($i = 0; $i -lt 60 -and -not $dockerOk; $i++) {
      Start-Sleep -Seconds 2
      docker info *> $null; $dockerOk = ($LASTEXITCODE -eq 0)
    }
  }
  if (-not $dockerOk) { Write-Fail "Docker chua chay. Mo Docker Desktop, doi chu 'Engine running' roi chay lai."; exit 1 }
}
docker compose -f "$root\docker-compose.yml" up -d 2>&1 | Out-Null
for ($i = 0; $i -lt 45; $i++) {
  $health = docker inspect -f "{{.State.Health.Status}}" edms-mongo 2>$null
  if ($health -eq "healthy") { break }
  Start-Sleep -Seconds 2
}
if ($health -ne "healthy") { Write-Fail "MongoDB trong Docker chua san sang (trang thai: $health)"; exit 1 }
Write-Ok "MongoDB + Redis dang chay"

# ---------------------------------------------------------------- 2. Don tien trinh cu
Write-Step "2/6 Tat cac cua so / server EDMS cu de giai phong cong 4044, 5173, 8082, 8083"
$closed = 0
# Cua so do start-dev.ps1 / chay-demo.ps1 mo truoc do (tieu de 'EDMS ...'): tat ca cay tien trinh
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -match "WindowTitle = 'EDMS " -and $_.ProcessId -ne $PID } |
  ForEach-Object { taskkill /T /F /PID $_.ProcessId *> $null; $closed++ }
# Server con sot lai (vd chay tay, terminal da dong): node cua du an dang giu cong
foreach ($port in 4044, 5173, 8082, 8083) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)"
    if ($proc.Name -eq "node.exe") { taskkill /T /F /PID $proc.ProcessId *> $null; $closed++ }
  }
}
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match "QuanLiGiaoHang\\code\\apps\\(web|staff|customer-mobile)\\node_modules" } |
  ForEach-Object { taskkill /T /F /PID $_.ProcessId *> $null; $closed++ }
Start-Sleep -Seconds 2
Write-Ok "Da tat $closed tien trinh cu"

# ---------------------------------------------------------------- 3. CSDL, thu vien, du lieu mau
Write-Step "3/6 Chon CSDL, kiem tra thu vien va du lieu mau"
foreach ($app in "api", "web", "staff") {
  if (-not (Test-Path (Join-Path $apps "$app\node_modules"))) {
    Write-Host "    Cai thu vien cho $app (lan dau, vai phut)..."
    Push-Location (Join-Path $apps $app); npm install --no-audit --no-fund | Out-Null; Pop-Location
  }
}
$useAtlas = $false
if ($Atlas) {
  Write-Host "    Thu ket noi Atlas (toi da 25 giay)..."
  Push-Location (Join-Path $apps "api")
  $probe = node --input-type=module -e "import { connectDB, disconnectDB } from './src/config/db.js'; try { await connectDB(); await disconnectDB(); console.log('ATLAS_OK'); } catch (e) { console.log('ATLAS_FAIL ' + e.name); } process.exit(0);" 2>&1 | Out-String
  Pop-Location
  if ($probe -match "ATLAS_OK") { $useAtlas = $true; Write-Ok "Dung MongoDB Atlas" }
  else {
    Write-Host "    Atlas khong ket noi duoc (thuong do IP may chua co trong Atlas -> Network Access). Dung CSDL local." -ForegroundColor Yellow
  }
}
if (-not $useAtlas) {
  $count = docker exec edms-mongo mongosh edms --quiet --eval "db.users.countDocuments()" 2>$null
  if ("$count".Trim() -eq "0" -or -not "$count".Trim()) {
    Write-Host "    CSDL local rong -> nap du lieu mau (19 tai khoan, 200 don)..."
    Push-Location (Join-Path $apps "api"); npm run seed:local | Out-Null; Pop-Location
  }
  Write-Ok "Dung CSDL local $localUri"
}

# ---------------------------------------------------------------- 4. Mo khoa tai khoan
Write-Step "4/6 Mo khoa tai khoan test (khoa 15 phut sau 5 lan sai mat khau)"
Push-Location (Join-Path $apps "api")
if ($useAtlas) { $env:MONGO_URI = $null; npm run unlock 2>&1 | Select-String "Redis|Mo lai" | ForEach-Object { Write-Host "    $_" } }
else { npm run unlock -- --local 2>&1 | Select-String "Redis|Mo lai" | ForEach-Object { Write-Host "    $_" } }
Pop-Location

# ---------------------------------------------------------------- 5. Server
Write-Step "5/6 Mo cua so API, Web Khach hang, App Nhan vien"
$lanIp = (Get-NetIPConfiguration -ErrorAction SilentlyContinue |
  Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } | Select-Object -First 1).IPv4Address.IPAddress
if ($lanIp) { $env:REACT_NATIVE_PACKAGER_HOSTNAME = $lanIp }
$apiCommand = if ($useAtlas) { "npm run dev" } else { "`$env:MONGO_URI='$localUri'; npm run dev" }
Start-DevWindow "EDMS API :4044" (Join-Path $apps "api") $apiCommand
if (-not (Wait-Url "http://localhost:4044/health" 60 "EDMS API :4044")) { exit 1 }
Start-DevWindow "EDMS Web Khach hang :5173" (Join-Path $apps "web") "npm run dev -- --host --port 5173 --strictPort"
Start-DevWindow "EDMS App Nhan vien :8082" (Join-Path $apps "staff") "npm start"
if (-not (Wait-Url "http://localhost:5173" 90 "EDMS Web Khach hang :5173")) { exit 1 }
if (-not (Wait-Url "http://localhost:8082" 120 "EDMS App Nhan vien :8082")) { exit 1 }
Start-Process "http://localhost:5173"

# ---------------------------------------------------------------- 6. May ao
if (-not $NoEmulator) {
  Write-Step "6/6 May ao Android: bat (khoi dong nguoi ~40 giay) va mo App Nhan vien"
  Assert-Tools
  $serial = Start-EmulatorIfNeeded
  Initialize-Emulator $serial
  Open-ExpoApp $serial "staff"
  Write-Ok "Da mo App Nhan vien tren may ao ($serial). Lan dau Expo Go tai bundle mat ~30 giay."
}

Write-Host ""
Write-Host "SAN SANG" -ForegroundColor Green
Write-Host "  Web Khach hang  : http://localhost:5173   (trinh duyet da mo)"
Write-Host "  App Nhan vien   : may ao Android (Expo Go); ban web: http://localhost:8082"
Write-Host "  API / Swagger   : http://localhost:4044/api-docs"
Write-Host "  CSDL            : $(if ($useAtlas) { 'MongoDB Atlas' } else { 'local Docker, cong 27018' })"
Write-Host ""
Write-Host "Tai khoan (mat khau 123456): admin@edms.vn | kho1@edms.vn | taixe1@edms.vn  -> App Nhan vien"
Write-Host "                             khach1@edms.vn | shop1@edms.vn                  -> Web Khach hang"
Write-Host "Nhap sai mat khau 5 lan se bi khoa 15 phut. Mo khoa ngay: cd code\apps\api; npm run unlock -- --local" -ForegroundColor Yellow
Write-Host "Tat het: dong 3 cua so 'EDMS ...'; tat may ao: D:\DevTools\android-sdk\platform-tools\adb.exe emu kill"
