@echo off
echo Fetching your ngrok public URL...
echo.
powershell -Command "$response = Invoke-RestMethod 'http://127.0.0.1:4040/api/tunnels'; $url = $response.tunnels[0].public_url; Write-Host 'Your app is live at:' -ForegroundColor Green; Write-Host $url -ForegroundColor White -BackgroundColor DarkGreen; Set-Clipboard -Value $url; Write-Host ''; Write-Host 'URL copied to clipboard!' -ForegroundColor Yellow"
echo.
pause
