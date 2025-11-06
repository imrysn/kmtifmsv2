@echo off
echo Adding tag column to files table...
mysql -u root -p kmtifms < database\add-tag-column.sql
echo Done!
pause
