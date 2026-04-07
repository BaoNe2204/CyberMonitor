# CyberMonitor Agent v3 - Build Script (PowerShell)
# Tao .exe standalone tu main.py + agent_core.py
# Chi can chay: powershell -ExecutionPolicy Bypass -File build.ps1
# MOI: phai chay tu thu muc Agent_build_exe, KHONG phai tu System32

param(
    [switch]$Clean
)

$ErrorActionPreference = "Continue"
$BuildDir = $PSScriptRoot

# Neu chay tu System32 (PowerShell admin), tu dong doi sang thu muc build
$_pwd = $PWD.Path
$_root = $env:SystemRoot
if (($_pwd -like "*System32*") -or ($_root -like "*Windows")) {
    Write-Host "[INFO] Phat hien chay tu System32 - tu dong chuyen thu muc..." -ForegroundColor Yellow
    Set-Location $BuildDir
    Write-Host "[INFO] Da doi sang: $(Get-Location)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  CyberMonitor Agent v3 - Build Script" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Check Python ────────────────────────────────────────────────────────────
Write-Host "[1/6] Checking Python..." -ForegroundColor Green
try {
    $pyVer = python --version 2>&1
    Write-Host "  $pyVer" -ForegroundColor Gray
    if ($pyVer -notmatch "Python 3\.[89]|Python 3\.1[0-4]") {
        Write-Host "  [!] Python 3.8+ recommended" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [ERROR] Python not found. Please install Python 3.8+" -ForegroundColor Red
    Write-Host "  Download: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# ── 2. Stop running agent ──────────────────────────────────────────────────────
Write-Host "[2/6] Stopping running agent..." -ForegroundColor Green
$running = Get-Process -Name "CyberMonitorAgent" -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "  Found $($running.Count) instance(s) - stopping..." -ForegroundColor Yellow
    $running | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "  Stopped." -ForegroundColor Gray
} else {
    Write-Host "  No running agent." -ForegroundColor Gray
}

# ── 3. Install dependencies ────────────────────────────────────────────────────
Write-Host "[3/6] Installing dependencies..." -ForegroundColor Green
python -m pip install --upgrade pyinstaller requests psutil pystray pillow signalrcore 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [!] Some deps failed - continuing anyway" -ForegroundColor Yellow
}

# ── 4. Clean ──────────────────────────────────────────────────────────────────
if ($Clean -or (Test-Path "$BuildDir\dist")) {
    Write-Host "[4/6] Cleaning previous builds..." -ForegroundColor Green
    if (Test-Path "$BuildDir\dist") { Remove-Item -Recurse -Force "$BuildDir\dist" }
    if (Test-Path "$BuildDir\build") { Remove-Item -Recurse -Force "$BuildDir\build" }
    if (Test-Path "$BuildDir\__pycache__") { Remove-Item -Recurse -Force "$BuildDir\__pycache__" }
    Write-Host "  Done." -ForegroundColor Gray
}

# ── 5. Build ─────────────────────────────────────────────────────────────────
Write-Host "[5/6] Building CyberMonitorAgent.exe..." -ForegroundColor Green
# LUON LUON doi working directory truoc khi chay pyinstaller
Set-Location $BuildDir
Write-Host "  Working dir: $(Get-Location)" -ForegroundColor Gray

$specFile = "$BuildDir\CyberMonitorAgent.spec"
if (-not (Test-Path $specFile)) {
    Write-Host "  [ERROR] Khong tim thay CyberMonitorAgent.spec" -ForegroundColor Red
    exit 1
}

python -m PyInstaller CyberMonitorAgent.spec --clean --noconfirm 2>&1 | ForEach-Object {
    if ($_ -match "error|warning") {
        Write-Host "  $_" -ForegroundColor Yellow
    }
}
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  [ERROR] Build failed (exit $LASTEXITCODE)" -ForegroundColor Red
    Write-Host "  Nguyen nhan: PyInstaller loi. Kiem tra loi o tren." -ForegroundColor Yellow
    Set-Location $BuildDir
    exit 1
}

# ── 6. Verify ─────────────────────────────────────────────────────────────────
Write-Host "[6/6] Verifying build..." -ForegroundColor Green
$exePath = "$BuildDir\dist\CyberMonitorAgent.exe"
if (Test-Path $exePath) {
    $size = [math]::Round((Get-Item $exePath).Length / 1MB, 2)
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Output : $exePath" -ForegroundColor Cyan
    Write-Host "  Size   : $size MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Tinh nang:" -ForegroundColor Yellow
    Write-Host "    - Thu thap traffic + system metrics" -ForegroundColor Gray
    Write-Host "    - Phat hien DDoS, BruteForce, PortScan, SQLi, XSS, Malware" -ForegroundColor Gray
    Write-Host "    - Auto-block IP (netsh / iptables)" -ForegroundColor Gray
    Write-Host "    - SignalR real-time (nhan lenh block/unblock tu backend)" -ForegroundColor Gray
    Write-Host "    - Luu config API Key o APPDATA" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Cach su dung:" -ForegroundColor Yellow
    Write-Host "    cd $BuildDir\dist" -ForegroundColor Gray
    Write-Host "    .\CyberMonitorAgent.exe" -ForegroundColor Gray
    Write-Host "    .\CyberMonitorAgent.exe -k YOUR_API_KEY -u http://localhost:5000" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "  [ERROR] File not found: $exePath" -ForegroundColor Red
    exit 1
}
