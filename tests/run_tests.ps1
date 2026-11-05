<#
.SYNOPSIS
    Car Repair Queue & Order Management System - PowerShell Test Suite Runner
.DESCRIPTION
    Executes the opaque-box end-to-end test suite across Tiers 1-4.
.PARAMETER Tier
    Which tier to execute: '1', '2', '3', '4', or 'all' (default).
.PARAMETER Mode
    Execution mode: 'contract' (in-memory oracle) or 'live' (HTTP REST API).
.PARAMETER TargetUrl
    Base URL for live execution (default: 'http://localhost:8080/api').
.PARAMETER File
    Specific test file to execute.
#>
param (
    [string]$Tier = "all",
    [string]$Mode = "contract",
    [string]$TargetUrl = "http://localhost:8080/api",
    [string]$File = "",
    [switch]$Json
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Verify Node.js is available
try {
    $nodeVersion = & node -v
    Write-Host "[INFO] Node.js runtime detected: $nodeVersion" -ForegroundColor Cyan
} catch {
    Write-Error "Node.js is required to execute the test suite but was not found in PATH."
    exit 1
}

$cmdArgs = @("$scriptDir\run_all_tests.mjs", "--tier", $Tier, "--mode", $Mode, "--target", $TargetUrl)
if ($File -ne "") {
    $cmdArgs += @("--file", $File)
}
if ($Json) {
    $cmdArgs += @("--json")
}

& node $cmdArgs
exit $LASTEXITCODE
