# Caffio <-> Neon end-to-end check, for Windows.
#
# Double-click test-neon.cmd in the project folder (it runs this file). It will:
#   1. ask for your Neon connection string (typing is hidden; it is never saved to disk),
#   2. build the app if target\caffio-0.0.1-SNAPSHOT.jar is missing,
#   3. start the app against Neon on http://localhost:18080 (Flyway creates the tables),
#   4. check /api/health, register a test cafe, log in, create a menu category and read it back,
#   5. stop the app and print PASS / FAIL for each step.
# The app log goes to %TEMP%\caffio-neon-test.log.

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Port = 18080
$Base = "http://localhost:$Port"
$Log = Join-Path $env:TEMP 'caffio-neon-test.log'
$ErrLog = Join-Path $env:TEMP 'caffio-neon-test.err.log'
$results = New-Object System.Collections.Generic.List[string]

function Pass($m) { Write-Host "  PASS  $m" -ForegroundColor Green; $results.Add("PASS  $m") }
function Fail($m) { Write-Host "  FAIL  $m" -ForegroundColor Red; $results.Add("FAIL  $m") }
function Info($m) { Write-Host $m -ForegroundColor Cyan }

# 1. Connection string ---------------------------------------------------------------------------
Info "Paste your Neon connection string (Neon > Connect, Connection pooling OFF), then press Enter."
Info "(What you type is hidden.)"
$secure = Read-Host -AsSecureString 'Neon URL'
$url = [System.Net.NetworkCredential]::new('', $secure).Password.Trim().Trim('"').Trim("'")
if ($url -like 'psql *') { $url = $url.Substring(5).Trim().Trim('"').Trim("'") }
if ($url -notmatch '^postgres(ql)?://') { Write-Host "That does not look like a postgresql:// URL." -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }
if ($url -match '-pooler\.') { Write-Host "This is the POOLED string (-pooler). Turn Connection pooling OFF in Neon and copy again." -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }
$url = $url -replace '[&?]channel_binding=require', ''
if ($url -notmatch 'sslmode=') { $url += $(if ($url.Contains('?')) { '&' } else { '?' }) + 'sslmode=require' }
if ($url -notmatch '\?') { $url = $url -replace '^([^&]*)&', '$1?' }

# 2. Build if needed ----------------------------------------------------------------------------
$Jar = Join-Path $Root 'target\caffio-0.0.1-SNAPSHOT.jar'
if (-not (Test-Path $Jar)) {
    Info "Building the app (first time only, takes a few minutes)..."
    Push-Location (Join-Path $Root 'frontend'); npm ci; if ($LASTEXITCODE) { throw 'frontend npm ci failed' }
    npm run build; if ($LASTEXITCODE) { throw 'frontend build failed' }; Pop-Location
    & (Join-Path $Root 'mvnw.cmd') -B clean package -P saas-prod -DskipTests
    if ($LASTEXITCODE -or -not (Test-Path $Jar)) { throw 'Maven build failed' }
}

$Java = Join-Path $Root 'jre\bin\java.exe'
if (-not (Test-Path $Java)) { $Java = 'java' }

# 3. Start the app ------------------------------------------------------------------------------
$bytes = New-Object byte[] 48; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$env:DATABASE_URL = $url
$env:PORT = "$Port"
$env:FLYWAY_ENABLED = 'true'
$env:JPA_DDL_AUTO = 'validate'
$env:JWT_SECRET = [Convert]::ToBase64String($bytes)
$env:APP_PLATFORM_PROVISIONING_KEY = 'neon-test'
$env:SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE = '0'
$env:SPRING_DATASOURCE_HIKARI_IDLE_TIMEOUT = '60000'
$env:SPRING_DATASOURCE_HIKARI_KEEPALIVE_TIME = '0'

Info "Starting Caffio against Neon on $Base ..."
$proc = Start-Process -FilePath $Java -ArgumentList '-jar', "`"$Jar`"" -RedirectStandardOutput $Log -RedirectStandardError $ErrLog -NoNewWindow -PassThru

try {
    $up = $false
    for ($i = 0; $i -lt 180 -and -not $proc.HasExited; $i++) {
        Start-Sleep -Seconds 1
        try { Invoke-RestMethod "$Base/api/ping" -TimeoutSec 2 | Out-Null; $up = $true; break } catch { }
    }
    $logText = (Get-Content $Log -Raw -ErrorAction SilentlyContinue) + (Get-Content $ErrLog -Raw -ErrorAction SilentlyContinue)
    if (-not $up) {
        Fail "App did not start. Last log lines:"
        ($logText -split "`n" | Select-Object -Last 25) | ForEach-Object { Write-Host "    $_" }
        return
    }
    Pass "App started (Started CaffioApplication)"
    $fly = ($logText -split "`n" | Where-Object { $_ -match 'FLYWAY|Flyway|Successfully applied|Schema .* is up to date|now at version' } | Select-Object -Last 3)
    if ($fly) { Pass "Flyway: $(($fly -join ' | ').Trim())" } else { Fail "No Flyway lines found in the log" }

    # 4. Health ---------------------------------------------------------------------------------
    $health = Invoke-RestMethod "$Base/api/health" -TimeoutSec 30
    $hjson = $health | ConvertTo-Json -Compress -Depth 5
    if ($hjson -match 'PostgreSQL') { Pass "/api/health -> $hjson" } else { Fail "/api/health does not mention PostgreSQL: $hjson" }

    # 5. Register a test cafe, log in, write + read ----------------------------------------------
    $slug = 'neon-test-' + (Get-Date -Format 'yyyyMMddHHmm')
    $pw = 'NeonTest' + (Get-Random -Minimum 1000 -Maximum 9999)
    $reg = @{ name = 'Neon Test Cafe'; slug = $slug; businessType = 'CAFE'; ownerUsername = 'owner';
              ownerPassword = $pw; ownerFullName = 'Neon Test Owner'; currency = 'EGP'; defaultTables = 2 } | ConvertTo-Json
    $r = Invoke-RestMethod "$Base/api/auth/register-trial" -Method Post -ContentType 'application/json' -Body $reg
    Pass "Registered test cafe '$slug' (tenantId $($r.tenantId))"

    $login = @{ tenantSlug = $slug; username = 'owner'; password = $pw } | ConvertTo-Json
    $l = Invoke-RestMethod "$Base/api/auth/login" -Method Post -ContentType 'application/json' -Body $login
    if ($l.token) { Pass "Logged in as owner (role $($l.role))" } else { Fail "Login returned no token" }
    $h = @{ Authorization = "Bearer $($l.token)" }

    $cat = @{ nameAr = 'Neon test AR'; nameEn = 'Neon test'; displayOrder = 99 } | ConvertTo-Json
    $c = Invoke-RestMethod "$Base/api/categories" -Method Post -Headers $h -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($cat))
    Pass "Created category id $($c.id)"
    $back = Invoke-RestMethod "$Base/api/categories/$($c.id)" -Headers $h
    if ($back.nameEn -eq 'Neon test') { Pass "Read category back: $($back.nameEn)" } else { Fail "Read-back mismatch: $($back | ConvertTo-Json -Compress)" }
}
catch {
    Fail "Error: $($_.Exception.Message)"
    if ($_.ErrorDetails.Message) { Write-Host "    $($_.ErrorDetails.Message)" }
}
finally {
    if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
    Write-Host ''
    Info '===== RESULT ====='
    $results | ForEach-Object { Write-Host $_ }
    Write-Host ''
    Write-Host "App log: $Log"
    Read-Host 'Press Enter to close'
}
