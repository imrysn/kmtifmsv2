@echo off
REM Run these SQL commands to fix the database issues
echo 🔧 Fixing KMTI File Management System Database Issues...

echo.
echo Fix 1: Adding missing 'comment' column to assignment_submissions...
mysql -u root -p kmtifms -e "ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT NULL AFTER submitted_at;"
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to add comment column
    pause
    exit /b 1
)
echo ✅ Comment column added

echo.
echo Fix 2: Fixing foreign key constraints...
mysql -u root -p kmtifms -e "ALTER TABLE assignment_members DROP FOREIGN KEY IF EXISTS assignment_members_ibfk_2;"
mysql -u root -p kmtifms -e "ALTER TABLE assignment_members ADD CONSTRAINT assignment_members_ibfk_2 FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL ON UPDATE CASCADE;"
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to fix foreign key
    pause
    exit /b 1
)
echo ✅ Foreign key constraint fixed

echo.
echo Fix 3: Cleaning up orphaned file references...
mysql -u root -p kmtifms -e "UPDATE assignment_members SET file_id = NULL WHERE file_id IS NOT NULL AND file_id NOT IN (SELECT id FROM files);"
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to clean orphaned references
    pause
    exit /b 1
)
echo ✅ Orphaned references cleaned

echo.
echo Fix 4: Verifying database schema...
mysql -u root -p kmtifms -e "SHOW CREATE TABLE assignment_members\G"
mysql -u root -p kmtifms -e "DESCRIBE assignment_submissions;"

echo.
echo ✅ All database fixes applied successfully!
echo ℹ️ Please restart your backend server for changes to take effect.
echo.
pause
