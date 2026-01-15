@echo off
title NX TASK - Reset Database
color 0E

echo.
echo  ============================================
echo   NX TASK - Reset Database (PostgreSQL)
echo  ============================================
echo.
echo  This will DROP all tables and recreate them
echo  with sample data.
echo.

:: Check if backend .env exists
if not exist "backend\.env" (
    color 0C
    echo  [ERROR] backend\.env file not found!
    echo.
    echo  Please create backend\.env with your PostgreSQL connection:
    echo.
    echo    DATABASE_URL=postgresql://user:password@localhost:5432/nxtask
    echo    JWT_SECRET=your-secret-key
    echo    PORT=3001
    echo.
    pause
    exit /b 1
)

set /p confirm="Are you sure? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo  Cancelled.
    pause
    exit /b 0
)

echo.
echo  [INFO] Resetting database...

cd backend

echo  [INFO] Running setup (dropping and creating tables)...
call npm run setup
if %ERRORLEVEL% neq 0 (
    color 0C
    echo  [ERROR] Failed to setup database
    echo  Make sure PostgreSQL is running and DATABASE_URL is correct
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
echo  Test Accounts (password: password123):
echo   - ceo@nxsys.com (Level 1 - All categories)
echo   - manager1@nxsys.com (Level 2)
echo   - manager2@nxsys.com (Level 2)
echo   - dev1@nxsys.com (Level 3)
echo   - dev2@nxsys.com (Level 3)
echo.
pause
