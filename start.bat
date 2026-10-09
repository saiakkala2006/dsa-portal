@echo off
title Starting DSA Exam Portal
echo ========================================================
echo        STARTING DSA EXAM PORTAL SERVICES
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Ensuring Docker services (Judge0 & Redis) are running...
where docker >nul 2>nul
if %errorlevel% equ 0 (
    docker compose up -d
) else (
    if exist "C:\Program Files\Docker\Docker\resources\bin\docker.exe" (
        "C:\Program Files\Docker\Docker\resources\bin\docker.exe" compose up -d
    ) else (
        echo [WARNING] Docker not found in PATH or standard location. Please ensure Docker Desktop is open.
    )
)

echo.
echo [2/3] Launching Backend Server on port 4000...
start "DSA Portal - Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo.
echo [3/3] Launching Frontend Server on port 3000...
start "DSA Portal - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ========================================================
echo All services launched!
echo.
echo Frontend: http://localhost:3000
echo Admin Portal: http://localhost:3000/admin/login
echo Student Portal: http://localhost:3000/student/login
echo ========================================================
pause
