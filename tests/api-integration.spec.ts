import { test, expect, Page } from '@playwright/test';

// Test configuration for API testing
const API_TEST_CONFIG = {
  timeout: 45000,
  retryAttempts: 3,
  testInput: '간단한 테스트 메시지입니다.'
};

// Mock API responses for testing
const mockApiResponses = {
  correction: '보정된 테스트 메시지입니다.',
  scriptGeneration: {
    title: 'Test Script',
    scenes: [
      {
        id: 1,
        script: 'Test scene content',
        imagePrompt: 'Test image prompt',
        time: '00:00 - 00:15'
      }
    ]
  }
};

async function interceptApiCalls(page: Page) {
  // Intercept Google Gemini API calls
  await page.route('**/gemini/*/generateContent*', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: mockApiResponses.correction }]
          }
        }]
      })
    });
  });

  // Intercept MiniMax API calls
  await page.route('**/v2/text_to_speech', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          audio: 'base64_encoded_audio_data_mock'
        }
      })
    });
  });

  // Intercept Shotstack API calls
  await page.route('**/v1/render', route => {
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        response: {
          id: 'mock_render_id_12345'
        }
      })
    });
  });

  await page.route('**/v1/render/*', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        response: {
          id: 'mock_render_id_12345',
          status: 'done',
          url: 'https://mock-video-url.com/video.mp4'
        }
      })
    });
  });
}

test.describe('API Integration Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Set up API mocking
    await interceptApiCalls(page);

    await page.goto('/');
    await expect(page.locator('text=AI Shorts Studio가 시작되었습니다')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=설정을 성공적으로 불러왔습니다')).toBeVisible({ timeout: 15000 });
  });

  test('Google Gemini API - Text Correction', async ({ page }) => {
    await page.click('text=대본입력');

    // Input test text
    await page.fill('textarea[placeholder*="원문"]', API_TEST_CONFIG.testInput);

    // Monitor API calls
    const apiCalls: string[] = [];
    page.on('request', request => {
      if (request.url().includes('gemini')) {
        apiCalls.push(`Gemini API: ${request.method()} ${request.url()}`);
      }
    });

    // Click AI correction
    await page.click('button:has-text("AI 보정")');

    // Wait for response
    await expect(page.locator('text=AI 보정 완료')).toBeVisible({ timeout: API_TEST_CONFIG.timeout });

    // Verify output
    const outputTextarea = page.locator('textarea').nth(1);
    const outputText = await outputTextarea.inputValue();
    expect(outputText).toContain('보정된');

    console.log('Gemini API calls:', apiCalls);
  });

  test('API Error Handling and Retry Logic', async ({ page }) => {
    // Override API to return errors first
    await page.route('**/gemini/*/generateContent*', route => {
      static callCount = 0;
      callCount++;

      if (callCount <= 2) {
        // First two calls fail
        route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Rate limit exceeded' })
        });
      } else {
        // Third call succeeds
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            candidates: [{
              content: {
                parts: [{ text: 'Retry success' }]
              }
            }]
          })
        });
      }
    });

    await page.click('text=대본입력');
    await page.fill('textarea[placeholder*="원문"]', API_TEST_CONFIG.testInput);

    // Monitor retry attempts
    const retryAttempts: string[] = [];
    page.on('response', response => {
      if (response.url().includes('gemini')) {
        retryAttempts.push(`Status: ${response.status()}`);
      }
    });

    await page.click('button:has-text("AI 보정")');

    // Should eventually succeed after retries
    await expect(page.locator('text=AI 보정 완료')).toBeVisible({ timeout: API_TEST_CONFIG.timeout });

    console.log('Retry attempts:', retryAttempts);
    expect(retryAttempts.length).toBeGreaterThan(1);
  });

  test('MiniMax API - Text-to-Speech Integration', async ({ page }) => {
    // First generate/select a script
    await page.click('text=영상편집');
    await page.waitForTimeout(2000);

    // Monitor TTS API calls
    const ttsApiCalls: string[] = [];
    page.on('request', request => {
      if (request.url().includes('text_to_speech')) {
        ttsApiCalls.push(`TTS API: ${request.method()}`);
      }
    });

    // Look for audio generation button
    const audioButton = page.locator('button:has-text("음성 생성")').first();
    if (await audioButton.isVisible()) {
      await audioButton.click();

      // Wait for audio generation
      await expect(page.locator('text*=음성 생성')).toBeVisible({ timeout: 5000 });

      console.log('TTS API calls:', ttsApiCalls);
    }
  });

  test('Shotstack API - Video Rendering Integration', async ({ page }) => {
    await page.click('text=영상편집');
    await page.waitForTimeout(2000);

    // Monitor Shotstack API calls
    const renderApiCalls: string[] = [];
    page.on('request', request => {
      if (request.url().includes('shotstack')) {
        renderApiCalls.push(`Shotstack API: ${request.method()} ${request.url()}`);
      }
    });

    // Look for render button
    const renderButton = page.locator('button:has-text("영상 렌더링")').first();
    if (await renderButton.isVisible()) {
      await renderButton.click();

      // Wait for render to start
      await expect(page.locator('text*=렌더링')).toBeVisible({ timeout: 10000 });

      console.log('Shotstack API calls:', renderApiCalls);
    }
  });

  test('API Key Configuration and Validation', async ({ page }) => {
    await page.click('text=내정보');
    await page.waitForTimeout(2000);

    // Check for API key configuration fields
    const apiKeyInputs = page.locator('input[type="password"], input[placeholder*="API"], input[placeholder*="키"]');
    const inputCount = await apiKeyInputs.count();

    expect(inputCount).toBeGreaterThan(0);

    // Test API key validation (if available)
    const testButtons = page.locator('button:has-text("테스트"), button:has-text("검증")');
    const testButtonCount = await testButtons.count();

    if (testButtonCount > 0) {
      await testButtons.first().click();
      // Wait for validation response
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: 'tests/screenshots/api-configuration.png' });
  });

  test('Network Error Handling', async ({ page }) => {
    // Simulate network failure
    await page.route('**/*', route => {
      if (route.request().url().includes('api') || route.request().url().includes('gemini')) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    await page.click('text=대본입력');
    await page.fill('textarea[placeholder*="원문"]', API_TEST_CONFIG.testInput);
    await page.click('button:has-text("AI 보정")');

    // Should show network error
    await expect(page.locator('text*=오류')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'tests/screenshots/network-error.png' });
  });

  test('API Response Validation', async ({ page }) => {
    // Test with malformed API response
    await page.route('**/gemini/*/generateContent*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json response'
      });
    });

    await page.click('text=대본입력');
    await page.fill('textarea[placeholder*="원문"]', API_TEST_CONFIG.testInput);
    await page.click('button:has-text("AI 보정")');

    // Should handle malformed response gracefully
    await expect(page.locator('text*=오류')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'tests/screenshots/malformed-response.png' });
  });

  test('Concurrent API Calls Management', async ({ page }) => {
    await page.click('text=영상편집');
    await page.waitForTimeout(2000);

    // Track concurrent API calls
    const activeCalls = new Set<string>();
    const maxConcurrent = { value: 0 };

    page.on('request', request => {
      if (request.url().includes('api') || request.url().includes('gemini')) {
        activeCalls.add(request.url());
        maxConcurrent.value = Math.max(maxConcurrent.value, activeCalls.size);
      }
    });

    page.on('response', response => {
      activeCalls.delete(response.url());
    });

    // Trigger multiple operations if possible
    const imageButtons = page.locator('button:has-text("이미지 생성")');
    const buttonCount = await imageButtons.count();

    if (buttonCount > 1) {
      // Click multiple buttons to test concurrency
      for (let i = 0; i < Math.min(3, buttonCount); i++) {
        await imageButtons.nth(i).click();
        await page.waitForTimeout(100);
      }

      await page.waitForTimeout(5000);
      console.log('Maximum concurrent API calls:', maxConcurrent.value);
    }
  });
});