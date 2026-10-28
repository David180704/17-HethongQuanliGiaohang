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

# API (4044) va Metro cua app can test phai dang chay:
#   App Nhan vien 8082 (-NeedStaff), App Khach hang mobile 8083 (-NeedCustomer), Web 5173 (-NeedWeb)
function Assert-Servers([switch]$NeedWeb, [switch]$NeedStaff, [switch]$NeedCustomer) {
  $checks = @(, @("API", "http://localhost:4044/health"))
  if ($NeedStaff) { $checks += , @("Metro App Nhan vien", "http://localhost:8082") }
  if ($NeedCustomer) { $checks += , @("Metro App Khach hang", "http://localhost:8083") }
  if ($NeedWeb) { $checks += , @("Web Khach hang", "http://localhost:5173") }
  $down = @($checks | Where-Object { -not (Test-Url $_[1]) } | ForEach-Object { "$($_[0]) ($($_[1]))" })
  if ($down.Count -gt 0) {
    Write-Fail "Chua chay: $($down -join ', ')"
    Write-Host "Bat moi truong truoc: powershell -ExecutionPolicy Bypass -File code\start-dev.ps1 -Local"
    exit 1
  }
}

# Test tao/sua/xoa du lieu thu (khu vuc, khoa tai khoan, dang ky). Chi chay khi API dang noi
# CSDL local; API noi Atlas (du lieu that) thi dung lai. Bo chot: dat bien E2E_ALLOW_CLOUD=1.
function Assert-LocalDatabase {
  if ($env:E2E_ALLOW_CLOUD -eq "1") { return }
  try {
    $health = Invoke-RestMethod -Uri "http://localhost:4044/health" -TimeoutSec 5
  } catch {
    Write-Fail "Khong goi duoc http://localhost:4044/health"
    exit 1
  }
  if ($health.data.database.cloud) {
    Write-Fail "API dang dung CSDL cloud ($($health.data.database.host)). Test se ghi du lieu thu len Atlas."
    Write-Host "Chay API voi CSDL local: tat cua so API roi chay  code\start-dev.ps1 -Local"
    exit 1
  }
}

function Get-BootedDevice {
  # Lan goi adb dau tien sau khi bat may tinh in "daemon not running; starting now" ra stderr.
  # PowerShell 5.1 + ErrorActionPreference=Stop (cua script goi) + 2>$null -> dong stderr do
  # thanh loi dung script. Ha xuong Continue trong pham vi ham nay.
  $ErrorActionPreference = "Continue"
  $lines = & $script:Adb devices 2>$null | Select-Object -Skip 1 | Where-Object { $_ -match "^(emulator-\d+)\s+device$" }
  if (-not $lines) { return $null }
  $serial = ($lines | Select-Object -First 1) -replace "\s+device$", ""
  $booted = (& $script:Adb -s $serial shell getprop sys.boot_completed 2>$null) -join ""
  if ($booted.Trim() -eq "1") { return $serial }
  return $null
}

# Tien trinh may ao cua du an (dong lenh co "-avd <ten>"), khong dung toi may ao khac.
function Get-ProjectEmulatorProcess {
  Get-CimInstance Win32_Process -Filter "Name='qemu-system-x86_64.exe' OR Name='emulator.exe'" |
    Where-Object { $_.CommandLine -match "-avd\s+$([regex]::Escape($script:AvdName))(\s|$)" }
}

# Doi may ao boot xong (adb thay thiet bi + sys.boot_completed=1). Tra ve serial hoac $null.
function Wait-EmulatorBooted($seconds) {
  for ($waited = 0; $waited -lt $seconds; $waited += 2) {
    Start-Sleep -Seconds 2
    $serial = Get-BootedDevice
    if ($serial) { Write-Step "May ao boot xong sau ~${waited}s: $serial"; return $serial }
  }
  return $null
}

# Bat may ao neu chua chay. LUON khoi dong nguoi (-no-snapshot), cham hon ~20 giay nhung:
#   - khoi dong nhanh tu snapshot lam may ao giu ~10 GB bo nho ao (khoi dong nguoi ~2 GB);
#     tren may dev o C: gan day, het bo nho ao -> Windows buoc dung Vite/Playwright giua chung
#   - snapshot hay hong khi may ao bi tat ngang -> lan sau treo man hinh den, adb "offline"
function Start-EmulatorIfNeeded {
  $serial = Get-BootedDevice
  if ($serial) { Write-Step "May ao da chay: $serial"; return $serial }
  if (Get-ProjectEmulatorProcess) {
    Write-Step "May ao $script:AvdName da bat nhung chua san sang, cho toi da 60 giay..."
    $serial = Wait-EmulatorBooted 60
    if ($serial) { return $serial }
    Write-Step "Van chua san sang (may ao treo) -> tat de bat lai tu dau"
    Get-ProjectEmulatorProcess | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 3
  }
  Write-Step "Bat may ao $script:AvdName, khoi dong nguoi khoang 40 giay (cua so may ao se hien len)..."
  Start-Process -FilePath $script:Emulator -ArgumentList @("-avd", $script:AvdName, "-no-snapshot", "-no-boot-anim", "-netdelay", "none", "-netspeed", "full")
  $serial = Wait-EmulatorBooted 240
  if ($serial) { return $serial }
  Write-Fail "May ao khong boot xong sau 4 phut. Thuong do may thieu bo nho ao: xem docs/HuongDanChayThu.md, muc Loi thuong gap"
  exit 1
}

# Cau hinh may ao cho test: noi cong ve may dev, tat bang "viet tay bang but"
# (Gboard hien hop thoai "Try out your stylus" che form khi Maestro bam o nhap).
function Initialize-Emulator($serial) {
  # 8082: App Nhan vien, 8083: App Khach hang mobile, 4044: API, 5173: Web Khach hang (Chrome tren may ao)
  foreach ($port in 8082, 8083, 4044, 5173) {
    & $script:Adb -s $serial reverse "tcp:$port" "tcp:$port" | Out-Null
  }
  & $script:Adb -s $serial shell settings put secure stylus_handwriting_enabled 0 | Out-Null
  & $script:Adb -s $serial shell input keyevent KEYCODE_WAKEUP | Out-Null
  $expoGo = & $script:Adb -s $serial shell pm list packages host.exp.exponent
  if (-not ($expoGo -match "host.exp.exponent")) {
    Write-Fail "May ao chua cai Expo Go. Cai APK Expo Go dung SDK 58:"
    Write-Host "  adb install -r D:\DevTools\downloads\Expo-Go-58.0.5.apk"
    exit 1
  }
  Write-Step "Da noi cong 8082, 8083 (Metro 2 app), 4044 (API), 5173 (web) tu may ao ve may dev"
}

# Mo mot app trong Expo Go tren may ao: staff (8082) hoac customer (8083)
function Open-ExpoApp($serial, $app) {
  $port = if ($app -eq "customer") { 8083 } else { 8082 }
  & $script:Adb -s $serial shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:$port" host.exp.exponent | Out-Null
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
  # Tai khoan do flow dang ky tao ra (email maestro<so>@edms.vn). API khong co chuc nang xoa
  # tai khoan (US-10) nen xoa thang trong CSDL local qua mongosh cua container Docker.
  # Chi goi ham nay sau Assert-LocalDatabase (API dang dung CSDL local).
  $ErrorActionPreference = "Continue"
  $deleted = docker exec edms-mongo mongosh edms --quiet --eval 'db.users.deleteMany({ email: /^maestro\d+@edms\.vn$/ }).deletedCount' 2>$null
  if ("$deleted".Trim() -match '^[1-9]\d*$') { Write-Step "Da xoa $("$deleted".Trim()) tai khoan test do flow dang ky tao" }
}
