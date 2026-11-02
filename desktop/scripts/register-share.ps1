# Registers the share package for the current user.
#
# The certificate lives in the machine trust store, which needs one elevation.
# Everything else (Add-AppxPackage) runs as the signed-in user on purpose: a
# package installed from an elevated shell would belong to that other account.
param(
    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'Grok Bot Anywhere'),
    [string]$MsixPath = '',
    [string]$CertificatePath = '',
    [switch]$SkipCertificate
)

$ErrorActionPreference = 'Stop'
$install = [IO.Path]::GetFullPath($InstallRoot)
if (-not $MsixPath) { $MsixPath = Join-Path $install 'GrokBot.ShareTarget.msix' }
if (-not (Test-Path $MsixPath)) { throw "The package is missing: $MsixPath" }
if (-not (Test-Path (Join-Path $install 'share-target\GrokBotShareTarget.exe'))) {
    throw "The share helper is missing under $install\share-target"
}

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    return ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not $SkipCertificate) {
    if (-not $CertificatePath) {
        $CertificatePath = Get-ChildItem (Join-Path $install 'certs\*.cer') -ErrorAction SilentlyContinue |
            Select-Object -First 1 -ExpandProperty FullName
    }
    if ($CertificatePath -and (Test-Path $CertificatePath)) {
        $certificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new($CertificatePath)
        try {
            $trusted = Get-ChildItem Cert:\LocalMachine\TrustedPeople |
                Where-Object { $_.Thumbprint -eq $certificate.Thumbprint }
            if (-not $trusted) {
                if (-not (Test-IsAdmin)) {
                    Write-Host "Importing the certificate into Trusted People needs one elevation..."
                    $hostExe = (Get-Process -Id $PID).Path
                    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
                        "Import-Certificate -FilePath '$CertificatePath' -CertStoreLocation Cert:\LocalMachine\TrustedPeople | Out-Null")
                    $elevated = Start-Process -FilePath $hostExe -Verb RunAs -ArgumentList $arguments -Wait -PassThru
                    if ($elevated.ExitCode -ne 0) { throw 'The certificate import was cancelled or failed.' }
                } else {
                    Import-Certificate -FilePath $CertificatePath -CertStoreLocation Cert:\LocalMachine\TrustedPeople | Out-Null
                }
            }
        } finally { $certificate.Dispose() }
    }
}

Add-AppxPackage -Path $MsixPath -ExternalLocation $install
Write-Host "Registered. Restart WeChat (kill Weixin and WeChatAppEx) so the forward menu picks it up."
