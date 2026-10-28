param([string]$JavaHome = 'C:\Program Files\Java\jdk-24')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$signingRoot=Join-Path $projectRoot '.signing'
$keyFile=Join-Path $signingRoot 'sensering-release.p12'
$propertiesFile=Join-Path $signingRoot 'release.properties'
if((Test-Path -LiteralPath $keyFile) -and (Test-Path -LiteralPath $propertiesFile)){Write-Output 'Existing local signing key retained.';exit 0}
if((Test-Path -LiteralPath $keyFile) -or (Test-Path -LiteralPath $propertiesFile)){throw 'Incomplete signing configuration; preserve the existing files before repair.'}
New-Item -ItemType Directory -Path $signingRoot -Force | Out-Null
$randomBytes=[byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($randomBytes)
$env:SENSERING_LOCAL_SIGNING_PASSWORD=[Convert]::ToBase64String($randomBytes)
try {
    & (Join-Path $JavaHome 'bin\keytool.exe') -genkeypair -alias sensering -keyalg RSA -keysize 3072 -validity 10000 -storetype PKCS12 -keystore $keyFile -storepass:env SENSERING_LOCAL_SIGNING_PASSWORD -dname 'CN=SenseRing, OU=Android, O=SenseRing, C=IN'
    if($LASTEXITCODE -ne 0){throw 'Could not create the signing key.'}
    [System.IO.File]::WriteAllText($propertiesFile,('password='+$env:SENSERING_LOCAL_SIGNING_PASSWORD+"`n"))
    Write-Output 'Local release signing key created. Private signing files are excluded from source archives.'
} finally {Remove-Item Env:SENSERING_LOCAL_SIGNING_PASSWORD -ErrorAction SilentlyContinue}
