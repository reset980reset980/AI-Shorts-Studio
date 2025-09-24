# 🚀 모든 솔루션 종합 가이드

이 문서는 ngrok 대안 및 Shotstack 파일 접근 문제를 해결하기 위한 모든 방법을 정리한 것입니다.

## 📋 목차
1. [현재 문제 요약](#현재-문제-요약)
2. [즉시 사용 가능한 솔루션](#즉시-사용-가능한-솔루션)
3. [클라우드 기반 솔루션](#클라우드-기반-솔루션)
4. [로컬 터널링 솔루션](#로컬-터널링-솔루션)
5. [CDN 배포 솔루션](#cdn-배포-솔루션)
6. [ffmpeg 로컬 렌더링](#ffmpeg-로컬-렌더링)
7. [하이브리드 접근법](#하이브리드-접근법)

---

## 현재 문제 요약

**문제**: Shotstack API가 로컬 파일에 직접 접근할 수 없어 외부 URL이 필요함

**현재 시도한 방법들**:
- ❌ Base64 인코딩: Shotstack API가 크기 제한으로 거부
- ⚠️ ngrok: 인증 토큰 문제, 무료 버전 제약
- ✅ 로컬 파일 서버: 작동하지만 외부 접근 불가

---

## 즉시 사용 가능한 솔루션

### 1. Cloudflare Tunnel (Quick Start)
```bash
# 설치 없이 바로 사용 (임시 URL)
npx cloudflared tunnel --url http://localhost:5900
```

### 2. Localtunnel
```bash
# 설치
npm install -g localtunnel

# 실행
lt --port 5900

# 생성된 URL을 앱에 입력
```

### 3. Serveo (SSH 터널)
```bash
# SSH만 있으면 사용 가능
ssh -R 80:localhost:5900 serveo.net

# 또는 고정 서브도메인
ssh -R myapp:80:localhost:5900 serveo.net
```

### 4. Bore
```bash
# 설치
cargo install bore-cli

# 실행
bore local 5900 --to bore.pub
```

---

## 클라우드 기반 솔루션

### 1. Imgur (이미지 전용)
```javascript
// services/imgur-uploader.js
async function uploadToImgur(imagePath) {
  const image = fs.readFileSync(imagePath, { encoding: 'base64' });

  const response = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      'Authorization': 'Client-ID YOUR_CLIENT_ID', // 무료 발급
    },
    body: JSON.stringify({ image, type: 'base64' })
  });

  const data = await response.json();
  return data.data.link; // 영구 URL
}
```

### 2. File.io (임시 파일)
```javascript
// 1회 다운로드 후 자동 삭제
async function uploadToFileIO(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  const response = await fetch('https://file.io', {
    method: 'POST',
    body: form
  });

  return (await response.json()).link;
}
```

### 3. 0x0.st (익명 업로드)
```bash
# 명령줄에서 바로 사용
curl -F'file=@scene_1.jpg' https://0x0.st
```

### 4. Catbox.moe
```javascript
// 최대 200MB, 영구 보관
async function uploadToCatbox(filePath) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', fs.createReadStream(filePath));

  const response = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form
  });

  return await response.text();
}
```

### 5. Cloudinary (무료 티어)
```javascript
// 월 25GB 대역폭, 25GB 저장공간
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'YOUR_CLOUD',
  api_key: 'YOUR_KEY',
  api_secret: 'YOUR_SECRET'
});

async function uploadToCloudinary(filePath) {
  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: 'auto'
  });
  return result.secure_url;
}
```

---

## 로컬 터널링 솔루션

### 1. Cloudflare Tunnel (계정 필요)
```yaml
# config.yml
tunnel: ai-shorts-studio
credentials-file: ~/.cloudflared/[TUNNEL_ID].json

ingress:
  - hostname: ai-shorts.your-domain.com
    service: http://localhost:5900
  - service: http_status:404
```

```bash
# 실행
cloudflared tunnel run ai-shorts-studio
```

### 2. Tailscale (VPN 방식)
```bash
# 설치 후
tailscale up

# 다른 기기에서 접근
http://your-machine-name:5900
```

### 3. ZeroTier (P2P VPN)
```bash
# 네트워크 생성 후
zerotier-cli join [NETWORK_ID]

# 할당된 IP로 접근
http://10.147.20.x:5900
```

### 4. Telebit
```bash
npm install -g telebit

telebit http 5900
```

### 5. Localhost.run
```bash
ssh -R 80:localhost:5900 ssh.localhost.run
```

---

## CDN 배포 솔루션

### 1. Vercel (자동 배포)
```javascript
// vercel.json
{
  "functions": {
    "api/files.js": {
      "maxDuration": 10
    }
  },
  "rewrites": [
    { "source": "/data/(.*)", "destination": "/api/files" }
  ]
}
```

```bash
vercel --prod
```

### 2. Netlify Drop
```bash
# 폴더를 ZIP으로 압축 후
# https://app.netlify.com/drop 에 드래그앤드롭
```

### 3. Surge.sh
```bash
npm install -g surge

cd data
surge --domain ai-shorts.surge.sh
```

### 4. GitHub Pages + JSDelivr
```javascript
// GitHub에 파일 업로드 후
const cdnUrl = `https://cdn.jsdelivr.net/gh/username/repo@main/data/images/scene.jpg`;
```

### 5. Firebase Hosting
```bash
firebase init hosting
firebase deploy
```

---

## ffmpeg 로컬 렌더링

### 완전한 로컬 솔루션 (네트워크 불필요)
```javascript
const { exec } = require('child_process');

class LocalRenderer {
  async renderVideo(scenes) {
    const commands = [];

    // 1. 각 씬을 비디오로 변환
    for (const scene of scenes) {
      const cmd = `ffmpeg -loop 1 -i ${scene.image} -i ${scene.audio} \
        -c:v libx264 -tune stillimage -c:a aac -shortest \
        -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920" \
        scene_${scene.id}.mp4`;
      commands.push(cmd);
    }

    // 2. 모든 씬 연결
    const concat = `ffmpeg -f concat -safe 0 -i list.txt -c copy output.mp4`;

    // 3. 자막 추가
    const subtitle = `ffmpeg -i output.mp4 -vf subtitles=subs.srt final.mp4`;

    return 'final.mp4';
  }
}
```

**장점**:
- ✅ 완전 무료
- ✅ 네트워크 불필요
- ✅ 최고 품질
- ✅ 완전한 제어

**단점**:
- ❌ 구현 복잡
- ❌ ffmpeg 설치 필요
- ❌ 렌더링 속도가 하드웨어 의존적

---

## 하이브리드 접근법

### 1. 로컬 + 클라우드 폴백
```javascript
class HybridRenderer {
  async getFileUrl(filePath) {
    // 1. 로컬 네트워크 시도
    const localUrl = await this.tryLocalNetwork(filePath);
    if (localUrl) return localUrl;

    // 2. 터널 시도
    const tunnelUrl = await this.tryTunnel(filePath);
    if (tunnelUrl) return tunnelUrl;

    // 3. 클라우드 업로드
    return await this.uploadToCloud(filePath);
  }

  async tryLocalNetwork(filePath) {
    // 같은 네트워크인지 확인
    const localIP = this.getLocalIP();
    try {
      await fetch(`http://${localIP}:5900/health`);
      return `http://${localIP}:5900/${filePath}`;
    } catch {
      return null;
    }
  }

  async tryTunnel(filePath) {
    // Cloudflare/Localtunnel 체크
    if (this.tunnelUrl) {
      return `${this.tunnelUrl}/${filePath}`;
    }
    return null;
  }

  async uploadToCloud(filePath) {
    // 가장 빠른 클라우드 서비스 선택
    const services = [
      () => this.uploadToImgur(filePath),
      () => this.uploadToFileIO(filePath),
      () => this.uploadTo0x0(filePath)
    ];

    return Promise.race(services.map(s => s()));
  }
}
```

### 2. 스마트 라우팅
```javascript
class SmartRouter {
  constructor() {
    this.methods = [
      { name: 'local', check: this.checkLocal, priority: 1 },
      { name: 'tunnel', check: this.checkTunnel, priority: 2 },
      { name: 'cloud', check: this.checkCloud, priority: 3 },
      { name: 'ffmpeg', check: this.checkFFmpeg, priority: 4 }
    ];
  }

  async getBestMethod() {
    // 모든 방법 동시 체크
    const results = await Promise.allSettled(
      this.methods.map(m => m.check())
    );

    // 성공한 방법 중 우선순위가 높은 것 선택
    const available = results
      .filter(r => r.status === 'fulfilled' && r.value)
      .sort((a, b) => a.priority - b.priority);

    return available[0] || { name: 'ffmpeg' }; // 최후의 수단
  }
}
```

---

## 권장 우선순위

### 개발/테스트 환경
1. **Cloudflare Quick Tunnel** (가장 간단)
2. **Localtunnel** (npm 패키지)
3. **로컬 네트워크** (같은 공유기)

### 프로덕션 환경
1. **Cloudflare Tunnel** (고정 도메인)
2. **CDN 배포** (Vercel/Netlify)
3. **ffmpeg 로컬 렌더링** (완전 독립)

### 비상 대책
1. **File.io** (임시 업로드)
2. **0x0.st** (익명 업로드)
3. **Base64** (작은 파일만)

---

## 실행 스크립트

### all-in-one.js
```javascript
const methods = {
  cloudflare: () => exec('cloudflared tunnel --url http://localhost:5900'),
  localtunnel: () => exec('lt --port 5900'),
  serveo: () => exec('ssh -R 80:localhost:5900 serveo.net'),
  upload: (file) => uploadToImgur(file),
  ffmpeg: (script) => renderWithFFmpeg(script)
};

// 사용 가능한 방법 자동 선택
async function autoSelect() {
  for (const [name, method] of Object.entries(methods)) {
    try {
      const result = await method();
      console.log(`✅ Using ${name}: ${result}`);
      return result;
    } catch (err) {
      console.log(`❌ ${name} failed: ${err.message}`);
    }
  }
}
```

---

**문서 작성일**: 2025-09-24
**최종 수정**: 모든 제안 솔루션 종합 정리