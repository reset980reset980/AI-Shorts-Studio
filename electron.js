const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const url = require('url');
const remoteMain = require('@electron/remote/main');

// Remote 모듈 초기화
remoteMain.initialize();

// 개발 환경인지 확인
const isDev = process.env.NODE_ENV !== 'production';

let mainWindow;

function createWindow() {
  // 브라우저 창 생성
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // 로컬 파일 접근 허용 (개발용)
    },
    icon: path.join(__dirname, 'public/favicon.ico'),
    title: 'AI Shorts Studio',
    backgroundColor: '#1a1f2e',
    show: true // 즉시 표시
  });

  // 메뉴 설정 (옵션)
  if (!isDev) {
    Menu.setApplicationMenu(null); // 프로덕션에서는 메뉴 숨기기
  }

  // 개발 모드: Vite 개발 서버 연결 (동적 포트 탐색)
  // 프로덕션: 빌드된 파일 로드
  if (isDev) {
    // Vite 개발 서버가 실행 중인 포트를 찾아 연결
    const loadDevServer = async () => {
      const ports = [5173, 5174, 5175, 5176, 5177]; // 가능한 포트들
      for (const port of ports) {
        try {
          await mainWindow.loadURL(`http://localhost:${port}`);
          console.log(`Connected to dev server on port ${port}`);
          break;
        } catch (err) {
          console.log(`Port ${port} not available, trying next...`);
          if (port === ports[ports.length - 1]) {
            // 마지막 포트까지 실패하면 기본값 사용
            mainWindow.loadURL('http://localhost:5173');
          }
        }
      }
    };
    loadDevServer();
    mainWindow.webContents.openDevTools(); // 개발자 도구 자동 열기
  } else {
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, 'dist/index.html'),
        protocol: 'file:',
        slashes: true
      })
    );
  }

  // Remote 모듈 활성화
  remoteMain.enable(mainWindow.webContents);

  // 창이 준비되면 포커스
  mainWindow.once('ready-to-show', () => {
    mainWindow.focus();
  });

  // 창이 닫힐 때
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 외부 링크는 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

// Electron이 준비되면 창 생성
app.whenReady().then(createWindow);

// 모든 창이 닫히면 앱 종료 (macOS 제외)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 앱이 활성화되면 창 생성 (macOS)
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// 보안 강화: 원격 콘텐츠 로딩 제한
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    // 로컬호스트와 file:// 프로토콜만 허용
    if (parsedUrl.protocol !== 'file:' && !navigationUrl.startsWith('http://localhost')) {
      event.preventDefault();
    }
  });
});