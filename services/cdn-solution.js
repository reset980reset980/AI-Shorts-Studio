// CDN 기반 솔루션 - ngrok 없이 작동

const express = require('express');
const fs = require('fs');
const path = require('path');

class CDNSolution {

  // 1. Vercel 배포 (무료, 자동 HTTPS)
  static async deployToVercel(dataFolder) {
    // vercel.json 생성
    const config = {
      "version": 2,
      "builds": [{
        "src": "index.js",
        "use": "@vercel/node"
      }],
      "routes": [{
        "src": "/data/(.*)",
        "dest": "/index.js"
      }]
    };

    fs.writeFileSync('vercel.json', JSON.stringify(config, null, 2));

    // 간단한 서버 파일
    const serverCode = `
      const express = require('express');
      const app = express();
      app.use('/data', express.static('data'));
      app.listen(3000);
      module.exports = app;
    `;

    fs.writeFileSync('index.js', serverCode);

    // Vercel CLI로 배포 (vercel 설치 필요)
    const { exec } = require('child_process');
    return new Promise((resolve) => {
      exec('vercel --prod', (error, stdout) => {
        const match = stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
        if (match) resolve(match[0]);
      });
    });
  }

  // 2. Firebase Hosting (무료 티어)
  static async deployToFirebase(dataFolder) {
    const firebaseConfig = {
      "hosting": {
        "public": "data",
        "headers": [{
          "source": "**/*",
          "headers": [{
            "key": "Access-Control-Allow-Origin",
            "value": "*"
          }]
        }]
      }
    };

    fs.writeFileSync('firebase.json', JSON.stringify(firebaseConfig, null, 2));

    const { exec } = require('child_process');
    return new Promise((resolve) => {
      exec('firebase deploy', (error, stdout) => {
        const match = stdout.match(/https:\/\/[^\s]+\.web\.app/);
        if (match) resolve(match[0]);
      });
    });
  }

  // 3. JSDelivr (GitHub 기반 CDN, 무료)
  static getJSDelivrUrl(githubUser, repoName, filePath) {
    // GitHub에 파일이 있다면 즉시 CDN URL 생성
    return `https://cdn.jsdelivr.net/gh/${githubUser}/${repoName}@main/${filePath}`;
  }

  // 4. Netlify Drop (드래그앤드롭 배포)
  static async deployToNetlify(dataFolder) {
    // ZIP 파일 생성
    const archiver = require('archiver');
    const output = fs.createWriteStream('deploy.zip');
    const archive = archiver('zip');

    archive.pipe(output);
    archive.directory(dataFolder, false);
    await archive.finalize();

    // Netlify API로 업로드
    const form = new FormData();
    form.append('file', fs.createReadStream('deploy.zip'));

    const response = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_NETLIFY_TOKEN',
      },
      body: form
    });

    const data = await response.json();
    return data.ssl_url;
  }
}

// 하이브리드 솔루션 - 로컬 서버 + 퍼블릭 프록시
class HybridSolution {
  static async start(port = 5900) {
    const app = express();

    // CORS 설정
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    // 파일 서빙
    app.use('/data', express.static('data'));

    // 프록시 정보 엔드포인트
    app.get('/proxy-info', async (req, res) => {
      // 여러 프록시 중 사용 가능한 것 반환
      const proxies = [
        await this.checkLocaltunnel(),
        await this.checkCloudflare(),
        this.getLocalIP()
      ].filter(url => url);

      res.json({
        available: proxies,
        recommended: proxies[0] || 'http://localhost:5900'
      });
    });

    app.listen(port, () => {
      console.log(`Hybrid server running on port ${port}`);
    });
  }

  static async checkLocaltunnel() {
    try {
      const localtunnel = require('localtunnel');
      const tunnel = await localtunnel({ port: 5900 });
      return tunnel.url;
    } catch {
      return null;
    }
  }

  static async checkCloudflare() {
    // Cloudflare tunnel 체크
    return null;
  }

  static getLocalIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return `http://${iface.address}:5900`;
        }
      }
    }
    return 'http://localhost:5900';
  }
}

module.exports = { CDNSolution, HybridSolution };