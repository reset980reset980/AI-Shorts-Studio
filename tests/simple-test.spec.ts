import { test, expect } from '@playwright/test';

test('AI Shorts Studio 간단 실행 테스트', async ({ page }) => {
  // 앱 접속
  await page.goto('http://localhost:5173');
  console.log('✅ 앱 접속 성공');

  // 대본입력 탭 확인
  const scriptTab = page.getByRole('button', { name: '대본입력' });
  await expect(scriptTab).toBeVisible();
  await scriptTab.click();
  console.log('✅ 대본입력 탭 열기 성공');

  // 텍스트 입력
  const input = page.getByPlaceholder('텍스트를 입력하거나');
  await input.fill('테스트 스크립트입니다. AI 기술의 발전에 대한 이야기.');
  console.log('✅ 텍스트 입력 성공');

  // 영상편집 탭으로 이동
  await page.getByRole('button', { name: '영상편집' }).click();
  await expect(page.getByText('프로젝트 리스트')).toBeVisible();
  console.log('✅ 영상편집 탭 열기 성공');

  // 내정보 탭으로 이동
  await page.getByRole('button', { name: '내정보' }).click();
  console.log('✅ 내정보 탭 열기 성공');

  // 파일 서버 URL 확인
  const urlInput = page.locator('input[placeholder*="ngrok"]');
  const currentUrl = await urlInput.inputValue();
  console.log(`📌 현재 설정된 파일 서버 URL: ${currentUrl}`);

  // 로컬호스트로 변경 (테스트용)
  if (currentUrl !== 'http://localhost:5900') {
    await urlInput.clear();
    await urlInput.fill('http://localhost:5900');
    await page.getByRole('button', { name: /Google\/Shotstack/i }).click();
    console.log('✅ 파일 서버 URL 설정 완료: http://localhost:5900');
  }

  console.log('\n=== 테스트 완료 ===');
  console.log('모든 기본 기능이 정상 작동합니다.');
  console.log('\n📌 영상 렌더링을 위해서는:');
  console.log('1. ngrok을 설치하고 실행하세요: ngrok http 5900');
  console.log('2. ngrok URL을 파일 서버 URL에 입력하세요');
  console.log('3. 스크립트 생성 → 이미지 생성 → 음성 생성 → 영상 렌더링 순서로 진행하세요');
});