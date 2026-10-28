# Chuyen thu muc cong cu phat trien tu o C sang o D, giu nguyen duong dan cu bang junction
# (cong cu van tim thay o duong dan cu, khong can sua cau hinh). Khong can quyen admin.
#
#   powershell -ExecutionPolicy Bypass -File code\scripts\move-to-d.ps1 -Source "<thu muc tren C>" -Target "<thu muc tren D>"
#
# An toan: sao chep -> so khop so file/dung luong -> doi ten ban goc thanh .old -> tao junction.
# Buoc nao loi (vd file dang bi khoa) thi dung lai, giu nguyen hien trang. Ban .old chi xoa khi
# goi them -RemoveOld sau khi da chay thu cong cu.
# Chi dung ky tu ASCII (PowerShell 5.1 doc .ps1 khong BOM theo bang ma ANSI).
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Target,
  [switch]$RemoveOld
)
$ErrorActionPreference = "Stop"

function Get-Stats($path) {
  $files = Get-ChildItem -LiteralPath $path -Recurse -File -Force -ErrorAction Stop
  [pscustomobject]@{ Count = @($files).Count; Bytes = ($files | Measure-Object Length -Sum).Sum }
}

$item = Get-Item -LiteralPath $Source -Force -ErrorAction SilentlyContinue
if ($RemoveOld) {
  $old = "$Source.old"
  if (-not (Test-Path -LiteralPath $old)) { Write-Host "Khong co $old"; exit 0 }
  Remove-Item -LiteralPath $old -Recurse -Force
  Write-Host "Da xoa ban cu $old"
  exit 0
}
if ($item -and $item.LinkType -eq "Junction") { Write-Host "Da la junction -> $($item.Target). Bo qua."; exit 0 }
if (-not $item) { Write-Host "Khong co $Source"; exit 1 }
if (Test-Path -LiteralPath $Target) { Write-Host "LOI: $Target da ton tai, khong ghi de."; exit 1 }

$before = Get-Stats $Source
Write-Host ("Sao chep {0} file ({1:N0} MB)..." -f $before.Count, ($before.Bytes / 1MB))
robocopy $Source $Target /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Host "LOI: robocopy ma $LASTEXITCODE"; Remove-Item -LiteralPath $Target -Recurse -Force -ErrorAction SilentlyContinue; exit 1 }

$after = Get-Stats $Target
if ($after.Count -ne $before.Count -or $after.Bytes -ne $before.Bytes) {
  Write-Host ("LOI: ban sao khac ban goc ({0}/{1} file, {2}/{3} byte). Huy." -f $after.Count, $before.Count, $after.Bytes, $before.Bytes)
  Remove-Item -LiteralPath $Target -Recurse -Force
  exit 1
}

try {
  Rename-Item -LiteralPath $Source -NewName ((Split-Path $Source -Leaf) + ".old") -ErrorAction Stop
} catch {
  Write-Host "LOI: khong doi ten duoc $Source (co file dang duoc dung?). Huy, giu nguyen hien trang."
  Remove-Item -LiteralPath $Target -Recurse -Force
  exit 1
}
cmd /c mklink /J "$Source" "$Target" | Out-Null
if (-not (Test-Path -LiteralPath $Source)) {
  Write-Host "LOI: tao junction that bai. Tra lai ban goc."
  Rename-Item -LiteralPath "$Source.old" -NewName (Split-Path $Source -Leaf)
  exit 1
}
Write-Host "Xong: $Source -> $Target (ban goc tam giu o $Source.old, xoa bang -RemoveOld sau khi chay thu)"
