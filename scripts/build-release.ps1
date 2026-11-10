$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot

$shortRoot = 'C:\mapp'
$shortProjectRoot = 'C:\Users\adity\OneDrive\Desktop\Video\NEWFOL~1\BHARAT~4\MyApp'

$shortRootParent = Split-Path -Parent $shortRoot

Write-Host "========================================="
Write-Host " VidBuxApp Android Release Build"
Write-Host "========================================="
Write-Host "Project Root : $projectRoot"
Write-Host "Short Root   : $shortRoot"
Write-Host ""

# Make sure C:\ exists
if (-not (Test-Path -LiteralPath $shortRootParent)) {
    New-Item -ItemType Directory -Path $shortRootParent -Force | Out-Null
}

# Remove existing C:\mapp
if (Test-Path -LiteralPath $shortRoot) {
    Write-Host "Existing $shortRoot found. Checking..."
    $item = Get-Item -LiteralPath $shortRoot -Force

    if ($item.LinkType -eq 'Junction' -or ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
        Write-Host "Removing existing junction/reparse point..."
        cmd.exe /c "rmdir `"$shortRoot`"" | Out-Null
    }
    else {
        Write-Host "Existing path is a normal directory."
        Remove-Item -LiteralPath $shortRoot -Recurse -Force -ErrorAction Stop
    }

    if (Test-Path -LiteralPath $shortRoot) {
        throw "Unable to remove $shortRoot"
    }

    Write-Host "$shortRoot removed successfully."
}

Write-Host ""
Write-Host "Creating junction..."
New-Item -ItemType Junction -Path $shortRoot -Target $shortProjectRoot -Force | Out-Null

Write-Host "Junction created successfully."
Write-Host "$shortRoot -> $projectRoot"
Write-Host ""

# Verify junction
if (-not (Test-Path -LiteralPath $shortRoot)) {
    throw "Junction creation failed."
}

# Move into Android directory
$androidRoot = Join-Path $shortRoot 'android'

if (-not (Test-Path -LiteralPath $androidRoot)) {
    throw "Android directory not found: $androidRoot"
}

Set-Location $androidRoot

Write-Host "Android directory:"
Write-Host $androidRoot
Write-Host ""

# Run Gradle release build
$gradlew = Join-Path $androidRoot 'gradlew.bat'

if (-not (Test-Path -LiteralPath $gradlew)) {
    throw "gradlew.bat not found at $gradlew"
}

Write-Host "Starting Gradle release build..."
Write-Host ""

& $gradlew bundleRelease

$exitCode = $LASTEXITCODE

Write-Host ""

if ($exitCode -eq 0) {
    Write-Host "========================================="
    Write-Host " Android App Bundle Build Successful"
    Write-Host "========================================="
}
else {
    Write-Error "Android Release Build failed with exit code: $exitCode"
}

exit $exitCode