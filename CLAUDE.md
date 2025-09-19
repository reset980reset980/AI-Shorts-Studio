# CLAUDE.md

이 문서는 **Claude Code (claude.ai/code)** 가 이 저장소에서 작업할 때 따라야 할 **행동 규칙과 안전 가드레일**을 정의합니다.
This file defines behavior rules and safety guardrails for **Claude Code** when working in this repository.

---

## ⚠️ 법적/윤리 가드레일 — Legal & Ethics Guardrails

### LSTUBE 폴더 참고 제한 (Reference-Only)
- **경로**: `D:\ai-shorts-studio\AI-Shorts-Studio\LSTUBE`
- **용도**: **아이디어/구조 참고 전용**. **코드, 에셋, 프롬프트, 메타데이터를 직접 복사/변환/치환 금지**.
- **금지 범위**: 파일 내용/주석/프롬프트/에셋/타임라인 구조/스타일 파라미터/샷 템플릿
- **유사도 기준**: 신규 구현물은 **의미 단위(함수/컴포넌트/프롬프트) 유사도 < 30%** 수준으로 독자성 확보
- **PR 검증**: LSTUBE 출처 추정 문자열/자막/워터마크/리소스명이 있으면 PR 자동 차단
- **질문/요청 시 답변**: "**LSTUBE는 참조 전용이며, 직접 사용/복제는 허용되지 않습니다. 신규 구현으로 대체합니다.**"

**EN**: The `LSTUBE` folder is **reference-only**. Do **not** copy code/assets/prompts/metadata. Ensure derivative work has **<30% structural similarity**. PRs containing probable LSTUBE content are blocked.

---

## 프로젝트 개요 — Project Overview

**AI Shorts Studio**는 텍스트에서 YouTube Shorts 비디오를 생성하는 Electron 기반 데스크톱 애플리케이션입니다.
AI Shorts Studio is an Electron-based desktop application for creating YouTube Shorts videos from text content.

### 기술 스택 — Tech Stack
- **프론트엔드**: React 19 + TypeScript + Vite
- **데스크톱**: Electron 28
- **UI**: Tailwind CSS
- **상태 관리**: React hooks
- **데이터 저장**: 파일 시스템 (data 폴더) + localStorage 폴백

---

## 실행/빌드 표준 — Run & Build Standards

### Node 버전
- **Node**: **v20.x** (`.nvmrc` 파일 사용)
- **Package Manager**: **npm** (lockfile: `package-lock.json`)

### 필수 스크립트
```bash
npm ci                    # Clean install (CI/Production)
npm run dev              # Vite dev server (http://localhost:5173)
npm run build            # Production build
npm run preview          # Preview production build
npm run electron         # Run Electron app
npm run electron-dev     # Run Electron with dev server
npm run dist            # Build and package Electron app
```

### 경로 규칙
- **OS 경로 의존 금지** (Windows 절대경로 등)
- 경로는 **상대경로** 또는 **.env 기반** 구성

---

## 시크릿/구성 — Secrets & Configuration

### 커밋 금지 파일
- `.env*` (환경 변수 파일)
- `env.ts` (API 키 파일)
- API 키/토큰/쿠키/인증 정보
- `data/` 폴더 내용 (사용자 데이터)

### 환경 변수 구성
```env
# .env.example
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_MINIMAX_JWT_TOKEN=your_minimax_jwt_token_here
VITE_SHOTSTACK_API_KEY=your_shotstack_api_key_here
```

---

## 아키텍처 — Architecture

### 핵심 서비스 및 API
- **Google Gemini API**: 스크립트 생성, 텍스트 교정, 이미지 생성
- **MiniMax API v2**: 한국어 TTS (Text-to-Speech)
- **Shotstack API**: 비디오 렌더링 및 합성

### 파일 저장 구조
```
data/
├── scripts/      # 대본 JSON 파일
├── images/       # 생성된 이미지 (프로젝트별 하위 폴더)
├── audio/        # 생성된 음성 파일 (프로젝트별 하위 폴더)
├── videos/       # 영상 URL 참조
└── projects/     # 프로젝트 메타데이터
```

### 주요 컴포넌트
```
App.tsx
├── ScriptingTab    # 대본 입력 및 생성
├── ChannelsTab     # YouTube 채널 관리
├── EditTab         # 영상 편집 및 프로젝트 관리
├── EditingTab      # 미디어 생성 및 렌더링
├── UploadTab       # YouTube 업로드
└── SettingsTab     # 설정 관리
```

---

## 타입 시스템 — Type System

### 핵심 타입 (types.ts)
- `Script`: 대본 및 씬 정보
- `Scene`: 개별 장면 데이터
- `Settings`: 앱 설정
- `YouTubeChannel`: 채널 정보
- `LogEntry`: 로그 항목

---

## 오류 처리 및 재시도 — Error Handling & Retry

### withRetry 래퍼
- **지수 백오프**: 429, 499 에러 시 자동 재시도
- **최대 재시도**: 기본 3회
- **멱등성**: 동일 요청 중복 방지

### 로그 레벨
- `debug`: 개발 환경
- `info`: 기본 정보
- `warn`: 경고
- `error`: 오류

### PII/키 마스킹
- 토큰/쿠키/Authorization 헤더 출력 금지
- 민감 정보 자동 마스킹

---

## 테스트 및 검증 — Testing & Verification

### 테스트 시나리오
1. **스크립트 생성**: 실패 → 재시도 → 부분 성공 → 최종 조합
2. **TTS 동기화**: 음성 길이와 타임코드 매칭
3. **Shotstack 검증**: 자막/타임라인 스키마 확인
4. **파일 저장**: data 폴더 구조 및 권한 확인

### 성능 기준
- **이미지 생성**: 병렬 3개 배치 처리
- **오디오 생성**: 순차 처리 (API 제한)
- **영상 렌더링**: 10초 간격 상태 폴링

---

## 변경 관리 — Change Management

### 브랜치 전략
```bash
main                # 프로덕션
├── develop         # 개발 통합
└── feature/*       # 기능 개발
```

### 커밋 메시지
```
feat: 새 기능 추가
fix: 버그 수정
docs: 문서 업데이트
refactor: 코드 개선
test: 테스트 추가
chore: 빌드/설정 변경
```

### PR 체크리스트
- [ ] LSTUBE 코드 비복제 확인
- [ ] 시크릿/API 키 제거
- [ ] 테스트 통과
- [ ] 문서 업데이트

---

## Claude 작업 프롬프트 — Claude Task Prompts

### 안전 변경 제안
```
"다음 변경은 LSTUBE를 참조만 하며 복제하지 않습니다.
변경 범위: [영향 받는 파일]
영향도: [기능 영향]
롤백 절차: [git revert 명령]"
```

### API 에러 대응
```
"[API명] Validation 실패
필드: [에러 필드 경로]
사유: [에러 메시지]
제안 수정: [대체 파라미터]"
```

### 시크릿 발견 시
```
"민감 정보 탐지: [파일명]
조치:
1. 파일 제거 + git 히스토리 제거
2. .env.example에 키 템플릿 추가
3. .gitignore 업데이트"
```

---

## 라이선스 및 3rd Party — Licensing

### 라이선스 요구사항
- 3rd-party 코드/에셋 사용 시 라이선스 파일 추가
- 상업적 사용 불가 리소스 금지
- 출처/버전/URL을 `THIRD_PARTY_NOTICES.md`에 기록

### 현재 사용 라이브러리
- React: MIT License
- Electron: MIT License
- Tailwind CSS: MIT License
- @google/genai: Apache 2.0

---

## 빠른 시작 — Quick Start

```bash
# 1. 의존성 설치
npm ci

# 2. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일에 API 키 입력

# 3. 개발 서버 실행
npm run dev

# 4. Electron 실행 (별도 터미널)
npm run electron

# 5. 프로덕션 빌드
npm run build
npm run dist
```

---

## 체크리스트 요약 — Checklist Summary

- ✅ **안전성**: LSTUBE 법적 가드레일, 시크릿 스캔, 파괴적 변경 방지
- ✅ **재현성**: Node 버전, 스크립트, Quickstart 가이드
- ✅ **변경관리**: 브랜치 전략, 커밋 규칙, PR 체크리스트
- ✅ **비상대응**: 재시도 로직, 에러 핸들링, 로그 시스템
- ✅ **데이터 관리**: 파일 시스템 저장, 프로젝트 구조화

---

*필요 시 `.nvmrc`, `.gitignore`, `.env.example`, `THIRD_PARTY_NOTICES.md`, CI 시크릿 스캔 워크플로우 생성 가능*