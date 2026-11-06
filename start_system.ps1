# Garage Management System - PowerShell Launcher
$rootDir = $PSScriptRoot
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  CAR REPAIR QUEUE & ORDER MANAGEMENT SYSTEM (ระบบจัดการคิวและออเดอร์อู่ซ่อมรถ)" -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Starting Spring Boot Backend (Java 21 + Direct JDBC) on port 8080..." -ForegroundColor White
Start-Process cmd.exe -ArgumentList "/k cd /d `"$rootDir\backend`" && java -jar target\backend-1.0.0-SNAPSHOT.jar"

Write-Host "[2/3] Starting Next.js Frontend on port 3000..." -ForegroundColor White
Start-Process cmd.exe -ArgumentList "/k cd /d `"$rootDir\frontend`" && npm run dev"

Write-Host ""
Write-Host "[3/3] Waiting for servers to initialize (approx. 5 seconds)..." -ForegroundColor White
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "  SYSTEM LAUNCHED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "  - Web Application : http://localhost:3000" -ForegroundColor White
Write-Host "  - REST API        : http://localhost:8080/api" -ForegroundColor White
Write-Host "  - H2 SQL Console  : http://localhost:8080/h2-console" -ForegroundColor White
Write-Host "      * JDBC URL    : jdbc:h2:file:./data/garagedb" -ForegroundColor Gray
Write-Host "      * Username    : sa" -ForegroundColor Gray
Write-Host "      * Password    : (blank)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Staff Demo Accounts (Password for all: password123):" -ForegroundColor Yellow
Write-Host "  - Front Desk      : frontdesk" -ForegroundColor White
Write-Host "  - Mechanic        : somchai (or prasert)" -ForegroundColor White
Write-Host "  - Warehouse       : wichai" -ForegroundColor White
Write-Host "  - Sales Counter   : somsri" -ForegroundColor White
Write-Host "  - Administrator   : admin" -ForegroundColor White
Write-Host ""
Write-Host "  Opening http://localhost:3000 in your default browser..." -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Green

Start-Process "http://localhost:3000"
