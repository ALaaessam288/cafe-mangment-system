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
# The machine's global ~/.m2/settings.xml pins localRepository to D:\siron-repo for offline
# builds, but that mirror predates spring-boot-starter-parent 4.1.0. The default
# ~/.m2/repository cache already has it, so point Maven there instead of touching settings.xml.
$UserRepo = Join-Path $env:USERPROFILE ".m2\repository"
& $mvnw clean package -DskipTests "-Dmaven.repo.local=$UserRepo"
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
    # electron-builder wipes dist\win-unpacked before it repacks. Windows refuses to
    # delete an .exe that is still mapped by a running process, which surfaces as
    # "remove ...\CafePOS.exe: Access is denied" - a file lock, not a build error.
    # So: stop anything holding it, then clear the folder ourselves.
    Write-Info "Closing any running Caffio / CafePOS / Electron instances and freeing port 8080..."
    foreach ($procName in @('Caffio', 'CafePOS', 'electron')) {
        Get-Process -Name $procName -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Info "  stopping $($_.ProcessName) (PID $($_.Id))"
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
    }
    # Free port 8080
    Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Info "  stopping process holding port 8080 (PID $($_.OwningProcess))"
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    # Also catch a packaged build launched from this project's own output folder.
    Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -and $_.Path.StartsWith("$ProjectRoot\dist", [StringComparison]::OrdinalIgnoreCase) } |
        ForEach-Object {
            Write-Info "  stopping $($_.ProcessName) (PID $($_.Id))"
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
    Start-Sleep -Milliseconds 800

    $Unpacked = "$ProjectRoot\dist\win-unpacked"
    if (Test-Path $Unpacked) {
        Write-Info "Removing previous unpacked build..."
        Remove-Item -Recurse -Force $Unpacked -ErrorAction SilentlyContinue
        if (Test-Path $Unpacked) {
            Write-ErrorMsg "Could not delete $Unpacked - a file in it is still locked."
            Write-ErrorMsg "Close CafePOS (check the system tray) and any Explorer window open on that folder, then run again."
            exit 1
        }
    }

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
