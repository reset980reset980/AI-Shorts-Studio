# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 따라야 할 가이드를 제공합니다.

---

## ⚠️ 법적/윤리적 제한사항

### LSTUBE 폴더 참조 제한
- **경로**: `./LSTUBE`
- **용도**: **아이디어/구조 참고만 가능**. **코드, 에셋, 프롬프트, 메타데이터의 직접 복사는 금지**.
- **금지사항**: 파일 내용, 주석, 프롬프트, 에셋, 타임라인 구조, 스타일 파라미터, 샷 템플릿
- **독립성**: 새로운 구현은 함수/컴포넌트/프롬프트 단위에서 **구조적 유사도 30% 미만** 유지
- **검증**: LSTUBE 콘텐츠가 의심되는 PR(문자열, 워터마크, 리소스명)은 차단됨
- **요청 시 응답**: "LSTUBE는 참조 전용이며 직접 사용하거나 복사할 수 없습니다. 새로운 구현을 제공하겠습니다."

---

## 프로젝트 개요

**AI Shorts Studio**는 텍스트 콘텐츠로 YouTube Shorts 비디오를 생성하는 Electron 기반 데스크톱 애플리케이션입니다.

### 기술 스택
- **프론트엔드**: React 19 + TypeScript + Vite
- **데스크톱**: Electron 28
- **UI**: Tailwind CSS (index.tsx에서 import)
- **상태 관리**: React hooks
- **데이터 저장**: 파일 시스템 (data 폴더) + localStorage 폴백
- **테스팅**: Playwright (E2E)

---

## 명령어

### 개발
```bash
npm ci                    # 의존성 깔끔하게 설치
npm run dev              # Vite 개발 서버 시작 (http://localhost:5173)
npm run electron         # Electron 앱 실행 (dist 폴더 필요)
npm run electron-dev     # 개발 서버와 함께 Electron 실행
```

### 빌드 및 프로덕션
```bash
npm run build            # 프로덕션 앱 빌드 (dist 폴더 생성)
npm run preview          # 프로덕션 빌드 미리보기
npm run dist            # Electron 설치 파일 빌드 (release 폴더 생성)
```

### 테스팅
```bash
npm test                 # Playwright 테스트 실행
npm run test:ui         # UI 모드로 테스트 실행
npm run test:headed     # 브라우저를 보면서 테스트 실행
npm run test:report     # 테스트 리포트 보기

# 특정 테스트 파일 실행
npx playwright test tests/fixed-workflow.spec.ts

# 디버그 모드로 실행
npx playwright test --debug
```

### 환경 설정
- **Node 버전**: v20.18.0 (`.nvmrc`에 정의됨)
- **패키지 매니저**: npm (`package-lock.json` 사용)

---

## 설정

### 환경 변수
필수 API 키 (`.env.local`에 설정):
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_MINIMAX_JWT_TOKEN=your_minimax_jwt_token_here
VITE_SHOTSTACK_API_KEY=your_shotstack_api_key_here
```

이 키들은 `env.ts`를 통해 import되며, 실제 키가 포함된 상태로 커밋되면 안 됩니다.

### 커밋하면 안 되는 파일
- `.env.local` 및 모든 `.env*` 파일
- `env.ts` (실제 API 키 포함)
- `data/` 폴더 내용 (사용자 생성 데이터)
- API 키, 토큰, 쿠키, 인증 정보

---

## 아키텍처

### 핵심 서비스 및 API
- **Google Gemini API**: 스크립트 생성, 텍스트 다듬기, 이미지 생성
- **MiniMax API v2**: 한국어 TTS (음성 변환) 생성
- **Shotstack API**: 비디오 렌더링 및 합성

### 데이터 저장 구조
```
data/
├── scripts/      # 스크립트 JSON 파일
├── images/       # 생성된 이미지 (프로젝트별 하위 폴더)
├── audio/        # 생성된 오디오 파일 (프로젝트별 하위 폴더)
├── videos/       # 비디오 URL 참조
└── projects/     # 프로젝트 메타데이터
```

파일은 Electron 앱의 파일 시스템 접근을 통해 로컬에 저장됩니다 (`services/fileStorage.ts`).

### 컴포넌트 구조
```
App.tsx                       # 탭 네비게이션이 있는 메인 앱
├── views/ScriptingTab.tsx    # 스크립트 입력 및 생성
├── views/ChannelsTab.tsx     # YouTube 채널 관리
├── views/EditTab.tsx         # 프로젝트 목록 관리
├── views/EditingTab.tsx      # 미디어 생성 및 렌더링
├── views/UploadTab.tsx       # YouTube 업로드 관리
└── views/SettingsTab.tsx     # 설정 관리
```

### 서비스 레이어
- `services/api.ts`: 재시도 로직과 에러 처리를 포함한 모든 외부 API 통합
- `services/fileStorage.ts`: Electron 앱의 파일 시스템 작업

---

## 주요 타입 (types.ts)

- **`Script`**: 제목, 장면, 상태, 렌더 정보를 포함한 메인 스크립트 객체
- **`Scene`**: 스크립트, 이미지 프롬프트, 오디오, 타이밍, 생성 상태를 포함한 개별 장면
- **`Settings`**: API 키, 프롬프트, YouTube 채널 설정을 포함한 애플리케이션 설정
- **`YouTubeChannel`**: YouTube 채널 정보
- **`LogEntry`**: 디버깅용 시스템 로그 항목

---

## API 통합 패턴

### 재시도 로직
`services/api.ts`의 `withRetry` 래퍼 처리:
- **재시도 가능 에러**: HTTP 429 (속도 제한) 및 499 (일시적) 에러
- **지수 백오프**: 썬더링 허드를 피하기 위한 지터 포함
- **최대 재시도**: 기본 3회 시도
- **스마트 지연**: 가능한 경우 API가 제안한 재시도 지연 사용

### 에러 처리
- 모든 API 호출은 try-catch와 적절한 에러 로깅으로 래핑됨
- UI에 사용자 친화적인 에러 메시지 표시
- 민감한 정보(토큰, API 키)는 로그에서 마스킹됨

---

## 테스팅

### 테스트 설정
- E2E 테스팅을 위해 Playwright 사용
- 파일 시스템 일관성을 위해 단일 워커 사용
- 테스트 전에 개발 서버 자동 시작

### 주요 테스트 시나리오
- **워크플로우 테스트**: 완전한 비디오 생성 워크플로우 (`fixed-workflow.spec.ts`)
- **API 통합**: 외부 API 연결 및 재시도 로직 (`api-integration.spec.ts`)
- **저장소 테스트**: 파일 시스템 작업 및 데이터 지속성 (`check-storage.spec.ts`)

### 성능 고려사항
- **이미지 생성**: 병렬 배치 처리 (기본값 3개 동시)
- **오디오 생성**: API 제한으로 인한 순차 처리
- **비디오 렌더링**: 10초마다 상태 폴링

---

## 중요 워크플로우

### Electron + React 개발
앱은 Electron 데스크톱 애플리케이션으로 실행:
1. **개발**: `npm run electron-dev`로 Vite 개발 서버와 Electron 동시 시작
2. **프로덕션 빌드**: `npm run dist`로 `release` 폴더에 설치 파일 생성
3. **파일 접근**: 파일 시스템 작업을 위해 Electron의 IPC 사용 (`electron.js` 참조)

### 비디오 생성 흐름
1. **스크립트 생성**: 사용자 입력 → Gemini API → 구조화된 장면
2. **이미지 생성**: 장면 프롬프트 → Gemini imagen API → 로컬 저장
3. **오디오 생성**: 장면 텍스트 → MiniMax TTS → MP3 파일
4. **비디오 렌더링**: 에셋 + 타임라인 → Shotstack API → 비디오 URL

### 상태 관리
- UI 상태를 위한 React hooks
- 설정 지속성을 위한 localStorage
- 미디어 에셋과 프로젝트를 위한 파일 시스템

---

## Common Issues & Solutions

### API Rate Limits
- Gemini API has rate limits - the app automatically retries with exponential backoff
- MiniMax TTS requires sequential processing to avoid rate limits
- Shotstack rendering can take time - the app polls status every 10 seconds

### File System Access
- In development, file operations work through Electron IPC
- Data is stored in the `data/` folder relative to the app root
- localStorage is used as a fallback for settings when file system is unavailable

### Testing Considerations
- Tests run with a single worker to avoid file system conflicts
- Use `npm run test:ui` for debugging test failures
- Check `test-results/` folder for failure screenshots and videos