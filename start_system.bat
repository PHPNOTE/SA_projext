@echo off
chcp 65001 > nul
title Garage Management System - Launcher
echo ===============================================================================
echo   CAR REPAIR QUEUE ^& ORDER MANAGEMENT SYSTEM (ระบบจัดการคิวและออเดอร์อู่ซ่อมรถ)
echo ===============================================================================
echo.
echo [1/3] Starting Spring Boot Backend (Java 21 + Direct JDBC) on port 8080...
start "Garage Backend (Spring Boot :8080)" cmd /k "cd /d "%~dp0backend" && java -jar target\backend-1.0.0-SNAPSHOT.jar"

echo [2/3] Starting Next.js Frontend on port 3000...
start "Garage Frontend (Next.js :3000)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo [3/3] Waiting for servers to initialize (approx. 5 seconds)...
timeout /t 5 /nobreak > nul

echo.
echo ===============================================================================
echo   SYSTEM LAUNCHED SUCCESSFULLY!
echo ===============================================================================
echo   - Web Application : http://localhost:3000
echo   - REST API        : http://localhost:8080/api
echo   - H2 SQL Console  : http://localhost:8080/h2-console
echo       * JDBC URL    : jdbc:h2:file:./data/garagedb
echo       * Username    : sa
echo       * Password    : (blank)
echo.
echo   Staff Demo Accounts (Password for all: password123):
echo   - Front Desk      : frontdesk
echo   - Mechanic        : mechanic1
echo   - Warehouse       : warehouse1
echo   - Sales Counter   : sales1
echo   - Administrator   : admin
echo.
echo   Opening http://localhost:3000 in your default browser...
echo ===============================================================================
start http://localhost:3000
