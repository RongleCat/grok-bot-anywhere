# Packs the whole Electron app into one MSIX (release shape).
#
# This is step 1 of the full-package migration: the package installs and runs,
# but userData migration and .appinstaller updates are not wired yet. The app
# directory must come from an electron-builder win-unpacked output, because the
# package contains the app rather than pointing at an external folder.
#
# Two distribution shapes use this script:
# - SignPath / self-signed: -PackageName/-Publisher are ours to choose.
# - Microsoft Store: pass Partner Center's identity verbatim. Name, Publisher,
#   DisplayName and PublisherDisplayName must match the reserved name and
#   account, otherwise Partner Center rejects the package at upload time.
#   Store submissions do not need -Sign: Partner Center re-signs the MSIX.
param(
    [Parameter(Mandatory = $true)]
    [string]$AppDirectory,
    [string]$Version = '1.0.0.0',
    [string]$Publisher = 'CN=GrokBotAnywhere',
    [string]$PackageName = 'dev.ronglecat.grokbotanywhere',
    [string]$DisplayName = 'Grok Bot',
    [string]$PublisherDisplayName = 'Grok Bot Anywhere',
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\artifacts\full'),
    [ValidateSet('SelfSigned', 'Unsigned')]
    [string]$Sign = 'SelfSigned',
    [string]$SigningThumbprint = ''
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktop = Split-Path -Parent $here

$app = [IO.Path]::GetFullPath($AppDirectory)
if (-not (Test-Path $app)) { throw "The app directory is missing: $app" }
if (-not (Test-Path (Join-Path $app 'Grok Bot Anywhere.exe'))) {
    throw "Expected 'Grok Bot Anywhere.exe' inside $app. Build it with electron-builder first."
}

function Resolve-SdkTool([string]$name) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidate = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\$name" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if ($candidate) { return $candidate.FullName }
    throw "$name was not found. Install the Windows SDK."
}

if ($Version -notmatch '^\d+\.\d+\.\d+\.\d+$') { throw "Invalid package version: $Version" }
if (-not $DisplayName) { throw 'DisplayName must not be empty.' }
if (-not $PublisherDisplayName) { throw 'PublisherDisplayName must not be empty.' }

$output = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $output | Out-Null
$stage = Join-Path ([IO.Path]::GetTempPath()) ("grokbot-full-" + [Guid]::NewGuid().ToString('N'))

try {
    New-Item -ItemType Directory -Force -Path (Join-Path $stage 'app'), (Join-Path $stage 'Assets') | Out-Null

    $template = Get-Content -Raw -Encoding UTF8 (Join-Path $desktop 'resources\windows-share\AppxManifest.full.xml')
    $manifest = $template.
        Replace('__PACKAGE_NAME__', $PackageName).
        Replace('__PUBLISHER__', $Publisher).
        Replace('__DISPLAY_NAME__', $DisplayName).
        Replace('__PUBLISHER_DISPLAY_NAME__', $PublisherDisplayName).
        Replace('__VERSION__', $Version)
    [IO.File]::WriteAllText((Join-Path $stage 'AppxManifest.xml'), $manifest, [Text.UTF8Encoding]::new($false))

    & node (Join-Path $here 'make-share-icons.mjs') (Join-Path $stage 'Assets') | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Icon generation failed.' }

    Copy-Item (Join-Path $app '*') (Join-Path $stage 'app') -Recurse -Force

    $makePri = Resolve-SdkTool 'makepri.exe'
    $config = Join-Path $stage 'priconfig.xml'
    & $makePri createconfig /cf $config /dq lang-zh-CN /o | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'MakePri createconfig failed.' }
    & $makePri new /pr $stage /cf $config /of (Join-Path $stage 'resources.pri') /in $PackageName /o | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'MakePri failed.' }
    Remove-Item $config -Force -ErrorAction SilentlyContinue

    $msix = Join-Path $output ("GrokBot-$Version-x64.msix")
    & (Resolve-SdkTool 'makeappx.exe') pack /d $stage /p $msix /o | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'MakeAppx failed.' }

    if ($Sign -eq 'SelfSigned') {
        $thumb = $SigningThumbprint
        if (-not $thumb) {
            $match = Get-ChildItem Cert:\CurrentUser\My |
                Where-Object { $_.Subject -eq $Publisher } |
                Sort-Object NotAfter -Descending | Select-Object -First 1
            if (-not $match) { throw "No certificate for '$Publisher'. Run new-dev-certificate.ps1 first." }
            $thumb = $match.Thumbprint
        }
        & (Resolve-SdkTool 'signtool.exe') sign /fd SHA256 /a /sha1 $thumb $msix | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Signing failed.' }
        Write-Host "Signed with $thumb."
    } else {
        Write-Host 'Left unsigned for SignPath or Partner Center.'
    }

    Write-Host "Package: $msix"
    Write-Host 'Not done yet: userData migration and .appinstaller updates.'
}
finally {
    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue }
}
