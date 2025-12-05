@echo off
REM Build script for Zoom For Education v1 Moodle Plugin (Windows)
REM This script builds the React frontend and prepares it for deployment

echo.
echo Building Zoom For Education Frontend...
echo.

REM Check if frontend directory exists
if not exist "frontend" (
    echo Error: frontend directory not found
    exit /b 1
)

REM Navigate to frontend directory
cd frontend

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

REM Build the application
echo Building React application...
call npm run build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Build completed successfully!
    echo.
    echo Output directory: zoomforeducationv1\ui\
    echo.
    echo Next steps:
    echo   1. Review the changes in zoomforeducationv1\ui\
    echo   2. Test the application in your Moodle instance
    echo   3. Commit the changes: git add zoomforeducationv1\ui\ ^&^& git commit -m "Update frontend build"
    echo.
) else (
    echo.
    echo Build failed!
    exit /b 1
)

cd ..

