@echo off
chcp 65001 >nul
echo ========================================
echo 로컬 네트워크 IP 확인
echo ========================================
echo.

for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /c:"IPv4 Address" ^| findstr /v "127.0.0.1"') do (
    for /f "tokens=1" %%j in ("%%i") do (
        echo 로컬 IP: %%j
        echo.
        echo 내정보 탭에 입력할 주소:
        echo http://%%j:5900
        echo.
        echo 참고: 같은 네트워크(공유기)에서만 작동합니다
    )
)

echo.
pause