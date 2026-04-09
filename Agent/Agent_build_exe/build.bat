@echo off
chcp 65001 >nul 2>&1
echo.
echo ============================================================
echo   CyberMonitor — build CyberMonitorAgent + CyberMonitorDebug
echo ============================================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found.
    pause
    exit /b 1
)

echo [1/4] pip install pyinstaller + requirements...
python -m pip install --upgrade pyinstaller >nul 2>&1
python -m pip install -r requirements.txt >nul 2>&1
if errorlevel 1 (
    python -m pip install requests psutil pystray pillow signalrcore websocket-client >nul 2>&1
)

echo [2/4] Stop running exe (if any)...
taskkill /F /IM CyberMonitorAgent.exe >nul 2>&1
taskkill /F /IM CyberMonitorDebug.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [3/4] Clean dist\build...
if exist "dist" rmdir /s /q "dist"
if exist "build" rmdir /s /q "build"
if exist "__pycache__" rmdir /s /q "__pycache__"
mkdir dist >nul 2>&1

echo [4/4] PyInstaller...
python -m PyInstaller CyberMonitorAgent.spec --clean --noconfirm
if errorlevel 1 (
    echo [ERROR] CyberMonitorAgent build failed
    pause
    exit /b 1
)
python -m PyInstaller CyberMonitorDebug.spec --clean --noconfirm
if errorlevel 1 (
    echo [ERROR] CyberMonitorDebug build failed
    pause
    exit /b 1
)

echo.
if exist "dist\CyberMonitorAgent.exe" if exist "dist\CyberMonitorDebug.exe" (
    echo OK: dist\CyberMonitorAgent.exe
    echo OK: dist\CyberMonitorDebug.exe
) else (
    echo [ERROR] Missing exe in dist\
)
echo.
pause
