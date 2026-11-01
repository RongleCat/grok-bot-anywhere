# Read-only. This script does not create, change, or delete registry keys.
# It only opens registry keys for reading and writes a text report in the current directory.
$ErrorActionPreference = 'Continue'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outPath = Join-Path -Path (Get-Location) -ChildPath ('diagnose-' + $stamp + '.txt')
$lines = New-Object System.Collections.Generic.List[string]

function Add-Line([string]$text) {
  $lines.Add($text) | Out-Null
  Write-Output $text
}

function Add-KeyTree($key, [string]$path) {
  if ($null -eq $key) {
    Add-Line ('MISSING ' + $path)
    return
  }
  Add-Line ('KEY ' + $path)
  foreach ($name in @($key.GetValueNames())) {
    $shown = $name
    if ([string]::IsNullOrEmpty($shown)) { $shown = '(default)' }
    $data = $key.GetValue($name)
    Add-Line ('  ' + $shown + ' = ' + $data)
  }
  $sub = @($key.GetSubKeyNames())
  foreach ($child in $sub) {
    $childKey = $key.OpenSubKey($child, $false)
    Add-KeyTree $childKey ($path + '\' + $child)
    if ($null -ne $childKey) { $childKey.Close() }
  }
  $leaf = $path.Split('\')[-1]
  if ($leaf -eq 'shell' -or $leaf -eq 'command') { return }
  $hasCommand = $sub -contains 'command'
  $hasSub = $null -ne $key.GetValue('SubCommands')
  $hasExt = $null -ne $key.GetValue('ExtendedSubCommandsKey')
  if (-not $hasCommand -and -not $hasSub -and -not $hasExt) {
    Add-Line ('ANOMALY missing command and SubCommands and ExtendedSubCommandsKey: ' + $path)
  }
}

function Open-HivePath($hive, [string]$path) {
  return $hive.OpenSubKey($path, $false)
}

Add-Line 'READ ONLY'
Add-Line ('When ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))

$ours = @(
  @{ Hive = [Microsoft.Win32.Registry]::CurrentUser; Name = 'HKCU'; Path = 'Software\Classes\*\shell\GrokBotAnywhere' },
  @{ Hive = [Microsoft.Win32.Registry]::CurrentUser; Name = 'HKCU'; Path = 'Software\Classes\GrokBotAnywhere.Menu' },
  @{ Hive = [Microsoft.Win32.Registry]::CurrentUser; Name = 'HKCU'; Path = 'Software\Classes\GrokBotAnywhere.Staging' },
  @{ Hive = [Microsoft.Win32.Registry]::CurrentUser; Name = 'HKCU'; Path = 'Software\Classes\SystemFileAssociations\*\shell\GrokBotAnywhere' },
  @{ Hive = [Microsoft.Win32.Registry]::CurrentUser; Name = 'HKCU'; Path = 'Software\Classes\AllFilesystemObjects\shell\GrokBotAnywhere' },
  @{ Hive = [Microsoft.Win32.Registry]::CurrentUser; Name = 'HKCU'; Path = 'Software\Classes\Folder\shell\GrokBotAnywhere' },
  @{ Hive = [Microsoft.Win32.Registry]::CurrentUser; Name = 'HKCU'; Path = 'Software\Classes\Directory\shell\GrokBotAnywhere' },
  @{ Hive = [Microsoft.Win32.Registry]::CurrentUser; Name = 'HKCU'; Path = 'Software\Classes\Directory\Background\shell\GrokBotAnywhere' }
)

Add-Line '--- keys this app may have written'
foreach ($item in $ours) {
  $key = Open-HivePath $item.Hive $item.Path
  Add-KeyTree $key ($item.Name + '\' + $item.Path)
  if ($null -ne $key) { $key.Close() }
}

$lists = @(
  @{ Hive = [Microsoft.Win32.Registry]::CurrentUser; Name = 'HKCU'; Path = 'Software\Classes\*\shell' },
  @{ Hive = [Microsoft.Win32.Registry]::LocalMachine; Name = 'HKLM'; Path = 'SOFTWARE\Classes\*\shell' }
)

foreach ($item in $lists) {
  Add-Line ('--- all ' + $item.Name + '\' + $item.Path)
  $key = Open-HivePath $item.Hive $item.Path
  if ($null -eq $key) {
    Add-Line 'MISSING'
    continue
  }
  foreach ($child in @($key.GetSubKeyNames())) {
    $childKey = $key.OpenSubKey($child, $false)
    Add-KeyTree $childKey ($item.Name + '\' + $item.Path + '\' + $child)
    if ($null -ne $childKey) { $childKey.Close() }
  }
  $key.Close()
}

$utf8 = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllLines($outPath, $lines.ToArray(), $utf8)
Add-Line ('WROTE ' + $outPath)
