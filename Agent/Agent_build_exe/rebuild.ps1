# CyberMonitor Agent - Rebuild Script (PowerShell)
# Run as Administrator

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  CyberMonitor Agent - Rebuild Script" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[WARNING] Not running as Administrator" -ForegroundColor Yellow
    Write-Host "Some operations may fail. Consider running as Admin." -ForegroundColor Yellow
    Write-Host ""
}

# Stop running agent
Write-Host "[1/6] Stopping running agent..." -ForegroundColor Green
$processes = Get-Process -Name "CyberMonitorAgent" -ErrorAction SilentlyContinue
if ($processes) {
    Write-Host "Found $($processes.Count) running instance(s)" -ForegroundColor Yellow
    foreach ($proc in $processes) {
        try {
            Stop-Process -Id $proc.Id -Force
            Write-Host "  Stopped PID $($proc.Id)" -ForegroundColor Gray
        } catch {
            Write-Host "  Failed to stop PID $($proc.Id) - may need Admin rights" -ForegroundColor Red
        }
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "No running agent found" -ForegroundColor Gray
}

# Check Python
Write-Host "[2/6] Checking Python..." -ForegroundColor Green
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  $pythonVersion" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Python not found" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "[3/6] Installing dependencies..." -ForegroundColor Green
python -m pip install --upgrade pyinstaller requests psutil pystray pillow signalrcore --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] Some dependencies may not be installed" -ForegroundColor Yellow
}

# Clean previous builds
Write-Host "[4/6] Cleaning previous builds..." -ForegroundColor Green
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path "build") { Remove-Item -Recurse -Force "build" }
if (Test-Path "__pycache__") { Remove-Item -Recurse -Force "__pycache__" }

# Build
Write-Host "[5/6] Building executable..." -ForegroundColor Green
python -m PyInstaller CyberMonitorAgent.spec --clean --noconfirm
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Build failed" -ForegroundColor Red
    exit 1
}

# Verify
Write-Host "[6/6] Verifying build..." -ForegroundColor Green
if (Test-Path "dist\CyberMonitorAgent.exe") {
    $fileSize = (Get-Item "dist\CyberMonitorAgent.exe").Length / 1MB
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  Build SUCCESSFUL!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Output: dist\CyberMonitorAgent.exe" -ForegroundColor Cyan
    Write-Host "Size:   $([math]::Round($fileSize, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "What's new in this build:" -ForegroundColor Yellow
    Write-Host "  - Auto-fetch server_id from backend" -ForegroundColor Gray
    Write-Host "  - No more 'No server_id provided' warning" -ForegroundColor Gray
    Write-Host "  - SignalR Hub auto-connects" -ForegroundColor Gray
    Write-Host "  - Remote block/unblock support" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\dist\CyberMonitorAgent.exe -k YOUR_API_KEY -u http://backend:5000" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "[ERROR] Executable not found after build" -ForegroundColor Red
}

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
