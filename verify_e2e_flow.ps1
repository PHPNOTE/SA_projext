<#
.SYNOPSIS
    Master Automated End-to-End Verification Script
.DESCRIPTION
    Executes the complete 4-tier E2E verification suite for the Car Repair Queue and Order Management System,
    verifying check-in, repair lifecycle, parts deduction, invoicing, invariants, and reporting.
#>
param (
    [string]$Mode = "contract",
    [string]$TargetUrl = "http://localhost:8080/api"
)

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$testsDir = Join-Path $rootDir "tests"

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  CAR REPAIR QUEUE & ORDER MANAGEMENT SYSTEM -- MASTER E2E VERIFICATION SUITE" -ForegroundColor Yellow
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "Mode       : $Mode" -ForegroundColor White
Write-Host "Target URL : $TargetUrl" -ForegroundColor White
Write-Host "Tests Path : $testsDir" -ForegroundColor White
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Cyan

# Execute all tiers via the test runner
$nodeRunner = Join-Path $testsDir "run_all_tests.mjs"
& node $nodeRunner --tier all --mode $Mode --target $TargetUrl

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[SUCCESS] All E2E verification suites passed 100%! System is fully verified." -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "[FAILURE] E2E verification encountered failures. Check logs above." -ForegroundColor Red
    exit 1
}
