const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 5900;

// CORS 설정 - Shotstack이 접근할 수 있도록
app.use(cors());

// data 폴더를 정적 파일로 제공
app.use('/data', express.static(path.join(__dirname, 'data'), {
  setHeaders: (res, filePath) => {
    // 캐시 방지
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    // 파일 타입에 따른 Content-Type 설정
    if (filePath.endsWith('.mp3')) {
      res.set('Content-Type', 'audio/mpeg');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.set('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.set('Content-Type', 'image/png');
    }
  }
}));

// 상태 확인 엔드포인트
app.get('/status', (req, res) => {
  res.json({ status: 'running', port: PORT });
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
  console.log(`📁 File server running at http://localhost:${PORT}`);
  console.log(`   - Images: http://localhost:${PORT}/data/images/[scriptId]/[filename]`);
  console.log(`   - Audio: http://localhost:${PORT}/data/audio/[scriptId]/[filename]`);
  console.log('\n⚠️  Note: For Shotstack to access files, you need to:');
  console.log('   1. Use ngrok: ngrok http 5900');
  console.log('   2. Or deploy files to a cloud storage service');
});