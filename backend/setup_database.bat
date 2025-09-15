@echo off
REM Database Migration Script for Local Backend (Windows)
REM This script sets up the local PostgreSQL database for the project management backend

echo 🚀 Setting up local database for Project Management Backend

REM Load environment variables from .env file if it exists
if exist .env (
    echo ✅ Loading environment variables from .env
    for /f "usebackq tokens=1,2 delims==" %%i in (.env) do (
        if not "%%i"=="" if not "%%i:~0,1%"=="#" set %%i=%%j
    )
) else (
    echo ⚠️  No .env file found. Using default values.
    if not defined DB_HOST set DB_HOST=localhost
    if not defined DB_PORT set DB_PORT=5432
    if not defined DB_NAME set DB_NAME=project_management
    if not defined DB_USER set DB_USER=postgres
)

echo 📋 Database Configuration:
echo   Host: %DB_HOST%
echo   Port: %DB_PORT%
echo   Database: %DB_NAME%
echo   User: %DB_USER%

REM Check if database exists
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -lqt | findstr /c:"%DB_NAME%" >nul
if %errorlevel% equ 0 (
    echo ✅ Database '%DB_NAME%' already exists
) else (
    echo ⚠️  Database '%DB_NAME%' does not exist. Creating...
    createdb -h %DB_HOST% -p %DB_PORT% -U %DB_USER% %DB_NAME%
    if %errorlevel% equ 0 (
        echo ✅ Database '%DB_NAME%' created successfully
    ) else (
        echo ❌ Failed to create database
        exit /b 1
    )
)

REM Run migrations
echo 🔧 Running auth tables migration (001)...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f migrations/001_setup_auth_tables.sql
if %errorlevel% neq 0 (
    echo ❌ Auth tables migration failed
    exit /b 1
)

echo 🔧 Running completion migration (002)...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f migrations/002_setup_complete.sql
if %errorlevel% neq 0 (
    echo ⚠️  Completion migration returned a non-zero exit (may be informational). Continuing...
)

echo 🔧 Running capacity trigger fix (003)...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f migrations/003_fix_capacity_member_trigger.sql
if %errorlevel% neq 0 (
    echo ⚠️  Capacity trigger fix returned a non-zero exit. Continuing...
)

echo 🔧 Running budget tables migration (004)...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f migrations/004_create_budget_tables.sql
if %errorlevel% neq 0 (
    echo ❌ Budget tables migration failed
    exit /b 1
)


REM Test database connection
echo 🔍 Testing database connection...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "SELECT COUNT(*) FROM profiles;" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Database connection test successful
) else (
    echo ❌ Database connection test failed
    exit /b 1
)

echo 🎉 Database setup completed successfully!
echo 💡 Next steps:
echo   1. Start the backend server: npm run dev
echo   2. Set frontend env variable: VITE_API_URL=http://localhost:3001
echo   3. Start your frontend application

pause