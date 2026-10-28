# Ham dung chung cho test-mobile.ps1 va test-song-song.ps1 (dot-source file nay).
# Chi dung ky tu ASCII: PowerShell 5.1 doc .ps1 khong BOM theo bang ma ANSI.
#
# Duong dan cong cu doc tu bien moi truong, mac dinh theo cach cai tren may dev:
#   ANDROID_HOME     D:\DevTools\android-sdk
#   ANDROID_AVD_HOME D:\DevTools\android-avd
#   JAVA_HOME        C:\Program Files\Java\jdk-17
#   MAESTRO_BIN      D:\DevTools\maestro\bin\maestro.bat
#   EDMS_AVD         edms_pixel

function Get-EnvOrDefault($name, $default) {
  $value = [Environment]::GetEnvironmentVariable($name, "Process")
  if (-not $value) { $value = [Environment]::GetEnvironmentVariable($name, "User") }
  if (-not $value) { $value = $default }
  return $value
}

$script:AndroidHome = Get-EnvOrDefault "ANDROID_HOME" "D:\DevTools\android-sdk"
$script:AvdHome = Get-EnvOrDefault "ANDROID_AVD_HOME" "D:\DevTools\android-avd"
$script:JavaHome = Get-EnvOrDefault "JAVA_HOME" "C:\Program Files\Java\jdk-17"
$script:MaestroBin = Get-EnvOrDefault "MAESTRO_BIN" "D:\DevTools\maestro\bin\maestro.bat"
$script:AvdName = Get-EnvOrDefault "EDMS_AVD" "edms_pixel"
$script:Adb = Join-Path $script:AndroidHome "platform-tools\adb.exe"
$script:Emulator = Join-Path $script:AndroidHome "emulator\emulator.exe"

# Cho cac tien trinh con (maestro, playwright) thay dung cong cu
$env:ANDROID_HOME = $script:AndroidHome
$env:ANDROID_AVD_HOME = $script:AvdHome
$env:JAVA_HOME = $script:JavaHome
$env:MAESTRO_BIN = $script:MaestroBin
$env:MAESTRO_CLI_NO_ANALYTICS = "1"
$env:JAVA_TOOL_OPTIONS = "-Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8"
$env:Path = "$(Join-Path $script:AndroidHome 'platform-tools');$(Split-Path $script:MaestroBin);$env:Path"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Write-Step($text) { Write-Host "==> $text" -ForegroundColor Cyan }
function Write-Fail($text) { Write-Host "LOI: $text" -ForegroundColor Red }

function Assert-Tools {
  $missing = @()
  foreach ($path in $script:Adb, $script:Emulator, $script:MaestroBin, (Join-Path $script:JavaHome "bin\java.exe")) {
    if (-not (Test-Path $path)) { $missing += $path }
  }
  if ($missing.Count -gt 0) {
    Write-Fail "Thieu cong cu: $($missing -join ', ')"
    Write-Host "Xem huong dan cai trong CLAUDE.md, muc 'Kiem thu tren may ao Android'."
    exit 1
  }
}

function Test-Url($url) {
  try {
    $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
    return $res.StatusCode -eq 200
  } catch { return $false }
}

# API (4044) va Metro cua App Nhan vien (8082) phai dang chay
function Assert-Servers([switch]$NeedWeb) {
  $checks = @(@("API", "http://localhost:4044/health"), @("Metro App Nhan vien", "http://localhost:8082"))
  if ($NeedWeb) { $checks += , @("Web Khach hang", "http://localhost:5173") }
  $down = @($checks | Where-Object { -not (Test-Url $_[1]) } | ForEach-Object { "$($_[0]) ($($_[1]))" })
  if ($down.Count -gt 0) {
    Write-Fail "Chua chay: $($down -join ', ')"
    Write-Host "Bat moi truong truoc: powershell -ExecutionPolicy Bypass -File code\start-dev.ps1"
    exit 1
  }
}

function Get-BootedDevice {
  $lines = & $script:Adb devices 2>$null | Select-Object -Skip 1 | Where-Object { $_ -match "^(emulator-\d+)\s+device$" }
  if (-not $lines) { return $null }
  $serial = ($lines | Select-Object -First 1) -replace "\s+device$", ""
  $booted = (& $script:Adb -s $serial shell getprop sys.boot_completed 2>$null) -join ""
  if ($booted.Trim() -eq "1") { return $serial }
  return $null
}

# Bat may ao neu chua chay, cho boot xong (toi da 4 phut)
function Start-EmulatorIfNeeded {
  $serial = Get-BootedDevice
  if ($serial) { Write-Step "May ao da chay: $serial"; return $serial }
  Write-Step "Bat may ao $script:AvdName (cua so may ao se hien len)..."
  Start-Process -FilePath $script:Emulator -ArgumentList @("-avd", $script:AvdName, "-no-boot-anim", "-netdelay", "none", "-netspeed", "full")
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Seconds 2
    $serial = Get-BootedDevice
    if ($serial) { Write-Step "May ao boot xong sau ~$($i * 2)s: $serial"; return $serial }
  }
  Write-Fail "May ao khong boot xong sau 4 phut"
  exit 1
}

# Cau hinh may ao cho test: noi cong ve may dev, tat bang "viet tay bang but"
# (Gboard hien hop thoai "Try out your stylus" che form khi Maestro bam o nhap).
function Initialize-Emulator($serial) {
  & $script:Adb -s $serial reverse tcp:8082 tcp:8082 | Out-Null
  & $script:Adb -s $serial reverse tcp:4044 tcp:4044 | Out-Null
  & $script:Adb -s $serial shell settings put secure stylus_handwriting_enabled 0 | Out-Null
  & $script:Adb -s $serial shell input keyevent KEYCODE_WAKEUP | Out-Null
  $expoGo = & $script:Adb -s $serial shell pm list packages host.exp.exponent
  if (-not ($expoGo -match "host.exp.exponent")) {
    Write-Fail "May ao chua cai Expo Go. Cai APK Expo Go dung SDK 58:"
    Write-Host "  adb install -r D:\DevTools\downloads\Expo-Go-58.0.5.apk"
    exit 1
  }
  Write-Step "Da noi cong 8082 (Metro), 4044 (API) tu may ao ve may dev"
}

# Don du lieu test con sot neu flow dung giua chung (khu vuc co tinh "Tinh ...E2E/Thiet Bi")
function Remove-MobileTestData {
  try {
    $login = Invoke-RestMethod -Method Post -Uri "http://localhost:4044/auth/login" -ContentType "application/json" `
      -Body '{"emailOrPhone":"admin@edms.vn","password":"123456"}'
    $headers = @{ Authorization = "Bearer $($login.data.accessToken)" }
    $removed = 0
    foreach ($keyword in "Tinh Maestro E2E", "Tinh Lien Thiet Bi") {
      $list = Invoke-RestMethod -Uri "http://localhost:4044/serviceAreas?limit=100&search=$([uri]::EscapeDataString($keyword))" -Headers $headers
      foreach ($area in $list.data) {
        Invoke-RestMethod -Method Delete -Uri "http://localhost:4044/serviceAreas/$($area._id)" -Headers $headers | Out-Null
        $removed++
      }
    }
    if ($removed -gt 0) { Write-Step "Da don $removed khu vuc test con sot" }
  } catch {
    Write-Host "(Bo qua don du lieu: $($_.Exception.Message))" -ForegroundColor Yellow
  }
}
