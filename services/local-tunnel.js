// ngrok 대체 방법들

// 1. Localtunnel (무료, 오픈소스)
const localtunnel = require('localtunnel');

async function startLocalTunnel(port = 5900) {
  const tunnel = await localtunnel({ port });

  console.log(`Tunnel URL: ${tunnel.url}`);

  tunnel.on('close', () => {
    console.log('Tunnel closed');
  });

  return tunnel.url;
}

// 2. Cloudflare Tunnel (무료, 안정적)
// cloudflared를 설치해야 함
const { exec } = require('child_process');

function startCloudflareTunnel(port = 5900) {
  return new Promise((resolve) => {
    exec(`cloudflared tunnel --url http://localhost:${port}`, (error, stdout, stderr) => {
      const match = stderr.match(/https:\/\/[^\s]+\.trycloudflare\.com/);
      if (match) {
        resolve(match[0]);
      }
    });
  });
}

// 3. 로컬 네트워크 사용 (같은 네트워크)
const os = require('os');

function getLocalNetworkUrl(port = 5900) {
  const interfaces = os.networkInterfaces();
  let localIP = '127.0.0.1';

  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }

  return `http://${localIP}:${port}`;
}

// 4. Tailscale (VPN 방식, 무료)
async function getTailscaleUrl(port = 5900) {
  // Tailscale 설치 필요
  const deviceName = 'your-device-name';
  return `http://${deviceName}:${port}`;
}

// 5. Serveo (SSH 터널링, 무료)
function startServeoTunnel(port = 5900) {
  return new Promise((resolve) => {
    exec(`ssh -R 80:localhost:${port} serveo.net`, (error, stdout, stderr) => {
      const match = stdout.match(/https:\/\/[^\s]+\.serveo\.net/);
      if (match) {
        resolve(match[0]);
      }
    });
  });
}

module.exports = {
  startLocalTunnel,
  startCloudflareTunnel,
  getLocalNetworkUrl,
  getTailscaleUrl,
  startServeoTunnel
};