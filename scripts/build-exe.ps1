$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) {
  $csc = (Get-ChildItem "C:\Windows\Microsoft.NET" -Recurse -Filter "csc.exe" | Select-Object -First 1).FullName
}
if (-not $csc) {
  throw "C# compiler (csc.exe) not found on this machine."
}

$outExe = Join-Path $root "Vol2Vol-Launcher.exe"
$srcCs = Join-Path $PSScriptRoot "Launcher.cs"

& $csc /target:winexe /out:$outExe /optimize+ /r:System.Windows.Forms.dll /r:System.Drawing.dll $srcCs
if ($LASTEXITCODE -ne 0) {
  throw "Failed to compile Vol2Vol-Launcher.exe"
}
Write-Host "Built successfully: $outExe"
