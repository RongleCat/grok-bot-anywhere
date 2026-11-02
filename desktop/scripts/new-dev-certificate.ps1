# Creates the self-signed certificate used by -Sign SelfSigned.
#
# The public part is written to <InstallRoot>\certs so register-share.ps1 can
# import it into Trusted People with a single elevation. The private key stays
# in the current user's store; it is never written to the repository.
param(
    [string]$Publisher = 'CN=Grok Bot Anywhere Dev',
    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'Grok Bot Anywhere'),
    [int]$Years = 2
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($Publisher)) { throw 'Publisher must not be empty.' }

$existing = Get-ChildItem Cert:\CurrentUser\My |
    Where-Object { $_.Subject -eq $Publisher } |
    Sort-Object NotAfter -Descending | Select-Object -First 1

if ($existing) {
    $certificate = $existing
    Write-Host "Reusing certificate $($certificate.Thumbprint) (expires $($certificate.NotAfter.ToString('yyyy-MM-dd')))."
} else {
    $certificate = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject $Publisher `
        -KeyUsage DigitalSignature `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -CertStoreLocation Cert:\CurrentUser\My `
        -KeyExportPolicy Exportable `
        -NotAfter (Get-Date).AddYears($Years)
    Write-Host "Created certificate $($certificate.Thumbprint)."
}

$certDirectory = Join-Path $InstallRoot 'certs'
New-Item -ItemType Directory -Force -Path $certDirectory | Out-Null
$cerPath = Join-Path $certDirectory 'GrokBot.ShareTarget.cer'
Export-Certificate -Cert $certificate -FilePath $cerPath -Force | Out-Null

Write-Host "Publisher: $($certificate.Subject)"
Write-Host "Thumbprint: $($certificate.Thumbprint)"
Write-Host "Public certificate: $cerPath"
Write-Host "Next: pack-share.ps1, then register-share.ps1 (it imports the certificate with one elevation)."
