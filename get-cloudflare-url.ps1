# Cloudflare Tunnel URL 자동 가져오기
$process = Start-Process -FilePath "cloudflared.exe" `
    -ArgumentList "tunnel", "--url", "http://localhost:5900" `
    -RedirectStandardError "cloudflared_output.txt" `
    -PassThru `
    -NoNewWindow

# 출력 파일 대기
Start-Sleep -Seconds 5

# URL 찾기
$content = Get-Content "cloudflared_output.txt" -Raw
$pattern = 'https://[a-zA-Z0-9-]+\.trycloudflare\.com'
$matches = [regex]::Matches($content, $pattern)

if ($matches.Count -gt 0) {
    $url = $matches[0].Value
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Cloudflare Tunnel URL 발견!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "URL: $url" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "이 URL을 복사하여 앱의 '내정보' 탭에서" -ForegroundColor White
    Write-Host "'파일 서버 URL' 필드에 입력하세요" -ForegroundColor White
    Write-Host "========================================" -ForegroundColor Cyan

    # URL을 파일로 저장
    $url | Out-File -FilePath "cloudflare_url.txt" -Encoding UTF8

    # 클립보드에 복사 (선택사항)
    $url | Set-Clipboard
    Write-Host ""
    Write-Host "✅ URL이 클립보드에 복사되었습니다!" -ForegroundColor Green
} else {
    Write-Host "URL을 찾을 수 없습니다. cloudflared_output.txt 파일을 확인하세요." -ForegroundColor Red
}

Write-Host ""
Write-Host "Cloudflare Tunnel이 실행 중입니다. 종료하려면 Ctrl+C를 누르세요." -ForegroundColor Gray

# 프로세스 대기
$process.WaitForExit()