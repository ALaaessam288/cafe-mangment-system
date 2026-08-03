param(
    [switch]$Clean,
    [switch]$Package,
    [switch]$Publish
)

# Resolve project root
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-ErrorMsg($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

# 1. Clean previous build artifacts
if ($Clean) {
    Write-Info "Cleaning previous artifacts..."
    Remove-Item -Recurse -Force "$ProjectRoot\dist" -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force "$ProjectRoot\target" -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force "$ProjectRoot\src\main\resources\static" -ErrorAction SilentlyContinue
    Write-Info "Clean complete."
}

# 2. Ensure JRE folder exists (so electron-builder extraResources doesn't fail)
$JreSource = "$ProjectRoot\jre"
if (-not (Test-Path $JreSource)) {
    Write-Info "Creating placeholder jre directory..."
    New-Item -ItemType Directory -Force -Path $JreSource | Out-Null
    # Create a dummy file so Git/Builder sees it
    New-Item -ItemType File -Force -Path "$JreSource\placeholder.txt" -Value "Place your offline JRE bin/ files here if you want to bundle JRE." | Out-Null
}

# 3. Build React Frontend
Write-Info "Building React Frontend..."
Push-Location "$ProjectRoot\frontend"
Write-Info "Installing frontend dependencies..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Frontend npm install failed."
    Pop-Location
    exit 1
}
Write-Info "Running Vite production build..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Vite build failed."
    Pop-Location
    exit 1
}
Pop-Location
Write-Success "Frontend build complete."

# 4. Copy Frontend static files to Spring Boot resources
Write-Info "Copying frontend assets to Spring Boot resources..."
$StaticFolder = "$ProjectRoot\src\main\resources\static"
if (Test-Path $StaticFolder) {
    Remove-Item -Recurse -Force $StaticFolder
}
New-Item -ItemType Directory -Force -Path $StaticFolder | Out-Null
Copy-Item -Recurse -Force "$ProjectRoot\frontend\dist\*" $StaticFolder
Write-Success "Frontend static resources copied."

# 5. Build Spring Boot Backend JAR
Write-Info "Compiling and packaging Spring Boot backend JAR..."
Push-Location $ProjectRoot
# Use mvnw.cmd on Windows
$mvnw = if ($IsWindows -or $env:OS -eq "Windows_NT") { ".\mvnw.cmd" } else { "./mvnw" }
& $mvnw clean package -DskipTests
if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Spring Boot packaging failed."
    Pop-Location
    exit 1
}
Pop-Location
Write-Success "Backend JAR packaged successfully at target/."

# 6. Install root (Electron) dependencies
Write-Info "Installing root npm dependencies (Electron)..."
Push-Location $ProjectRoot
npm install
if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Root npm install failed."
    Pop-Location
    exit 1
}
Pop-Location

# 7. Package Electron App
if ($Package) {
    Write-Info "Packaging Electron App with electron-builder..."
    Push-Location $ProjectRoot
    npx electron-builder build --win --publish never
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "electron-builder failed."
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Success "Packaging complete. Installer created in ./dist folder!"
}

if ($Publish) {
    Write-Info "Publish step not implemented."
}

Write-Success "All steps completed successfully!"
