@echo off
title XTASK - Reset Database
color 0E

echo.
echo  ============================================
echo   XTASK - Reset Database
echo  ============================================
echo.
echo  This will delete all data and recreate the
echo  database with sample data.
echo.

set /p confirm="Are you sure? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo  Cancelled.
    pause
    exit /b 0
)

echo.
echo  [INFO] Resetting database...

cd backend

echo  [INFO] Running setup...
call npm run setup
if %ERRORLEVEL% neq 0 (
    color 0C
    echo  [ERROR] Failed to setup database
    cd ..
    pause
    exit /b 1
)

echo  [INFO] Seeding data...
call npm run seed
if %ERRORLEVEL% neq 0 (
    color 0C
    echo  [ERROR] Failed to seed database
    cd ..
    pause
    exit /b 1
)

cd ..

color 0A
echo.
echo  [OK] Database reset complete!
echo.
pause
