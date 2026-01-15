@echo off
title XTASK - NXSYS Task Management System
color 0A

echo.
echo  ============================================
echo   XTASK - NXSYS Task Management System
echo  ============================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    color 0C
    echo  [ERROR] Node.js is not installed or not in PATH
    echo  Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Show Node version
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo  [OK] Node.js %NODE_VERSION% detected
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo  [INFO] Installing root dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo  [ERROR] Failed to install root dependencies
        pause
        exit /b 1
    )
)

if not exist "backend\node_modules" (
    echo  [INFO] Installing backend dependencies...
    cd backend
    call npm install
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo  [ERROR] Failed to install backend dependencies
        cd ..
        pause
        exit /b 1
    )
    cd ..
)

if not exist "frontend\node_modules" (
    echo  [INFO] Installing frontend dependencies...
    cd frontend
    call npm install
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo  [ERROR] Failed to install frontend dependencies
        cd ..
        pause
        exit /b 1
    )
    cd ..
)

echo  [OK] All dependencies installed
echo.

:: Check if database exists
if not exist "backend\database\xtask.db" (
    echo  [INFO] Setting up database...
    cd backend
    call npm run setup
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo  [ERROR] Failed to setup database
        cd ..
        pause
        exit /b 1
    )

    echo  [INFO] Seeding sample data...
    call npm run seed
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo  [ERROR] Failed to seed database
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo  [OK] Database ready
    echo.
)

echo  ============================================
echo   Starting Application...
echo  ============================================
echo.
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:3001
echo.
echo   Test Accounts (password: password123):
echo   - ceo@nxsys.com (Level 1)
echo   - manager1@nxsys.com (Level 2)
echo   - dev1@nxsys.com (Level 3)
echo.
echo   Press Ctrl+C to stop the servers
echo  ============================================
echo.

:: Start the application
call npm run dev

pause
