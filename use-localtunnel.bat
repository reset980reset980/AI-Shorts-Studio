@echo off
chcp 65001 >nul
echo ========================================
echo Localtunnel 설정 (Cloudflare 대체)
echo ========================================
echo.

cd /d D:\ai-shorts-studio\AI-Shorts-Studio

echo [1] Localtunnel 설치 중...
call npm install -g localtunnel 2>nul

echo.
echo [2] Tunnel 시작 중...
echo.
echo ========================================
echo 아래에 표시되는 URL을 복사하세요
echo ========================================
echo.

npx localtunnel --port 5900 --print-requests

pause