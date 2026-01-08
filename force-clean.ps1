# Force Kill and Clean Script
Write-Host "=== FORCE CLEANUP SCRIPT ===" -ForegroundColor Cyan
Write-Host ""

# 1. Kill ALL electron and node processes
Write-Host "Step 1: Killing all Electron and Node processes..." -ForegroundColor Yellow
Get-Process | Where-Object {
    $_.ProcessName -like "*electron*" -or 
    $_.ProcessName -like "*KMTI*" -or
    $_.ProcessName -like "*node*"
} | ForEach-Object {
    Write-Host "  Killing: $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor Red
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "  Waiting for processes to terminate..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 2. Force unlock using handle.exe if available, otherwise just delete
Write-Host ""
Write-Host "Step 2: Attempting to unlock files..." -ForegroundColor Yellow

$lockedFile = "dist\win-unpacked\resources\app.asar"
if (Test-Path $lockedFile) {
    Write-Host "  Found locked file: $lockedFile" -ForegroundColor Red
    
    # Try to take ownership and force delete
    Write-Host "  Taking ownership..." -ForegroundColor Yellow
    takeown /F "$lockedFile" /A 2>$null | Out-Null
    icacls "$lockedFile" /grant administrators:F 2>$null | Out-Null
    
    # Try to delete
    Remove-Item -Path "$lockedFile" -Force -ErrorAction SilentlyContinue
    
    if (Test-Path $lockedFile) {
        Write-Host "  WARNING: File still exists, will delete entire dist folder" -ForegroundColor Red
    }
}

# 3. Delete dist folders (nuclear option)
Write-Host ""
Write-Host "Step 3: Deleting build folders..." -ForegroundColor Yellow

$foldersToDelete = @("dist", "dist-server")

foreach ($folder in $foldersToDelete) {
    if (Test-Path $folder) {
        Write-Host "  Removing $folder..." -ForegroundColor Yellow
        
        # First attempt: normal delete
        Remove-Item -Path $folder -Recurse -Force -ErrorAction SilentlyContinue
        
        # Wait a bit
        Start-Sleep -Seconds 1
        
        # Second attempt: take ownership first
        if (Test-Path $folder) {
            Write-Host "    Taking ownership of $folder..." -ForegroundColor Yellow
            takeown /F "$folder" /R /A /D Y 2>$null | Out-Null
            icacls "$folder" /grant administrators:F /T 2>$null | Out-Null
            Remove-Item -Path $folder -Recurse -Force -ErrorAction SilentlyContinue
        }
        
        # Check if it's gone
        if (Test-Path $folder) {
            Write-Host "    ERROR: Could not delete $folder" -ForegroundColor Red
            Write-Host "    You may need to restart your computer" -ForegroundColor Red
        } else {
            Write-Host "    ✓ $folder removed" -ForegroundColor Green
        }
    } else {
        Write-Host "    $folder doesn't exist (ok)" -ForegroundColor Gray
    }
}

# 4. Verify cleanup
Write-Host ""
Write-Host "Step 4: Verification..." -ForegroundColor Yellow

$remaining = Get-ChildItem -Directory | Where-Object {$_.Name -like "dist*"}
if ($remaining) {
    Write-Host "  WARNING: Some dist folders still exist:" -ForegroundColor Red
    $remaining | ForEach-Object { Write-Host "    - $($_.Name)" -ForegroundColor Red }
    Write-Host ""
    Write-Host "  SOLUTION: Restart your computer, then run this script again" -ForegroundColor Yellow
} else {
    Write-Host "  ✓ All dist folders removed" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== CLEANUP COMPLETE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. If you see warnings above, restart your computer" -ForegroundColor White
Write-Host "  2. Run: npm run prepare:release" -ForegroundColor White
Write-Host ""
