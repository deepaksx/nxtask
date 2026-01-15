@echo off
title NX TASK - NXSYS Task Management System
color 0A

echo.
echo  ============================================
echo   NX TASK - NXSYS Task Management System
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

:: Check if backend .env exists
if not exist "backend\.env" (
    color 0E
    echo  [WARNING] backend\.env file not found!
    echo.
    echo  Please create backend\.env with your PostgreSQL connection:
    echo.
    echo    DATABASE_URL=postgresql://user:password@localhost:5432/nxtask
    echo    JWT_SECRET=your-secret-key
    echo    PORT=3001
    echo.
    echo  You can copy from .env.example:
    echo    copy .env.example backend\.env
    echo.
    pause
    exit /b 1
)

echo  [OK] Environment file found
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

echo  ============================================
echo   Starting Application...
echo  ============================================
echo.
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:3001
echo.
echo   Test Accounts (password: password123):
echo   - ceo@nxsys.com (Level 1 - All categories)
echo   - manager1@nxsys.com (Level 2 - Projects, Pre-Sales)
echo   - manager2@nxsys.com (Level 2 - Admin, Miscellaneous)
echo   - dev1@nxsys.com (Level 3 - Projects, Admin)
echo   - dev2@nxsys.com (Level 3 - Projects, Pre-Sales, Misc)
echo.
echo   First time? Run reset-db.bat to setup database
echo.
echo   Press Ctrl+C to stop the servers
echo  ============================================
echo.

:: Start the application
call npm run dev

pause
