@echo off
chcp 65001 >nul
echo ========================================
echo Cloudflare Tunnel 실행 중...
echo ========================================
echo.
echo 아래에 표시되는 URL을 찾으세요:
echo https://xxxxx-xxxxx.trycloudflare.com
echo ========================================
echo.

cd /d D:\ai-shorts-studio\AI-Shorts-Studio

REM Cloudflare 실행하고 출력 저장
cloudflared.exe tunnel --url http://localhost:5900 2>&1 | tee cloudflare_log.txt

pause