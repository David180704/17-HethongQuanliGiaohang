# Mo ban chay thu cong khai: co link that tren Internet (https://<ngau-nhien>.trycloudflare.com), mien phi,
# KHONG can tai khoan, khong can ten mien. Dung Cloudflare Quick Tunnel tro ve may nay.
#   1. Chay truoc:  powershell -ExecutionPolicy Bypass -File .\code\chay-demo.ps1   (API, Docker...)
#   2. Chay:        powershell -ExecutionPolicy Bypass -File .\code\chay-cong-khai.ps1
#   3. Tat:         powershell -ExecutionPolicy Bypass -File .\code\chay-cong-khai.ps1 -Stop
# Tuy chon: -SkipBuild (dung ban build cu), -NoStaff (chi mo Web Khach hang).
# Luu y: link chi song khi may nay bat va script dang chay; moi lan chay ra link moi. Du lieu nam o CSDL ma API
# dang dung (Docker local, hoac Atlas neu API chay theo .env). Ai co link deu vao duoc -> doi mat khau tai khoan
# mau neu de lau; tat ngay khi demo xong.
param([switch]$Stop, [switch]$SkipBuild, [switch]$NoStaff)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Work = Join-Path $env:TEMP "edms-cong-khai"
$PidFile = Join-Path $Work "pids.txt"
$Cloudflared = "D:\DevTools\cloudflared\cloudflared.exe"
$CloudflaredUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
New-Item -ItemType Directory -Force $Work | Out-Null

function Stop-PublicDemo {
  if (Test-Path $PidFile) {
    foreach ($id in Get-Content $PidFile) {
      try { Stop-Process -Id ([int]$id) -Force -ErrorAction Stop; Write-Host "  da tat tien trinh $id" } catch {}
    }
    Remove-Item $PidFile -Force
  }
}

if ($Stop) {
  Write-Host "Tat ban cong khai (proxy + tunnel)..."
  Stop-PublicDemo
  exit 0
}
Stop-PublicDemo

# 1. API phai dang chay
try {
  $health = Invoke-RestMethod -Uri "http://localhost:4044/health" -TimeoutSec 5
  $db = $health.data.database
  $where = if ($db.cloud) { "cloud (Atlas)" } else { "may nay (Docker local)" }
  Write-Host "API dang chay. CSDL: $($db.host)/$($db.name) - du lieu nam o $where"
} catch {
  Write-Host "API chua chay o cong 4044. Chay chay-demo.ps1 truoc." -ForegroundColor Red
  exit 1
}

# 2. cloudflared (tai mot lan tu trang phat hanh chinh thuc cua Cloudflare tren GitHub)
if (-not (Test-Path $Cloudflared)) {
  Write-Host "Tai cloudflared ve $Cloudflared ..."
  New-Item -ItemType Directory -Force (Split-Path $Cloudflared) | Out-Null
  $ProgressPreference = "SilentlyContinue"
  Invoke-WebRequest -Uri $CloudflaredUrl -OutFile $Cloudflared -UseBasicParsing
}

# 3. Ban build tinh goi API qua duong dan tuong doi /api (proxy chuyen tiep) -> khong can sua CORS
$apps = @(@{ Name = "Web Khach hang"; Dir = "apps\web"; Port = 8090 })
if (-not $NoStaff) { $apps += @{ Name = "Web Nhan vien"; Dir = "apps\staff"; Port = 8091 } }
if (-not $SkipBuild) {
  Write-Host "Build Web Khach hang..."
  Push-Location (Join-Path $Root "apps\web")
  $env:VITE_API_URL = "/api"
  & npm.cmd run build *> (Join-Path $Work "build-web.log")
  Remove-Item Env:VITE_API_URL
  Pop-Location
  if (-not $NoStaff) {
    Write-Host "Build Web Nhan vien (Expo web)..."
    Push-Location (Join-Path $Root "apps\staff")
    $env:EXPO_PUBLIC_API_URL = "/api"
    & npx.cmd expo export --platform web --output-dir dist *> (Join-Path $Work "build-staff.log")
    Remove-Item Env:EXPO_PUBLIC_API_URL
    Pop-Location
  }
}

# 4. Proxy (web tinh + /api) va tunnel cho tung ung dung
$pids = @()
$links = @()
foreach ($app in $apps) {
  $static = Join-Path $Root "$($app.Dir)\dist"
  if (-not (Test-Path (Join-Path $static "index.html"))) {
    Write-Host "Chua co ban build $static (bo -SkipBuild de build)." -ForegroundColor Red
    continue
  }
  $proxy = Start-Process -FilePath "node" -WindowStyle Hidden -PassThru `
    -ArgumentList @("`"$Root\scripts\public-demo\proxy.mjs`"", "--port", $app.Port, "--static", "`"$static`"") `
    -RedirectStandardOutput (Join-Path $Work "proxy-$($app.Port).log") -RedirectStandardError (Join-Path $Work "proxy-$($app.Port).err")
  $pids += $proxy.Id
  $log = Join-Path $Work "tunnel-$($app.Port).log"
  if (Test-Path $log) { Remove-Item $log -Force }
  $tunnel = Start-Process -FilePath $Cloudflared -WindowStyle Hidden -PassThru `
    -ArgumentList @("tunnel", "--no-autoupdate", "--url", "http://localhost:$($app.Port)", "--logfile", "`"$log`"")
  $pids += $tunnel.Id
  $url = $null
  for ($i = 0; $i -lt 60 -and -not $url; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $log) {
      $m = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1
      if ($m) { $url = $m.Matches[0].Value }
    }
  }
  if ($url) { $links += "$($app.Name): $url" } else { $links += "$($app.Name): chua lay duoc link, xem $log" }
}
$pids | Set-Content $PidFile

Write-Host ""
Write-Host "=== LINK CONG KHAI (gui cho nguoi dung thu) ===" -ForegroundColor Green
$links | ForEach-Object { Write-Host "  $_" }
$links | Set-Content (Join-Path $Work "links.txt")
Write-Host ""
Write-Host "Tai khoan mau: xem docs/HuongDanChayThu.md. Tat: chay-cong-khai.ps1 -Stop"
Write-Host "Link moi co the can 10-30 giay moi mo duoc (Cloudflare cap DNS)."
