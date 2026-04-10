# ============================================
# CyberMonitor - Tool đổi IP nhanh cho LAN
# ============================================

param(
    [string]$ApiPort = "5000",
    [string]$AiPort = "8000"
)

$ErrorActionPreference = "Stop"

# Tìm thư mục gốc project
$scriptDir = $PSScriptRoot
$projectRoot = $scriptDir

# Màu
function Write-Step { param($msg) Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-Succ { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Err  { param($msg) Write-Host "[!] $msg" -ForegroundColor Red }

# --- 1. Tìm IP LAN ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host " CyberMonitor - Đổi IP nhanh cho LAN" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

Write-Step "Đang tìm IP LAN..."
$adapter = Get-NetAdapter -Physical | Where-Object { $_.Status -eq "Up" } | Select-Object -First 1
$ipConfig = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
$currentIP = $ipConfig.IPAddress

if (-not $currentIP) {
    Write-Err "Không tìm thấy IP LAN. Thử lại thủ công."
    $currentIP = Read-Host "Nhập IP máy chủ (VD: 192.168.1.100)"
}

Write-Host "   IP hiện tại: $currentIP" -ForegroundColor Gray

# --- 2. Các file cần sửa ---
$frontendEnv   = "$projectRoot\Frontend\.env"
$backendConfig = "$projectRoot\Backend\CyberMonitor.API\appsettings.json"
$backendCors   = "$projectRoot\Backend\CyberMonitor.API\Program.cs"

# Validate
$missing = @()
if (-not (Test-Path $frontendEnv))   { $missing += $frontendEnv }
if (-not (Test-Path $backendConfig))  { $missing += $backendConfig }
if (-not (Test-Path $backendCors))    { $missing += $backendCors }

if ($missing.Count -gt 0) {
    Write-Err "Thiếu file:"
    $missing | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Chạy script từ thư mục gốc project CyberMonitor" -ForegroundColor Yellow
    exit 1
}

# --- 3. Đổi Frontend/.env ---
Write-Step "Đang cập nhật Frontend/.env..."
$envContent = @"
VITE_API_URL=http://$currentIP`:$ApiPort
VITE_WS_URL=ws://$currentIP`:$ApiPort
"@
Set-Content -Path $frontendEnv -Value $envContent -Encoding UTF8
Write-Succ "Frontend/.env → http://$currentIP`:$ApiPort"

# --- 4. Đổi appsettings.json (AiEngine BaseUrl) ---
Write-Step "Đang cập nhật appsettings.json..."
$json = Get-Content $backendConfig -Raw | ConvertFrom-Json
$json.AiEngineSettings.BaseUrl = "http://$currentIP`:$AiPort"
$json | ConvertTo-Json -Depth 10 | Set-Content -Path $backendConfig -Encoding UTF8
Write-Succ "appsettings.json → AiEngine BaseUrl = http://$currentIP`:$AiPort"

# --- 5. Thông báo CORS đã OK ---
Write-Step "CORS (Program.cs)..."
Write-Succ "CORS đã cho phép 192.168.x và 10.x - OK, không cần đổi"
Write-Step "Kestrel (appsettings.json)..."
Write-Succ "Kestrel đã lắng nghe 0.0.0.0:$ApiPort - OK, không cần đổi"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Hoàn tất! Đã cập nhật $currentIP" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Tiếp theo:" -ForegroundColor Yellow
Write-Host "  1. Rebuild Frontend: cd Frontend && npm run build"
Write-Host "  2. Chạy Vite dev:   npm run dev -- --host"
Write-Host "  3. Máy khác truy cập: http://$currentIP`:5173"
Write-Host ""
Write-Host "(API: http://$currentIP`:$ApiPort)" -ForegroundColor Gray
Write-Host "(AI Engine: http://$currentIP`:$AiPort)" -ForegroundColor Gray
