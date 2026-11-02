# Builds the Windows share package in one step.
#
# Two signing modes, on purpose:
#   -SelfSigned  local development and testers (needs a dev certificate)
#   -Unsigned    the artifact SignPath signs later; the ZIP it produces is the
#                same shape the SignPath artifact configuration expects:
#                the helper exe plus the MSIX, nothing else.
#
# Output (under -OutputDirectory):
#   GrokBot.ShareTarget.msix        signed or unsigned package
#   share-target/                   helper next to the install root
#   resources.pri, Assets/          external content the package resolves
#   share-target-<version>.zip      SignPath input when -Sign Unsigned
param(
    [string]$Version = '1.0.0.0',
    [string]$Publisher = 'CN=GrokBotAnywhere',
    [string]$PackageName = 'dev.ronglecat.grokbotanywhere.share',
    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'Grok Bot Anywhere'),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\artifacts\share'),
    [ValidateSet('SelfSigned', 'Unsigned')]
    [string]$Sign = 'SelfSigned',
    [string]$SigningThumbprint = '',
    [switch]$SkipHelperBuild
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktop = Split-Path -Parent $here
$repository = Split-Path -Parent $desktop

function Resolve-SdkTool([string]$name) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidate = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\$name" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if ($candidate) { return $candidate.FullName }
    throw "$name was not found. Install the Windows SDK."
}

if ($Version -notmatch '^\d+\.\d+\.\d+\.\d+$') { throw "Invalid package version: $Version" }
if ([string]::IsNullOrWhiteSpace($Publisher)) { throw 'Publisher must not be empty.' }

$helperSource = Join-Path $repository 'native\windows\share-target\out\GrokBotShareTarget.exe'
if (-not $SkipHelperBuild -and -not (Test-Path $helperSource)) {
    Write-Host 'Building the share target helper...'
    & (Join-Path $repository 'native\windows\share-target\build.ps1')
}
if (-not (Test-Path $helperSource)) { throw "The share target helper is missing: $helperSource" }

$output = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $output | Out-Null
$install = [IO.Path]::GetFullPath($InstallRoot)
$stage = Join-Path ([IO.Path]::GetTempPath()) ("grokbot-share-" + [Guid]::NewGuid().ToString('N'))

try {
    New-Item -ItemType Directory -Force -Path $stage, (Join-Path $stage 'Assets') | Out-Null

    $template = Get-Content -Raw -Encoding UTF8 (Join-Path $desktop 'resources\windows-share\AppxManifest.xml')
    $manifest = $template.
        Replace('__PACKAGE_NAME__', $PackageName).
        Replace('__PUBLISHER__', $Publisher).
        Replace('__VERSION__', $Version)
    $manifestPath = Join-Path $stage 'AppxManifest.xml'
    [IO.File]::WriteAllText($manifestPath, $manifest, [Text.UTF8Encoding]::new($false))

    & node (Join-Path $here 'make-share-icons.mjs') (Join-Path $stage 'Assets') | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Icon generation failed.' }

    $makePri = Resolve-SdkTool 'makepri.exe'
    $config = Join-Path $stage 'priconfig.xml'
    & $makePri createconfig /cf $config /dq lang-zh-CN /o | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'MakePri createconfig failed.' }
    & $makePri new /pr $stage /cf $config /of (Join-Path $stage 'resources.pri') /in $PackageName /o | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'MakePri failed.' }
    Remove-Item $config -Force -ErrorAction SilentlyContinue

    $msix = Join-Path $output 'GrokBot.ShareTarget.msix'
    $makeAppx = Resolve-SdkTool 'makeappx.exe'
    # /nv: the package points at an executable that lives outside it (sparse).
    & $makeAppx pack /d $stage /p $msix /nv /o | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'MakeAppx failed.' }

    if ($Sign -eq 'SelfSigned') {
        $signtool = Resolve-SdkTool 'signtool.exe'
        $thumb = $SigningThumbprint
        if (-not $thumb) {
            $match = Get-ChildItem Cert:\CurrentUser\My |
                Where-Object { $_.Subject -eq $Publisher } |
                Sort-Object NotAfter -Descending | Select-Object -First 1
            if (-not $match) {
                throw "No signing certificate found for '$Publisher'. Run new-dev-certificate.ps1 first, or pass -SigningThumbprint."
            }
            $thumb = $match.Thumbprint
        }
        & $signtool sign /fd SHA256 /a /sha1 $thumb $msix | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Signing the package failed.' }
        $status = (Get-AuthenticodeSignature $msix).Status
        Write-Host "Signed with $thumb (Authenticode: $status)"
    } else {
        Write-Host 'Package left unsigned for SignPath.'
    }

    # External content: the helper, the resource index and the assets sit next to
    # the install root, because the package itself carries only identity.
    $shareTarget = Join-Path $install 'share-target'
    New-Item -ItemType Directory -Force -Path $shareTarget, (Join-Path $install 'Assets') | Out-Null
    Copy-Item $helperSource (Join-Path $shareTarget 'GrokBotShareTarget.exe') -Force
    Copy-Item (Join-Path $stage 'resources.pri') (Join-Path $install 'resources.pri') -Force
    Copy-Item (Join-Path $stage 'Assets\*.png') (Join-Path $install 'Assets') -Force
    Copy-Item $msix (Join-Path $install 'GrokBot.ShareTarget.msix') -Force

    if ($Sign -eq 'Unsigned') {
        $zip = Join-Path $output ("share-target-$Version.zip")
        Remove-Item $zip -Force -ErrorAction SilentlyContinue
        $zipStage = Join-Path ([IO.Path]::GetTempPath()) ("grokbot-share-zip-" + [Guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Force -Path (Join-Path $zipStage 'share-target') | Out-Null
        Copy-Item $helperSource (Join-Path $zipStage 'share-target\GrokBotShareTarget.exe') -Force
        Copy-Item $msix (Join-Path $zipStage 'GrokBot.ShareTarget.msix') -Force
        Compress-Archive -Path (Join-Path $zipStage '*') -DestinationPath $zip -Force
        Remove-Item $zipStage -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "SignPath input: $zip"
    }

    Write-Host "Package: $msix"
    Write-Host "Install root: $install"
    Write-Host "Next: register-share.ps1 -InstallRoot '$install'"
}
finally {
    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue }
}
