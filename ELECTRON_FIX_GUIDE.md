# Electron 실행 문제 해결 가이드

## 현재 상황
- `npm run build` ✅ 성공 (dist 폴더 생성됨)
- `npm run electron` 실행되지만 창이 안 보임

## 실행 방법 (3가지)

### 방법 1: 빌드 후 실행 (권장)
```bash
# 1. 빌드
npm run build

# 2. Electron 실행
npm run electron
```

### 방법 2: 개발 모드 실행
```bash
npm run electron-dev
```
이 명령은 자동으로:
1. Vite 개발 서버 시작
2. 5173 포트가 준비될 때까지 대기
3. Electron 창 실행

### 방법 3: 수동 실행
```bash
# 터미널 1 - 개발 서버
npm run dev

# 터미널 2 - Electron (개발 서버 시작 후)
npm run electron
```

## 창이 안 보이는 경우 해결법

### 1. 작업 표시줄 확인
- Windows 작업 표시줄에 Electron 아이콘이 있는지 확인
- 최소화되어 있을 수 있음

### 2. 작업 관리자 확인
```bash
# PowerShell에서
Get-Process electron

# 또는 작업 관리자에서 'electron.exe' 검색
```

### 3. 프로세스 종료 후 재시작
```bash
# 모든 Electron/Node 프로세스 종료
taskkill /F /IM electron.exe /T
taskkill /F /IM node.exe /T

# 다시 시작
npm run build
npm run electron
```

### 4. 환경 변수 설정
```bash
# 개발 모드 강제 설정
set NODE_ENV=development
npm run electron
```

### 5. 직접 실행
```bash
# electron.exe 직접 실행
npx electron .
```

### 6. 캐시 정리
```bash
# npm 캐시 정리
npm cache clean --force

# node_modules 재설치
rmdir /s /q node_modules
npm ci
```

## 디버깅 방법

### 콘솔 로그 확인
```bash
# 콘솔 출력과 함께 실행
npm run electron 2>&1 | more
```

### Electron 로그 활성화
```bash
set ELECTRON_ENABLE_LOGGING=1
npm run electron
```

### 개발자 도구 자동 열기
electron.js의 59번 줄이 개발 모드에서 개발자 도구를 자동으로 엽니다.

## 일반적인 문제와 해결

### 1. "창이 열렸다가 바로 닫힘"
- **원인**: 파일 로드 실패
- **해결**: `npm run build` 확인

### 2. "아무 반응 없음"
- **원인**: 이미 실행 중
- **해결**: 작업 관리자에서 electron.exe 종료

### 3. "포트 충돌"
- **원인**: 5173 포트 사용 중
- **해결**: 다른 포트 사용 또는 프로세스 종료

### 4. "모니터 문제"
- **원인**: 듀얼 모니터에서 다른 화면에 표시
- **해결**: Win + Shift + 화살표로 창 이동

## 확인 사항 체크리스트

- [ ] dist 폴더가 있고 index.html이 있는가?
- [ ] node_modules/@electron 폴더가 있는가?
- [ ] 작업 표시줄에 Electron 아이콘이 있는가?
- [ ] 작업 관리자에 electron.exe가 실행 중인가?
- [ ] 방화벽이나 백신이 차단하고 있지 않은가?

## 권장 실행 순서

1. **모든 프로세스 종료**
   ```bash
   taskkill /F /IM electron.exe /T
   taskkill /F /IM node.exe /T
   ```

2. **빌드 확인**
   ```bash
   npm run build
   ```

3. **Electron 실행**
   ```bash
   npm run electron
   ```

4. **안 되면 개발 모드**
   ```bash
   npm run electron-dev
   ```

## 추가 팁

- Electron은 백그라운드에서 실행되므로 `Ctrl+C`로 종료
- 개발 시에는 `npm run electron-dev` 사용 권장
- 프로덕션 배포 시에는 `npm run dist`로 설치 파일 생성

---
작성일: 2025-09-24