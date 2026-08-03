param(
    [switch]$Clean,
    [switch]$Package,
    [switch]$Publish
)

# Resolve project root (assumes this script resides in the Electron project root)
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-ErrorMsg($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

# Clean previous build artifacts
if ($Clean) {
    Write-Info "Cleaning previous artifacts..."
    Remove-Item -Recurse -Force "$ProjectRoot\dist" -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force "$ProjectRoot\build" -ErrorAction SilentlyContinue
    Write-Info "Clean complete."
}

# Install npm dependencies (including electron and electron-builder)
Write-Info "Installing npm dependencies..."
Push-Location $ProjectRoot
npm ci
if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "npm install failed. Exiting."
    exit 1
}
Pop-Location

# Copy embedded JRE (if present) into Electron resources
$JreSource = "$ProjectRoot\jre"
$JreDest   = "$ProjectRoot\resources\jre"
if (Test-Path $JreSource) {
    Write-Info "Copying embedded JRE..."
    New-Item -ItemType Directory -Force -Path $JreDest | Out-Null
    Copy-Item -Recurse -Force "$JreSource\*" $JreDest
    Write-Info "JRE copied."
} else {
    Write-Info "No JRE folder found – skipping embed step."
}

# Package the Electron app
if ($Package) {
    Write-Info "Packaging with electron-builder..."
    Push-Location $ProjectRoot
    npx electron-builder build --win --publish never
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "electron-builder failed. Exiting."
        exit 1
    }
    Pop-Location
    Write-Info "Packaging complete. See ./dist folder."
}

# Placeholder for publishing step
if ($Publish) {
    Write-Info "Publish step not implemented – add your own logic here."
}

Write-Info "build.ps1 finished."
