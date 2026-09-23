@echo off
echo Starting NHLsnipes...
echo.

REM Start API Server
start "NHLsnipes API" powershell -NoExit -Command "cd '%~dp0'; Write-Host '=== API SERVER ===' -ForegroundColor Yellow; pnpm --filter @workspace/api-server run dev"
timeout /t 3 /nobreak >nul

REM Start Frontend
start "NHLsnipes Frontend" powershell -NoExit -Command "cd '%~dp0'; Write-Host '=== FRONTEND ===' -ForegroundColor Yellow; pnpm --filter @workspace/nhlsnipes run dev"
timeout /t 5 /nobreak >nul

REM Start Ngrok
start "NHLsnipes Ngrok" powershell -NoExit -Command "cd '%~dp0'; Write-Host '=== NGROK TUNNEL ===' -ForegroundColor Yellow; C:\Users\jcsqu\ngrok\ngrok.exe http 23191"

echo.
echo All services started!
echo Check the 3 windows that opened.
echo.
pause
