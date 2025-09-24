import { test, expect } from '@playwright/test';

test('영상 렌더링 ngrok 테스트', async ({ page }) => {
  // 타임아웃 늘리기 - 영상 렌더링까지 시간이 필요함
  test.setTimeout(120000);

  // 앱 접속
  await page.goto('http://localhost:5173');
  console.log('✅ 앱 접속 성공');

  // 설정이 로드될 때까지 대기
  await page.waitForTimeout(3000);

  // 내정보 탭으로 이동하여 ngrok URL 설정
  await page.getByRole('button', { name: '내정보' }).click();
  console.log('✅ 내정보 탭 열기 성공');

  // 파일 서버 URL 입력
  const urlInput = page.locator('input[placeholder*="ngrok"]');
  await urlInput.clear();
  // jolly-obliging-llama.ngrok-free.app 사용
  await urlInput.fill('jolly-obliging-llama.ngrok-free.app');
  console.log('✅ ngrok URL 설정: jolly-obliging-llama.ngrok-free.app');

  // 설정 저장
  await page.getByRole('button', { name: /Google\/Shotstack/i }).click();
  console.log('✅ 설정 저장 완료');

  // 대본입력 탭으로 이동
  await page.getByRole('button', { name: '대본입력' }).click();
  console.log('✅ 대본입력 탭 열기');

  // 텍스트 입력
  const input = page.locator('textarea').first();
  await input.fill('테스트 비디오입니다. AI 기술로 만든 첫 번째 쇼츠 영상.');
  console.log('✅ 텍스트 입력 완료');

  // 스크립트 생성 버튼 클릭
  const generateButton = page.getByRole('button', { name: /스크립트 생성|생성/i });
  await generateButton.click();
  console.log('✅ 스크립트 생성 시작');

  // 스크립트 생성 완료 대기 (최대 30초)
  await page.waitForTimeout(5000);

  // 영상편집 탭으로 이동
  await page.getByRole('button', { name: '영상편집' }).click();
  console.log('✅ 영상편집 탭 열기');

  // 프로젝트 목록이 로드될 때까지 대기
  await page.waitForTimeout(2000);

  // 첫 번째 프로젝트 선택
  const projectCards = page.locator('.bg-gray-700');
  const firstProject = projectCards.first();
  if (await firstProject.isVisible()) {
    await firstProject.click();
    console.log('✅ 첫 번째 프로젝트 선택');
  } else {
    console.log('⚠️ 프로젝트가 없습니다');
    return;
  }

  // 이미지 생성 버튼 클릭
  const generateImagesButton = page.getByRole('button', { name: /이미지 생성/i });
  if (await generateImagesButton.isVisible()) {
    await generateImagesButton.click();
    console.log('✅ 이미지 생성 시작');
    await page.waitForTimeout(10000); // 이미지 생성 대기
  }

  // 음성 생성 버튼 클릭
  const generateAudioButton = page.getByRole('button', { name: /음성 생성/i });
  if (await generateAudioButton.isVisible()) {
    await generateAudioButton.click();
    console.log('✅ 음성 생성 시작');
    await page.waitForTimeout(10000); // 음성 생성 대기
  }

  // 영상 합성 버튼 클릭
  const renderVideoButton = page.getByRole('button', { name: /영상 합성|영상 생성/i });
  if (await renderVideoButton.isVisible()) {
    await renderVideoButton.click();
    console.log('✅ 영상 합성 시작');

    // 렌더링 진행 상태 확인
    await page.waitForTimeout(5000);

    // 에러 메시지 확인
    const errorMessage = page.locator('text=/ERROR|에러|오류/i');
    if (await errorMessage.isVisible()) {
      const errorText = await errorMessage.textContent();
      console.error('❌ 영상 렌더링 에러:', errorText);

      // 콘솔 로그 확인
      page.on('console', msg => {
        console.log('Browser console:', msg.text());
      });

      // 네트워크 요청 확인
      page.on('request', request => {
        if (request.url().includes('shotstack') || request.url().includes('ngrok')) {
          console.log('Request:', request.method(), request.url());
        }
      });

      page.on('response', response => {
        if (response.url().includes('shotstack') || response.url().includes('ngrok')) {
          console.log('Response:', response.status(), response.url());
        }
      });

      // 잠시 대기하여 로그 수집
      await page.waitForTimeout(5000);
    } else {
      console.log('✅ 영상 렌더링 요청 성공');

      // 렌더링 완료 대기 (최대 60초)
      let renderComplete = false;
      for (let i = 0; i < 6; i++) {
        await page.waitForTimeout(10000);

        const statusText = await page.locator('text=/렌더링|처리중|완료/i').textContent();
        console.log(`렌더링 상태 (${(i+1)*10}초): ${statusText}`);

        if (statusText?.includes('완료')) {
          renderComplete = true;
          break;
        }
      }

      if (renderComplete) {
        console.log('✅ 영상 렌더링 완료!');
      } else {
        console.log('⏱️ 영상 렌더링 진행 중...');
      }
    }
  } else {
    console.log('⚠️ 영상 합성 버튼을 찾을 수 없습니다');
  }

  console.log('\n=== 테스트 완료 ===');
});