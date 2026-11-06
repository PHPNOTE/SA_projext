# =============================================================================
# Automated Project Submission Packaging Script
# Creates a clean, professional submission ZIP package for the professor
# =============================================================================

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $PSScriptRoot
$garageDir = $PSScriptRoot

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  CAR REPAIR MANAGEMENT SYSTEM -- SUBMISSION PACKAGING TOOL" -ForegroundColor Yellow
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

$outputDir = Join-Path $rootDir "Submission_Package"
$zipPath = Join-Path $rootDir "Car_Repair_System_Final_Submission.zip"

# Clean prior packaging artifacts
if (Test-Path $outputDir) { Remove-Item -Path $outputDir -Recurse -Force }
if (Test-Path $zipPath) { Remove-Item -Path $zipPath -Force }

New-Item -ItemType Directory -Path $outputDir | Out-Null
Write-Host "[1/4] Created clean packaging directory..." -ForegroundColor Green

# 1. Copy Document Deliverables
Write-Host "[2/4] Collecting documentation and diagrams..." -ForegroundColor White
$reportPdf = Join-Path $rootDir "Car_Repair_Parts_Management_System_Final_Report.pdf"
if (Test-Path $reportPdf) {
    Copy-Item -Path $reportPdf -Destination (Join-Path $outputDir "01_Car_Repair_Final_Report.pdf")
}

$drawioFile = Join-Path $rootDir "Car_Repair_Parts_Management_System_Revised-v2 (5).drawio"
if (Test-Path $drawioFile) {
    Copy-Item -Path $drawioFile -Destination (Join-Path $outputDir "02_System_Design_Diagrams.drawio")
}

$readmeFile = Join-Path $garageDir "README.md"
if (Test-Path $readmeFile) {
    Copy-Item -Path $readmeFile -Destination (Join-Path $outputDir "03_System_Architecture_README.md")
}

$presGuide = Join-Path $garageDir "PRESENTATION_GUIDE.md"
if (Test-Path $presGuide) {
    Copy-Item -Path $presGuide -Destination (Join-Path $outputDir "04_Presentation_and_Demo_Guide.md")
}

$slidesFile = Join-Path $rootDir "Car_Repair_System_Presentation_Slides.pptx"
if (Test-Path $slidesFile) {
    Copy-Item -Path $slidesFile -Destination (Join-Path $outputDir "05_Presentation_Slides.pptx")
}

# 2. Package Source Code (Excluding heavy node_modules, target, .next to keep size under 30MB)
Write-Host "[3/4] Packaging clean source code (excluding node_modules / target / temp)..." -ForegroundColor White
$codeTarget = Join-Path $outputDir "Source_Code\garage_system"
New-Item -ItemType Directory -Path $codeTarget -Force | Out-Null

# Copy scripts & configs
Get-ChildItem -Path $garageDir -File | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $codeTarget
}

# Copy Backend (src & pom.xml, plus compiled JAR for instant run)
$backendTarget = Join-Path $codeTarget "backend"
New-Item -ItemType Directory -Path $backendTarget -Force | Out-Null
Copy-Item -Path (Join-Path $garageDir "backend\pom.xml") -Destination $backendTarget
Copy-Item -Path (Join-Path $garageDir "backend\src") -Destination $backendTarget -Recurse

$targetJarDir = Join-Path $backendTarget "target"
New-Item -ItemType Directory -Path $targetJarDir -Force | Out-Null
$compiledJar = Join-Path $garageDir "backend\target\backend-1.0.0-SNAPSHOT.jar"
if (Test-Path $compiledJar) {
    Copy-Item -Path $compiledJar -Destination $targetJarDir
}

# Copy Frontend (src, package.json, configs)
$frontendTarget = Join-Path $codeTarget "frontend"
New-Item -ItemType Directory -Path $frontendTarget -Force | Out-Null
Copy-Item -Path (Join-Path $garageDir "frontend\package.json") -Destination $frontendTarget
Copy-Item -Path (Join-Path $garageDir "frontend\tsconfig.json") -Destination $frontendTarget
Copy-Item -Path (Join-Path $garageDir "frontend\next.config.js") -Destination $frontendTarget
Copy-Item -Path (Join-Path $garageDir "frontend\tailwind.config.js") -Destination $frontendTarget
Copy-Item -Path (Join-Path $garageDir "frontend\postcss.config.js") -Destination $frontendTarget
Copy-Item -Path (Join-Path $garageDir "frontend\src") -Destination $frontendTarget -Recurse

# Copy Tests
Copy-Item -Path (Join-Path $garageDir "tests") -Destination $codeTarget -Recurse

# 3. Create ZIP archive
Write-Host "[4/4] Creating final ZIP archive..." -ForegroundColor White
Compress-Archive -Path "$outputDir\*" -DestinationPath $zipPath -CompressionLevel Optimal

$zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  SUCCESS! SUBMISSION PACKAGE CREATED: $zipPath" -ForegroundColor Green
Write-Host "  Package Size : ${zipSize} MB (Clean & Portable)" -ForegroundColor Yellow
Write-Host "================================================================================" -ForegroundColor Cyan
