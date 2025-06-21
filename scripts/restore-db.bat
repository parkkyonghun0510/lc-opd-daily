@echo off
setlocal

REM Extract the backup file using 7zip (assuming it's installed)
"C:\Program Files\7-Zip\7z.exe" e backups\dbdblc_opd_daily_20250620_082811.gz -obackups

REM Drop the existing database
psql -U postgres -c "DROP DATABASE IF EXISTS lc_opd_daily;"

REM Create a new database
psql -U postgres -c "CREATE DATABASE lc_opd_daily WITH OWNER postgres ENCODING 'UTF8';"

REM Restore the database
psql -U postgres -d lc_opd_daily -f backups\dbdblc_opd_daily_20250620_082811.sql

REM Run Prisma migrations
npx prisma migrate deploy

echo Database restoration completed!
pause