# Verifies the built Windows installers on a Windows runner.
# 1. The generated NSIS script contains the directory page and does not skip it outright.
# 2. The MSI exposes InstallDir and the pinned upgrade code.
# 3. Silent NSIS /D=<custom path> replaces a v0.3.2 install and leaves one shortcut set
#    pointing at that path. A following silent install with no /D= stays in that folder.
# 4. Silent MSI INSTALLDIR=<custom path> installs there.
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function Fail([string]$message) {
  $log = Join-Path $env:TEMP 'xinyao-nsis-hook.log'
  if (Test-Path $log) {
    Write-Host '--- nsis hook log ---'
    Get-Content -LiteralPath $log
  }
  $msiLog = Join-Path $env:TEMP 'xinyao-msi.log'
  if (Test-Path $msiLog) {
    Write-Host '--- msi log tail ---'
    Get-Content -LiteralPath $msiLog -Tail 40
  }
  throw $message
}

function Invoke-Raw([string]$file, [string]$arguments, [int[]]$ok) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $file
  $psi.Arguments = $arguments
  $psi.UseShellExecute = $true
  $process = [Diagnostics.Process]::Start($psi)
  if (-not $process.WaitForExit(600000)) {
    try { $process.Kill() } catch { }
    Fail "timed out: $file $arguments"
  }
  if ($ok -notcontains $process.ExitCode) {
    Fail "$file exited $($process.ExitCode): $arguments"
  }
}

function Normalize([string]$path) {
  return [IO.Path]::GetFullPath($path).TrimEnd('\').ToLowerInvariant()
}

function Get-AppLinks {
  $roots = @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('CommonDesktopDirectory'),
    (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
    (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs')
  )
  $names = @('XinyaoCADViewer.lnk', '鑫垚CAD看图.lnk')
  $shell = New-Object -ComObject WScript.Shell
  $found = @()
  foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    $links = Get-ChildItem -LiteralPath $root -Recurse -Filter *.lnk -ErrorAction SilentlyContinue |
      Where-Object { $names -contains $_.Name }
    foreach ($link in $links) {
      $target = ''
      try { $target = $shell.CreateShortcut($link.FullName).TargetPath } catch { }
      $found += [pscustomobject]@{
        Path = $link.FullName
        Name = $link.Name
        Target = $target
        Common = $link.FullName.StartsWith([Environment]::GetFolderPath('CommonDesktopDirectory')) -or
          $link.FullName.StartsWith((Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu'))
      }
    }
  }
  return $found
}

function Assert-ShortcutSet([string]$exe) {
  $links = @(Get-AppLinks)
  Write-Host 'shortcuts:'
  foreach ($link in $links) {
    Write-Host ("  {0} -> {1}" -f $link.Path, $link.Target)
  }
  if ($links.Count -lt 1) { Fail 'expected at least one XinyaoCADViewer shortcut' }
  $want = Normalize $exe
  foreach ($link in $links) {
    if ($link.Name -ne 'XinyaoCADViewer.lnk') {
      Fail "stale shortcut name remains: $($link.Path)"
    }
    if ($link.Common) {
      Fail "per-machine shortcut remains after NSIS install: $($link.Path)"
    }
    if (-not $link.Target -or (Normalize $link.Target) -ne $want) {
      Fail "shortcut $($link.Path) target '$($link.Target)' is not $exe"
    }
  }
  $desktop = @($links | Where-Object { $_.Path -like '*\Desktop\*' })
  $menu = @($links | Where-Object { $_.Path -like '*\Start Menu\*' })
  if ($desktop.Count -ne 1) { Fail "expected one desktop shortcut, found $($desktop.Count)" }
  if ($menu.Count -ne 1) { Fail "expected one Start Menu shortcut, found $($menu.Count)" }
}

function Read-MsiColumn([string]$path, [string]$sql) {
  $installer = New-Object -ComObject WindowsInstaller.Installer
  $database = $installer.GetType().InvokeMember('OpenDatabase', 'InvokeMethod', $null, $installer, @($path, 0))
  $view = $database.GetType().InvokeMember('OpenView', 'InvokeMethod', $null, $database, @($sql))
  $null = $view.GetType().InvokeMember('Execute', 'InvokeMethod', $null, $view, $null)
  $values = New-Object System.Collections.Generic.List[string]
  while ($true) {
    $record = $view.GetType().InvokeMember('Fetch', 'InvokeMethod', $null, $view, $null)
    if ($null -eq $record) { break }
    $text = $record.GetType().InvokeMember('StringData', 'GetProperty', $null, $record, 1)
    [void]$values.Add([string]$text)
  }
  $null = $view.GetType().InvokeMember('Close', 'InvokeMethod', $null, $view, $null)
  # The comma keeps a one-row result from being unrolled by PowerShell.
  return ,$values.ToArray()
}

Write-Host 'checking generated NSIS script'
$nsi = Get-ChildItem -Path (Join-Path $repo 'src-tauri\target\release\nsis') -Recurse -Filter installer.nsi |
  Select-Object -First 1
if (-not $nsi) { Fail 'installer.nsi was not generated' }
$script = Get-Content -LiteralPath $nsi.FullName -Raw
if ($script -notmatch '!insertmacro MUI_PAGE_DIRECTORY') {
  Fail 'NSIS script has no MUI_PAGE_DIRECTORY page'
}
$at = $script.IndexOf('!insertmacro MUI_PAGE_DIRECTORY')
$before = $script.Substring([Math]::Max(0, $at - 180), [Math]::Min(180, $at))
# Tauri names the pre-function SkipIfPassive with no space and a capital P.
# That function aborts only when the installer is passive, so the directory page is shown otherwise.
$passiveSkip = 'SkipIf' + 'Passive'
if (-not $before.Contains($passiveSkip)) {
  $codes = ($before.ToCharArray() | Select-Object -Last 30 | ForEach-Object { [int]$_ }) -join ','
  Fail "directory page is not the passive-only skip (codes $codes): $before"
}
if ($script -notmatch 'installer-hooks\.nsh') {
  Fail 'NSIS script does not include installer-hooks.nsh'
}
Write-Host "directory page present in $($nsi.FullName)"

Write-Host 'checking MSI directory UI and upgrade code'
$msi = Get-ChildItem -Path (Join-Path $repo 'src-tauri\target\release\bundle\msi') -Filter *.msi |
  Select-Object -First 1
if (-not $msi) { Fail 'MSI was not built' }
$upgrade = @(Read-MsiColumn $msi.FullName "SELECT ``Value`` FROM ``Property`` WHERE ``Property``='UpgradeCode'")
$upgradeText = ($upgrade | ForEach-Object { "$_" }) -join ','
if ($upgradeText.Trim('{}').ToLowerInvariant() -notmatch 'fd8004ce-56c7-5ee2-94da-ab2f916d3abd') {
  Fail "unexpected UpgradeCode: $upgradeText"
}
$mode = @(Read-MsiColumn $msi.FullName "SELECT ``Value`` FROM ``Property`` WHERE ``Property``='WixUI_Mode'")
if (($mode -join ',') -ne 'InstallDir') {
  Fail "MSI UI mode is not InstallDir: $($mode -join ',')"
}
$dirDialog = @(Read-MsiColumn $msi.FullName "SELECT ``Dialog`` FROM ``Dialog`` WHERE ``Dialog``='InstallDirDlg'")
if ($dirDialog.Count -lt 1 -or [string]$dirDialog[0] -ne 'InstallDirDlg') { Fail 'MSI has no InstallDirDlg' }
$nextArgs = @(Read-MsiColumn $msi.FullName "SELECT ``Argument`` FROM ``ControlEvent`` WHERE ``Dialog_``='LicenseAgreementDlg' AND ``Control_``='Next' AND ``Event``='NewDialog'")
if ($nextArgs -notcontains 'InstallDirDlg') {
  Fail "license page does not open InstallDirDlg: $($nextArgs -join ', ')"
}
Write-Host "MSI directory page present in $($msi.Name)"

$oldDir = Join-Path $env:LOCALAPPDATA 'XinyaoCADViewer-old'
$newDir = Join-Path $env:LOCALAPPDATA 'XinyaoCADViewer-new'
$oldExe = Join-Path $oldDir 'xinyao-cad-viewer.exe'
$newExe = Join-Path $newDir 'xinyao-cad-viewer.exe'
foreach ($dir in @($oldDir, $newDir)) {
  if (Test-Path $dir) { Remove-Item -LiteralPath $dir -Recurse -Force }
}
$hookLog = Join-Path $env:TEMP 'xinyao-nsis-hook.log'
if (Test-Path $hookLog) { Remove-Item $hookLog -Force }

$downloaded = Join-Path $env:TEMP 'XinyaoCADViewer_0.3.2_x64-setup.exe'
Write-Host 'downloading v0.3.2 setup.exe'
Invoke-WebRequest -Uri 'https://github.com/baizhengyong6-ui/xy-CAD-Viewer/releases/download/v0.3.2/XinyaoCADViewer_0.3.2_x64-setup.exe' -OutFile $downloaded
Invoke-Raw $downloaded "/S /D=$oldDir" @(0)
if (-not (Test-Path -LiteralPath $oldExe)) { Fail "v0.3.2 did not install to $oldDir" }

$shell = New-Object -ComObject WScript.Shell
$planted = @(
  (Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'XinyaoCADViewer.lnk'),
  (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\XinyaoCADViewer\XinyaoCADViewer.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Desktop')) '鑫垚CAD看图.lnk')
)
foreach ($path in $planted) {
  $parent = Split-Path -Parent $path
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  $link = $shell.CreateShortcut($path)
  $link.TargetPath = $oldExe
  $link.Save()
}

$setup = Get-ChildItem -Path (Join-Path $repo 'src-tauri\target\release\bundle\nsis') -Filter *-setup.exe |
  Select-Object -First 1
if (-not $setup) { Fail 'new setup.exe was not built' }
Write-Host "silent install $($setup.Name) /D=$newDir"
Invoke-Raw $setup.FullName "/S /D=$newDir" @(0)
if (-not (Test-Path -LiteralPath $newExe)) { Fail "/D= did not install to $newDir" }
if (Test-Path -LiteralPath $oldExe) { Fail "old install was not removed: $oldExe" }
Assert-ShortcutSet $newExe

Write-Host 'silent reinstall without /D= should stay in the previous directory'
Invoke-Raw $setup.FullName '/S' @(0)
if (-not (Test-Path -LiteralPath $newExe)) { Fail 'upgrade without /D= left the previous directory' }
$defaultExe = Join-Path $env:LOCALAPPDATA 'XinyaoCADViewer\xinyao-cad-viewer.exe'
if (Test-Path -LiteralPath $defaultExe) { Fail "upgrade without /D= used the default folder $defaultExe" }
Assert-ShortcutSet $newExe

Write-Host 'uninstall NSIS before the MSI check'
$uninstaller = Join-Path $newDir 'uninstall.exe'
if (Test-Path $uninstaller) { Invoke-Raw $uninstaller '/S' @(0) }
if (Test-Path 'HKCU:\Software\Xinyao\XinyaoCADViewer') {
  Remove-Item 'HKCU:\Software\Xinyao\XinyaoCADViewer' -Recurse -Force
}

$msiDir = 'C:\XinyaoMsiCustom'
if (Test-Path $msiDir) { Remove-Item -LiteralPath $msiDir -Recurse -Force }
$msiLog = Join-Path $env:TEMP 'xinyao-msi.log'
if (Test-Path $msiLog) { Remove-Item $msiLog -Force }
Write-Host "silent MSI install to $msiDir"
Invoke-Raw "$env:SystemRoot\System32\msiexec.exe" "/i `"$($msi.FullName)`" /qn /norestart /l*v `"$msiLog`" INSTALLDIR=$msiDir" @(0, 3010)
$msiExe = Join-Path $msiDir 'xinyao-cad-viewer.exe'
if (-not (Test-Path -LiteralPath $msiExe)) { Fail "MSI did not install to $msiDir" }
$msiLinks = @(Get-AppLinks)
$msiDesktop = @($msiLinks | Where-Object { $_.Path -like '*\Desktop\*' -and (Normalize $_.Target) -eq (Normalize $msiExe) })
if ($msiDesktop.Count -lt 1) { Fail "MSI did not create a desktop shortcut to $msiExe" }
Write-Host "MSI installed to $msiDir with $($msiLinks.Count) shortcut(s)"

Invoke-Raw "$env:SystemRoot\System32\msiexec.exe" "/x `"$($msi.FullName)`" /qn /norestart" @(0, 3010, 1605)
Write-Host 'Windows installer smoke passed'
