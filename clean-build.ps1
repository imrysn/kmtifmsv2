# Clean Build Script
Write-Host "Cleaning build artifacts..." -ForegroundColor Cyan

# Kill any running Electron processes
Write-Host "Stopping Electron processes..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*electron*" -or $_.ProcessName -like "*KMTI*"} | Stop-Process -Force -ErrorAction SilentlyContinue

# Wait for processes to fully close
Start-Sleep -Seconds 2

# Clean dist folder
if (Test-Path "dist") {
    Write-Host "Removing dist folder..." -ForegroundColor Yellow
    Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
    
    # Double check if it's gone
    if (Test-Path "dist") {
        Write-Host "WARNING: dist folder still exists. Trying again..." -ForegroundColor Red
        Start-Sleep -Seconds 1
        Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Clean dist-server
if (Test-Path "dist-server") {
    Write-Host "Removing dist-server folder..." -ForegroundColor Yellow
    Remove-Item -Path "dist-server" -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "✓ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Now you can run: npm run prepare:release" -ForegroundColor Cyan
