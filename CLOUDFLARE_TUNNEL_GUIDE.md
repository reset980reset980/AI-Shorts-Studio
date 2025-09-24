# Cloudflare Tunnel 설정 가이드

## 개요
ngrok 대신 Cloudflare Tunnel을 사용하여 Shotstack이 로컬 파일에 접근할 수 있도록 설정하는 방법입니다.

## 장점
- ✅ **무료** (Cloudflare 계정만 있으면 됨)
- ✅ **고정 도메인** 가능
- ✅ **빠른 속도** (Cloudflare CDN 활용)
- ✅ **안정적** (ngrok보다 끊김 없음)

## 설치 방법

### 1. cloudflared 다운로드

#### Windows (PowerShell 관리자 권한)
```powershell
# 다운로드
Invoke-WebRequest -Uri https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -OutFile cloudflared.exe

# 또는 winget 사용
winget install Cloudflare.cloudflared
```

#### 직접 다운로드
https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe

### 2. Cloudflare 계정 로그인
```powershell
.\cloudflared.exe tunnel login
```
- 브라우저가 열리면 Cloudflare 계정으로 로그인
- 도메인 선택 (없으면 무료 도메인 사용 가능)

### 3. 터널 생성
```powershell
# 터널 생성 (한 번만 실행)
.\cloudflared.exe tunnel create ai-shorts-studio

# 생성된 터널 확인
.\cloudflared.exe tunnel list
```

### 4. 설정 파일 생성

`config.yml` 파일 생성:
```yaml
tunnel: ai-shorts-studio
credentials-file: C:\Users\%USERNAME%\.cloudflared\[TUNNEL_ID].json

ingress:
  - hostname: ai-shorts.example.com  # 원하는 서브도메인
    service: http://localhost:5900
  - service: http_status:404
```

### 5. DNS 설정 (Cloudflare 대시보드)
1. https://dash.cloudflare.com 접속
2. 도메인 선택 → DNS
3. CNAME 레코드 추가:
   - Name: `ai-shorts` (서브도메인)
   - Target: `[TUNNEL_ID].cfargotunnel.com`

## 실행 방법

### 방법 1: 직접 실행
```powershell
# 설정 파일 사용
.\cloudflared.exe tunnel run ai-shorts-studio

# 또는 간단히 (임시 URL)
.\cloudflared.exe tunnel --url http://localhost:5900
```

### 방법 2: 배치 파일 사용

`start-cloudflare.bat` 생성:
```batch
@echo off
cd /d D:\ai-shorts-studio\AI-Shorts-Studio
echo Starting Cloudflare Tunnel...
cloudflared.exe tunnel --url http://localhost:5900
pause
```

### 방법 3: Windows 서비스로 설치 (영구 실행)
```powershell
# 서비스 설치
.\cloudflared.exe service install

# 서비스 시작
sc start cloudflared
```

## 앱 설정

1. **파일 서버 시작**
   ```powershell
   cd D:\ai-shorts-studio\AI-Shorts-Studio
   node file-server.js
   ```

2. **Cloudflare Tunnel 시작**
   ```powershell
   .\cloudflared.exe tunnel --url http://localhost:5900
   ```

3. **생성된 URL 확인**
   - 콘솔에 표시되는 URL 복사
   - 예: `https://xxxxx-xxxxx-xxxxx.trycloudflare.com`

4. **앱에서 설정**
   - 내정보 탭 → 파일 서버 URL 입력
   - 저장

## 무료 Quick Tunnel (가장 간단)

계정 설정 없이 임시로 사용:
```powershell
# 다운로드 후 바로 실행
.\cloudflared.exe tunnel --url http://localhost:5900
```
- 즉시 사용 가능한 URL 생성
- 단점: 재시작 시 URL 변경됨

## Troubleshooting

### 포트 충돌
```powershell
# 5900 포트 사용 중인 프로세스 확인
netstat -ano | findstr :5900

# 프로세스 종료
taskkill /F /PID [프로세스ID]
```

### 방화벽 문제
- Windows Defender 방화벽에서 cloudflared.exe 허용
- 바이러스 백신 예외 추가

### 연결 테스트
```powershell
# 로컬 테스트
curl http://localhost:5900/data/images/1758675938779/scene_1.jpg

# Cloudflare URL 테스트
curl https://your-tunnel-url.trycloudflare.com/data/images/1758675938779/scene_1.jpg
```

## 자동화 스크립트

`auto-start.ps1`:
```powershell
# PowerShell 스크립트
Start-Process -FilePath "node" -ArgumentList "file-server.js" -WorkingDirectory "D:\ai-shorts-studio\AI-Shorts-Studio"
Start-Sleep -Seconds 2
Start-Process -FilePath ".\cloudflared.exe" -ArgumentList "tunnel --url http://localhost:5900"
```

## 대안: Cloudflare Workers (파일 업로드)

파일을 Cloudflare Workers KV에 업로드하는 방식도 가능:
- Workers 무료 티어: 일 10만 요청
- KV 무료 티어: 1GB 저장 공간

---

**작성일**: 2025-09-24
**참고**: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/