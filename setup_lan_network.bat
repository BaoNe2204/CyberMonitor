@echo off
chcp 65001 >nul
title CyberMonitor - LAN Network Setup
color 0A

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║       CyberMonitor - LAN Network Setup                       ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

python setup_lan_network.py

echo.
echo Press any key to exit...
pause >nul
