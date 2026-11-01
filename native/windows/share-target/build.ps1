# Builds the Windows share target with the Visual Studio C++ tools and the
# C++/WinRT headers from the Windows SDK.
param([string]$Configuration = 'Release')

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path $vswhere)) { throw 'vswhere.exe was not found. Install Visual Studio Build Tools with the C++ workload.' }
$vsPath = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vsPath) { throw 'No Visual Studio installation with the MSVC C++ toolset was found.' }
$vcvars = Join-Path $vsPath 'VC\Auxiliary\Build\vcvars64.bat'
if (-not (Test-Path $vcvars)) { throw "vcvars64.bat was not found under $vsPath." }

$sdkRoot = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\Include" -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName 'cppwinrt\winrt\base.h') } |
    Sort-Object Name -Descending | Select-Object -First 1
if (-not $sdkRoot) { throw 'The C++/WinRT headers were not found. Install the Windows SDK.' }

$out = Join-Path $here 'out'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$manifest = Join-Path $here 'ShareTarget.manifest'

$command = "`"$vcvars`" >nul 2>&1 && cd /d `"$here`" && " +
    "cl /nologo /std:c++17 /EHsc /O2 /MT /DUNICODE /D_UNICODE " +
    "/I`"$(Join-Path $sdkRoot.FullName 'cppwinrt')`" " +
    "/Fe:`"$out\GrokBotShareTarget.exe`" ShareTarget.cpp " +
    "/link /SUBSYSTEM:WINDOWS shell32.lib ole32.lib windowsapp.lib /MANIFEST:EMBED /MANIFESTINPUT:`"$manifest`""

cmd /c $command
if ($LASTEXITCODE -ne 0) { throw "cl.exe failed with exit code $LASTEXITCODE." }
Get-Item (Join-Path $out 'GrokBotShareTarget.exe') | Select-Object Name, Length
