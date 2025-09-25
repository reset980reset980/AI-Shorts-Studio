@echo off
chcp 65001 >nul
echo ========================================
echo AI Shorts Studio Electron 실행
echo ========================================
echo.

cd /d D:\ai-shorts-studio\AI-Shorts-Studio

echo [1/2] 빌드된 파일로 Electron 실행 중...
echo.

start "AI Shorts Studio" electron.exe .

echo.
echo ========================================
echo Electron 앱이 실행되었습니다!
echo.
echo 만약 창이 보이지 않으면:
echo 1. 작업 표시줄 확인
echo 2. Alt+Tab으로 창 전환
echo 3. 작업 관리자에서 electron.exe 확인
echo ========================================
echo.
pause