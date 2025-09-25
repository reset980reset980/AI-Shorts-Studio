@echo off
chcp 65001 >nul
echo ========================================
echo Cloudflare Quick Tunnel 설정
echo ========================================
echo.

cd /d D:\ai-shorts-studio\AI-Shorts-Studio

echo [1단계] cloudflared.exe 다운로드 중...
if not exist cloudflared.exe (
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
    echo cloudflared.exe 다운로드 완료!
) else (
    echo cloudflared.exe가 이미 존재합니다.
)

echo.
echo [2단계] 파일 서버 시작...
start /B node file-server.js
timeout /t 2 >nul

echo.
echo [3단계] Cloudflare Tunnel 시작...
echo.
echo ========================================
echo 아래에 표시되는 URL을 복사하세요:
echo https://xxxxx.trycloudflare.com
echo ========================================
echo.

cloudflared.exe tunnel --url http://localhost:5900

pause