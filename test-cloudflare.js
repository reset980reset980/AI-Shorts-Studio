// Cloudflare Tunnel 연결 테스트
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('========================================');
console.log('Cloudflare Tunnel 연결 테스트');
console.log('========================================\n');

rl.question('Cloudflare Tunnel URL을 입력하세요 (예: https://xxxxx.trycloudflare.com): ', async (tunnelUrl) => {
  console.log('\n테스트 시작...\n');

  // URL 형식 정리
  if (!tunnelUrl.startsWith('http')) {
    tunnelUrl = 'https://' + tunnelUrl;
  }
  if (tunnelUrl.endsWith('/')) {
    tunnelUrl = tunnelUrl.slice(0, -1);
  }

  const tests = [
    {
      name: '기본 연결',
      url: tunnelUrl,
      expected: 200
    },
    {
      name: '이미지 파일 접근',
      url: `${tunnelUrl}/data/images/1758675938779/scene_1.jpg`,
      expected: 200
    },
    {
      name: '오디오 파일 접근',
      url: `${tunnelUrl}/data/audio/1758675938779/scene_1.mp3`,
      expected: 200
    }
  ];

  for (const test of tests) {
    try {
      console.log(`테스트: ${test.name}`);
      console.log(`URL: ${test.url}`);

      const response = await fetch(test.url, { method: 'HEAD' });

      if (response.status === test.expected) {
        console.log(`✅ 성공 (상태: ${response.status})`);
      } else {
        console.log(`❌ 실패 (상태: ${response.status}, 예상: ${test.expected})`);
      }
    } catch (error) {
      console.log(`❌ 에러: ${error.message}`);
    }
    console.log('');
  }

  console.log('========================================');
  console.log('테스트 완료!');
  console.log('\n성공했다면 이 URL을 앱의 "내정보" 탭에 입력하세요.');
  console.log(`URL: ${tunnelUrl}`);
  console.log('========================================');

  rl.close();
});