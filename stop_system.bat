@echo off
chcp 65001 > nul
title Garage Management System - Shutdown
echo ===============================================================================
echo   STOPPING GARAGE MANAGEMENT SYSTEM SERVERS (Port 8080 and Port 3000)
echo ===============================================================================
echo.

echo [1/2] Terminating process on port 8080 (Backend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [2/2] Terminating process on port 3000 (Frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo Systems stopped cleanly.
pause
