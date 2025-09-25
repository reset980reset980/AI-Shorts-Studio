# AI Shorts Studio - Cloudflare Tunnel 실행 스크립트
# PowerShell 버전 (한글 지원 완벽)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AI Shorts Studio - Cloudflare Tunnel 실행" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 작업 디렉토리 설정
Set-Location "D:\ai-shorts-studio\AI-Shorts-Studio"

# 1. 파일 서버 시작
Write-Host "[1/3] 파일 서버 시작 중..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/c", "node file-server.js" -WindowStyle Normal
Start-Sleep -Seconds 3

# 2. Cloudflare Tunnel 시작
Write-Host "[2/3] Cloudflare Tunnel 시작 중..." -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "아래 창에서 표시되는 URL을 확인하세요:" -ForegroundColor Yellow
Write-Host ""
Write-Host "예시: https://xxxxx-xxxxx.trycloudflare.com" -ForegroundColor White
Write-Host ""
Write-Host "이 URL을 복사하여 앱의 '내정보' 탭에서" -ForegroundColor Yellow
Write-Host "'파일 서버 URL' 필드에 입력하세요" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Start-Process cmd -ArgumentList "/k", "cloudflared.exe tunnel --url http://localhost:5900" -WindowStyle Normal
Start-Sleep -Seconds 5

# 3. Electron 앱 시작
Write-Host "[3/3] Electron 앱 시작 중..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/c", "npm run electron-dev" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "실행 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "1. Cloudflare Tunnel 창에서 URL 확인" -ForegroundColor Yellow
Write-Host "2. 앱의 '내정보' 탭에서 URL 입력" -ForegroundColor Yellow
Write-Host "3. '영상편집' 탭에서 영상 합성 테스트" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")