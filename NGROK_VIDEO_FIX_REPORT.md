# 영상 렌더링 ngrok 통합 수정 보고서

## ✅ 수정 완료 사항

### 1. Shotstack API 엔드포인트 분리
- **문제**: ngrok URL을 Shotstack API 엔드포인트로 잘못 사용
- **해결**: 파일 서버 URL과 Shotstack API URL 분리
- **파일**: `services/api.ts`
- **변경 내용**:
  ```typescript
  // 이전 (잘못됨)
  fetch(`${settings.shotstackUrl}/render`)  // ngrok URL을 API로 사용

  // 수정 후 (올바름)
  const SHOTSTACK_API_URL = 'https://api.shotstack.io/stage';
  fetch(`${SHOTSTACK_API_URL}/render`)  // 실제 Shotstack API 사용
  ```

### 2. ngrok URL 자동 프로토콜 추가
- **문제**: ngrok URL에 https:// 프로토콜이 없음
- **해결**: ngrok-free.app 도메인 자동 감지 및 https:// 추가
- **변경 내용**:
  ```typescript
  if (baseUrl.includes('ngrok-free.app') || baseUrl.includes('ngrok.io')) {
      baseUrl = `https://${baseUrl}`;
  }
  ```

### 3. 응답 파싱 에러 처리 개선
- **문제**: JSON 파싱 실패 시 원인 파악 어려움
- **해결**: 상세한 로깅 및 에러 메시지 추가
- **변경 내용**:
  ```typescript
  const responseText = await response.text();
  console.log('Shotstack response:', responseText);
  try {
      data = JSON.parse(responseText);
  } catch (e) {
      throw new Error(`Shotstack API 응답 파싱 실패: ${responseText}`);
  }
  ```

### 4. 파일 경로 변환 로깅
- **문제**: 파일 경로가 올바르게 변환되는지 확인 불가
- **해결**: 변환 과정 로깅 추가
- **변경 내용**:
  ```typescript
  console.log(`Converted path: ${filePath} -> ${finalUrl}`);
  console.log(`[씬 ${scene.id}] 이미지 URL: ${imageHttpUrl}`);
  console.log(`[씬 ${scene.id}] 오디오 URL: ${audioHttpUrl}`);
  ```

## 📋 현재 상태

### 작동 중인 서비스
1. **개발 서버**: http://localhost:5173 ✅
2. **파일 서버**: http://localhost:5900 ✅
3. **Electron 앱**: 실행 중 ✅

### ngrok 설정
- **URL**: `jolly-obliging-llama.ngrok-free.app`
- **상태**: 사용자가 직접 실행 필요
- **명령어**: `ngrok http 5900`

## 🔧 사용자가 해야 할 작업

### 1. ngrok 실행
```bash
# Windows 명령 프롬프트 또는 PowerShell에서:
cd D:\ai-shorts-studio\AI-Shorts-Studio
ngrok http 5900
```

### 2. ngrok URL 확인
- ngrok 실행 후 표시되는 URL 확인 (예: https://xxxx.ngrok-free.app)
- 또는 http://localhost:4040 에서 확인

### 3. 앱에서 설정
1. **내정보** 탭 열기
2. **파일 서버 URL** 필드에 ngrok URL 입력
   - 예: `https://jolly-obliging-llama.ngrok-free.app`
   - https:// 없이 입력해도 자동 추가됨
3. **저장** 버튼 클릭

### 4. 영상 생성 테스트
1. **영상편집** 탭에서 프로젝트 선택
2. 이미지 생성 → 음성 생성 → 영상 합성 순서로 진행
3. 콘솔 로그 확인:
   - 파일 경로 → HTTP URL 변환 로그
   - Shotstack API 응답 로그

## 🐛 문제 발생 시 확인사항

### 1. "Unexpected end of JSON input" 에러
- **원인**: Shotstack API 응답이 비어있거나 잘못됨
- **확인**:
  - Shotstack API 키가 올바른지
  - ngrok URL이 실제로 작동하는지
  - 브라우저에서 ngrok URL 접속 테스트

### 2. "Base64 데이터는 지원하지 않습니다" 에러
- **원인**: 파일이 로컬에 저장되지 않음
- **확인**: `data/images/`, `data/audio/` 폴더에 파일 존재 여부

### 3. ngrok 접속 불가
- **원인**: ngrok이 실행되지 않았거나 포트가 다름
- **확인**:
  - ngrok이 포트 5900으로 실행 중인지
  - 파일 서버가 포트 5900에서 실행 중인지

## 📝 테스트 방법

### 자동 테스트
```bash
npm test tests/video-render-test.spec.ts
```

### 수동 테스트
1. 브라우저에서 ngrok URL 접속: `https://your-ngrok-url.ngrok-free.app`
2. 파일 접근 테스트: `https://your-ngrok-url.ngrok-free.app/data/images/[scriptId]/scene_1.jpg`

## 🚀 다음 단계

1. **ngrok 자동 실행**: package.json에 스크립트 추가 고려
2. **에러 복구**: Shotstack API 실패 시 재시도 로직
3. **진행 상태 표시**: 렌더링 진행률 UI 개선
4. **캐싱 개선**: ngrok URL 변경 감지 및 자동 업데이트

---

**작성일**: 2025-09-24
**마지막 수정**: services/api.ts - Shotstack API 엔드포인트 분리 및 ngrok URL 처리 개선