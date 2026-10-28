param([string]$JavaHome, [switch]$NewSigningKey)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
if(-not $JavaHome){$JavaHome=$env:JAVA_HOME}
if(-not $JavaHome -and (Test-Path -LiteralPath 'C:\Program Files\Java\jdk-24\bin\java.exe')){$JavaHome='C:\Program Files\Java\jdk-24'}
if(-not $JavaHome -or -not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin\java.exe'))){throw 'Set JAVA_HOME to an installed JDK 17 through 24.'}
$env:JAVA_HOME=$JavaHome
$env:GRADLE_USER_HOME=Join-Path $projectRoot '.toolchain\gradle-user-home'
$localSdk=Join-Path $projectRoot '.toolchain\android-sdk'
$localProperties=Join-Path $projectRoot 'local.properties'
if(-not (Test-Path -LiteralPath $localProperties) -and (Test-Path -LiteralPath (Join-Path $localSdk 'platforms\android-36\android.jar'))){
    [System.IO.File]::WriteAllText($localProperties,('sdk.dir='+$localSdk.Replace('\','/')+"`n"))
}
if($NewSigningKey){& (Join-Path $PSScriptRoot 'create-signing-key.ps1') -JavaHome $JavaHome}
if(-not (Test-Path -LiteralPath (Join-Path $projectRoot '.signing\release.properties'))){throw 'Restore the original private .signing directory for updates, or use -NewSigningKey for a separate new install identity.'}
$gradle=Join-Path $projectRoot '.toolchain\gradle-8.14.3\bin\gradle.bat'
if(-not (Test-Path -LiteralPath $gradle)){$gradle=Join-Path $projectRoot 'gradlew.bat'}
Push-Location $projectRoot
try {
    & $gradle :core:test :app:assembleRelease :app:lintRelease --no-daemon --console=plain
    if($LASTEXITCODE -ne 0){throw 'Android build or checks failed.'}
    Write-Output 'Signed APK: app\build\outputs\apk\release\app-release.apk'
} finally {Pop-Location}
