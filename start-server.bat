@echo off
echo Starting Restaurant Website Server...
echo.
echo Server will be available at:
echo   Main Page: http://localhost:8000/index.html
echo   Admin Panel: http://localhost:8000/admin.html
echo.
echo Press Ctrl+C to stop the server
echo.
npx --yes http-server -p 8000

