@echo off
echo Building API first...
call pnpm --filter @workspace/api-server run build

echo.
echo Starting everything with PM2...
pm2 start pm2.config.js

echo.
echo Saving PM2 config...
pm2 save

echo.
echo Setting up auto-start...
pm2 startup

echo.
echo Done! Your app is running in the background.
echo.
echo Commands:
echo   pm2 list        - See all apps
echo   pm2 logs        - See logs
echo   pm2 stop all    - Stop everything
echo   pm2 restart all - Restart everything
echo.
pause
