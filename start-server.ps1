Write-Host "Starting Restaurant Website Server..." -ForegroundColor Green
Write-Host ""
Write-Host "Server will be available at:" -ForegroundColor Cyan
Write-Host "  Main Page: http://localhost:8000/index.html" -ForegroundColor Yellow
Write-Host "  Admin Panel: http://localhost:8000/admin.html" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Red
Write-Host ""
npx --yes http-server -p 8000

