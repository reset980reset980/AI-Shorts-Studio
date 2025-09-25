@echo off
chcp 65001 >nul
echo ========================================
echo AI Shorts Studio 개발 모드 실행
echo ========================================
echo.

cd /d D:\ai-shorts-studio\AI-Shorts-Studio

echo [1/2] Vite 개발 서버 시작...
start "Vite Dev Server" cmd /c "npm run dev"

echo 개발 서버 시작 대기 중...
timeout /t 5 >nul

echo.
echo [2/2] Electron 실행...
start "AI Shorts Studio" electron.exe .

echo.
echo ========================================
echo 실행 완료!
echo.
echo 개발 서버: http://localhost:5173 (또는 5174)
echo.
echo Electron 창이 보이지 않으면:
echo 1. 작업 표시줄 확인
echo 2. Alt+Tab으로 창 전환
echo ========================================
echo.
pause