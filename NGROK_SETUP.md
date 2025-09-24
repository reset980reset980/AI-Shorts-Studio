# ngrok 설정 가이드

AI Shorts Studio에서 Shotstack API를 사용하여 비디오를 렌더링하려면, 로컬 파일을 외부에서 접근 가능하도록 만들어야 합니다. ngrok을 사용하면 방화벽 설정 없이 로컬 서버를 인터넷에 공개할 수 있습니다.

## 1. ngrok 설치

### Windows
1. [ngrok.com](https://ngrok.com/download) 에서 Windows 버전 다운로드
2. ZIP 파일 압축 해제
3. ngrok.exe를 프로젝트 폴더나 PATH가 설정된 폴더에 복사

### 계정 가입 (선택사항이지만 권장)
1. [ngrok.com](https://ngrok.com) 에서 무료 계정 가입
2. Dashboard에서 Auth Token 확인
3. 터미널에서 토큰 설정:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

## 2. 파일 서버 실행

먼저 로컬 파일 서버를 실행합니다:

```bash
# AI-Shorts-Studio 프로젝트 폴더에서
node file-server.js
```

서버가 포트 5900에서 실행되는 것을 확인:
```
📁 File server running at http://localhost:5900
```

## 3. ngrok 터널 생성

새 터미널 창을 열고 ngrok을 실행:

```bash
ngrok http 5900
```

성공적으로 실행되면 다음과 같은 출력이 표시됩니다:

```
Session Status                online
Account                       YOUR_EMAIL (Plan: Free)
Version                       3.5.0
Region                        Asia Pacific (ap)
Latency                       32ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123def456.ngrok-free.app -> http://localhost:5900

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

## 4. AI Shorts Studio 설정

1. AI Shorts Studio 앱을 실행
2. "내정보" 탭으로 이동
3. "파일 서버 URL (Shotstack용)" 필드에 ngrok URL 입력:
   - 위 예시에서: `https://abc123def456.ngrok-free.app`
   - **주의**: https:// 포함하여 전체 URL을 입력하세요
4. "Google/Shotstack/IP 설정 저장" 버튼 클릭

## 5. 테스트

1. 스크립트 생성 및 미디어 생성 완료
2. "영상 렌더링" 버튼 클릭
3. 로그에서 URL 확인:
   ```
   [씬 1] 이미지 URL: https://abc123def456.ngrok-free.app/data/images/...
   [씬 1] 오디오 URL: https://abc123def456.ngrok-free.app/data/audio/...
   ```

## 문제 해결

### ngrok 터널이 끊어지는 경우
- 무료 계정은 8시간 제한이 있음
- 터널이 끊어지면 ngrok을 다시 실행하고 새 URL을 설정에 업데이트

### 파일에 접근할 수 없는 경우
1. 파일 서버가 실행 중인지 확인 (`node file-server.js`)
2. ngrok이 올바른 포트(5900)로 터널링하는지 확인
3. 브라우저에서 직접 URL 테스트:
   ```
   https://YOUR_NGROK_URL.ngrok-free.app/data/test.txt
   ```

### Shotstack API 오류
- 413 Request Too Long: 파일 서버 URL이 올바르게 설정되지 않음
- 404 Not Found: 파일 경로가 잘못되었거나 파일이 없음
- Connection refused: 파일 서버가 실행되지 않음

## 보안 주의사항

⚠️ ngrok URL은 인터넷에 공개되므로 주의하세요:
- 민감한 정보가 포함된 파일은 저장하지 마세요
- 사용하지 않을 때는 ngrok과 파일 서버를 중지하세요
- 무료 계정의 경우 URL이 계속 변경되므로 영구적인 용도로는 부적합합니다

## 대안: 로컬 네트워크 사용

방화벽 설정이 가능한 경우, ngrok 대신 로컬 IP를 사용할 수 있습니다:

1. 명령 프롬프트에서 IP 확인:
   ```bash
   ipconfig
   ```
2. IPv4 주소 확인 (예: 192.168.1.100)
3. 설정에 입력: `http://192.168.1.100:5900`
4. Windows 방화벽에서 포트 5900 허용

단, 이 방법은 Shotstack 서버가 로컬 네트워크에 접근할 수 없으므로 일반적으로 작동하지 않습니다. ngrok이나 공용 클라우드 서비스 사용을 권장합니다.