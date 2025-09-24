@echo off
cd /d D:\ai-shorts-studio\AI-Shorts-Studio
echo ========================================
echo NGROK SETUP
echo ========================================
echo.
echo Please get your authtoken from:
echo https://dashboard.ngrok.com/get-started/your-authtoken
echo.
set /p token="Enter your ngrok authtoken: "
echo.
echo Setting up ngrok with your token...
ngrok.exe config add-authtoken %token%
echo.
echo Starting ngrok tunnel on port 5900...
echo.
echo ========================================
echo After ngrok starts, look for the line:
echo Forwarding  https://xxxx.ngrok-free.app
echo Copy that URL and use it in the app
echo ========================================
echo.
ngrok.exe http 5900
pause