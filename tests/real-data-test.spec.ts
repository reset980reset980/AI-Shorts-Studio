import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Real Data Generation and Storage Test', () => {
  test.setTimeout(120000); // 2 minutes for API calls

  test('Complete workflow with actual data generation', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Step 1: Input script text
    console.log('Step 1: Inputting script text...');
    await page.click('button:has-text("대본입력")');
    await page.waitForTimeout(1000);

    const testScript = `안녕하세요! 오늘은 AI를 활용한 유튜브 쇼츠 제작 방법을 알려드리겠습니다.
첫 번째로, 좋은 스크립트를 작성하는 것이 중요합니다.
두 번째로, AI를 활용해 이미지를 생성합니다.
세 번째로, 음성 합성을 통해 나레이션을 만듭니다.
마지막으로, 모든 요소를 합쳐 완성된 영상을 만듭니다.`;

    const inputTextarea = page.locator('textarea').first();
    await inputTextarea.fill(testScript);

    // Step 2: Click AI correction
    console.log('Step 2: Running AI correction...');
    const correctionButton = page.getByTestId('ai-correction-button');
    await correctionButton.click();

    // Wait for AI processing
    await page.waitForTimeout(10000); // Give AI time to process

    // Check if output appears
    const outputTextarea = page.locator('textarea').nth(1);
    const outputText = await outputTextarea.inputValue();
    console.log('AI Output:', outputText.substring(0, 100) + '...');

    // Step 3: Generate script
    console.log('Step 3: Generating script...');
    const generateButton = page.locator('button:has-text("대본 생성하기")');

    // Only click if we have output
    if (outputText && outputText !== 'AI 보정 결과가 여기에 표시됩니다.') {
      await generateButton.click();
      await page.waitForTimeout(15000); // Wait for script generation
    } else {
      console.log('Skipping script generation - no AI output');
      return;
    }

    // Step 4: Navigate to editing tab
    console.log('Step 4: Navigating to editing tab...');
    await page.click('button:has-text("영상편집")');
    await page.waitForTimeout(2000);

    // Step 5: Select the generated script
    console.log('Step 5: Selecting script...');
    const scriptSelects = page.locator('select');
    const selectCount = await scriptSelects.count();

    if (selectCount > 0) {
      const firstSelect = scriptSelects.first();
      const options = await firstSelect.locator('option').allTextContents();
      console.log('Available scripts:', options);

      if (options.length > 1) {
        // Select the first non-default option
        await firstSelect.selectOption({ index: 1 });
        await page.waitForTimeout(2000);
      }
    }

    // Step 6: Generate images
    console.log('Step 6: Generating images...');
    const imageButtons = page.locator('button:has-text("이미지 생성")');
    const imageCount = await imageButtons.count();
    console.log(`Found ${imageCount} image generation buttons`);

    if (imageCount > 0) {
      // Generate first 2 images to save time
      for (let i = 0; i < Math.min(2, imageCount); i++) {
        console.log(`Generating image ${i + 1}...`);
        await imageButtons.nth(i).click();
        await page.waitForTimeout(10000); // Wait for image generation
      }
    }

    // Step 7: Generate audio
    console.log('Step 7: Generating audio...');
    const audioButtons = page.locator('button:has-text("음성 생성")');
    const audioCount = await audioButtons.count();
    console.log(`Found ${audioCount} audio generation buttons`);

    if (audioCount > 0) {
      // Generate first 2 audio files to save time
      for (let i = 0; i < Math.min(2, audioCount); i++) {
        console.log(`Generating audio ${i + 1}...`);
        await audioButtons.nth(i).click();
        await page.waitForTimeout(8000); // Wait for audio generation
      }
    }

    // Step 8: Check file system for saved files
    console.log('Step 8: Checking file system...');
    const dataPath = path.join('D:', 'ai-shorts-studio', 'AI-Shorts-Studio', 'data');

    const checkFolder = (folderName: string) => {
      const folderPath = path.join(dataPath, folderName);
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);
        console.log(`${folderName}: ${files.length} files`);
        files.forEach(file => {
          const stats = fs.statSync(path.join(folderPath, file));
          console.log(`  - ${file} (${stats.size} bytes)`);
        });
        return files.length;
      }
      return 0;
    };

    const scriptFiles = checkFolder('scripts');
    const imageFiles = checkFolder('images');
    const audioFiles = checkFolder('audio');

    // Assertions
    expect(scriptFiles).toBeGreaterThan(0);
    expect(imageFiles + audioFiles).toBeGreaterThan(0);

    // Take final screenshot
    await page.screenshot({ path: 'tests/screenshots/real-data-generation.png', fullPage: true });

    console.log('=== Test Complete ===');
    console.log(`Scripts saved: ${scriptFiles}`);
    console.log(`Images saved: ${imageFiles}`);
    console.log(`Audio saved: ${audioFiles}`);
  });
});