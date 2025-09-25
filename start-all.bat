@echo off
chcp 65001 >nul
echo ========================================
echo AI Shorts Studio - Cloudflare Tunnel 실행
echo ========================================
echo.

cd /d D:\ai-shorts-studio\AI-Shorts-Studio

echo [1/3] 파일 서버 시작 중...
start "File Server" cmd /c "node file-server.js"
timeout /t 3 >nul

echo [2/3] Cloudflare Tunnel 시작 중...
echo.
echo ========================================
echo 아래 창에서 표시되는 URL을 확인하세요:
echo.
echo 예시: https://xxxxx-xxxxx.trycloudflare.com
echo.
echo 이 URL을 복사하여 앱의 '내정보' 탭에서
echo '파일 서버 URL' 필드에 입력하세요
echo ========================================
echo.

start "Cloudflare Tunnel" cmd /k "cloudflared.exe tunnel --url http://localhost:5900"
timeout /t 5 >nul

echo [3/3] Electron 앱 시작 중...
start "AI Shorts Studio" cmd /c "npm run electron-dev"

echo.
echo ========================================
echo 실행 완료!
echo.
echo 1. Cloudflare Tunnel 창에서 URL 확인
echo 2. 앱의 '내정보' 탭에서 URL 입력
echo 3. '영상편집' 탭에서 영상 합성 테스트
echo ========================================
echo.
pause