@echo off
chcp 65001 >nul 2>&1
echo.
echo ============================================================
echo   CyberMonitor Agent - Build Script
echo ============================================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.8+
    echo Download: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check pip
python -m pip --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] pip not found.
    pause
    exit /b 1
)

REM Install/upgrade PyInstaller
echo [1/5] Installing PyInstaller...
python -m pip install --upgrade pyinstaller >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Failed to install PyInstaller
    pause
    exit /b 1
)

REM Install required dependencies
echo [2/5] Installing dependencies...
python -m pip install -r requirements.txt >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Some dependencies may not be installed
    echo [INFO] Trying to install individually...
    python -m pip install requests psutil pystray pillow signalrcore websocket-client >nul 2>&1
)

REM Clean previous builds
echo [3/5] Cleaning previous builds...
if exist "dist\CyberMonitorAgent.exe" (
    echo [INFO] Stopping running agent if any...
    taskkill /F /IM CyberMonitorAgent.exe >nul 2>&1
    timeout /t 2 /nobreak >nul
)
if exist "dist" rmdir /s /q "dist"
if exist "build" rmdir /s /q "build"
if exist "__pycache__" rmdir /s /q "__pycache__"

REM Create dist folder
mkdir dist >nul 2>&1

REM Build with PyInstaller
echo [4/5] Building executable...
python -m PyInstaller CyberMonitorAgent.spec --clean --noconfirm
if errorlevel 1 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

REM Verify build
echo [5/5] Verifying build...
if exist "dist\CyberMonitorAgent.exe" (
    echo.
    echo ============================================================
    echo   Build SUCCESSFUL!
    echo ============================================================
    echo.
    echo Output: dist\CyberMonitorAgent.exe
    echo Size:   (check manually in Explorer)
    echo.
    echo Next steps:
    echo   1. Copy CyberMonitorAgent.exe to target machine
    echo   2. Run as Administrator on first launch
    echo   3. Enter your API Key when prompted
    echo   4. Agent will run in background (system tray)
    echo.
    echo To add to Windows Startup:
    echo   - Create shortcut to the .exe
    echo   - Place in shell:startup folder
    echo.
) else (
    echo.
    echo [ERROR] Executable not found after build
    echo.
)

pause
