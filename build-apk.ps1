# Rebuild the Kairos Android APK. Run from the kairos/ folder.
$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

Write-Host "==> running tests" -ForegroundColor Cyan
npm test
if ($LASTEXITCODE -ne 0) { throw "tests failed - aborting build" }

# A stale service-worker cache means users keep running the old engine, so the
# cache version has to move whenever the web assets do.
$pkgVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
$sw = Get-Content www\sw.js -Raw
if ($sw -notmatch "var VERSION = '$([regex]::Escape($pkgVersion))'") {
  Write-Host "==> stamping service worker cache version $pkgVersion" -ForegroundColor Cyan
  $sw = $sw -replace "var VERSION = '[^']*'", "var VERSION = '$pkgVersion'"
  Set-Content www\sw.js $sw -NoNewline
}

Write-Host "==> syncing web assets" -ForegroundColor Cyan
npx cap sync android

Write-Host "==> gradle assembleDebug" -ForegroundColor Cyan
Set-Location android
.\gradlew.bat assembleDebug
Set-Location ..

Copy-Item android\app\build\outputs\apk\debug\app-debug.apk .\Kairos-debug.apk -Force
Write-Host "==> done: Kairos-debug.apk" -ForegroundColor Green
Get-Item .\Kairos-debug.apk | Select-Object Name, Length, LastWriteTime
