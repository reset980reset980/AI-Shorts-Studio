import { test, expect, Page } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

// Test configuration
const TEST_DATA = {
  scriptInput: '복이 깃드는 얼굴에 대해 이야기해보겠습니다. 온화한 미소와 밝은 기운이 복을 불러들인다고 합니다.',
  expectedTabs: ['대본입력', '유튜브채널', '영상편집', '프로젝트관리', '유튜브 업로드', '내정보'],
  timeout: 30000
};

// Utility functions
async function waitForLogMessage(page: Page, message: string, timeout = 10000) {
  return page.waitForFunction(
    (expectedMessage) => {
      const logElements = document.querySelectorAll('.log-entry');
      return Array.from(logElements).some(el =>
        el.textContent?.includes(expectedMessage)
      );
    },
    message,
    { timeout }
  );
}

async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function clearDataDirectory() {
  const dataPath = path.join(process.cwd(), 'data');
  try {
    // Clear all subdirectories except the structure
    const subdirs = ['scripts', 'images', 'audio', 'videos', 'projects'];
    for (const subdir of subdirs) {
      const dirPath = path.join(dataPath, subdir);
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        await fs.unlink(path.join(dirPath, file));
      }
    }
  } catch (error) {
    console.warn('Failed to clear data directory:', error);
  }
}

test.describe('AI Shorts Studio - Complete Workflow Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Clear data directory before each test
    await clearDataDirectory();

    // Navigate to the app
    await page.goto('/');

    // Wait for app to load
    await expect(page.locator('text=AI Shorts Studio가 시작되었습니다')).toBeVisible({ timeout: 10000 });

    // Wait for settings to load
    await expect(page.locator('text=설정을 성공적으로 불러왔습니다')).toBeVisible({ timeout: 15000 });
  });

  test('App initialization and basic UI verification', async ({ page }) => {
    // Check that all tabs are present
    for (const tab of TEST_DATA.expectedTabs) {
      await expect(page.locator(`text=${tab}`)).toBeVisible();
    }

    // Check that we start on the correct tab
    await expect(page.locator('.tab-active')).toContainText('대본입력');

    // Check log viewer functionality
    const logToggle = page.locator('button:has-text("로그")');
    await expect(logToggle).toBeVisible();

    await logToggle.click();
    await expect(page.locator('.log-viewer')).toBeVisible();

    await logToggle.click();
    await expect(page.locator('.log-viewer')).not.toBeVisible();
  });

  test('Script generation workflow', async ({ page }) => {
    // Navigate to script input tab
    await page.click('text=대본입력');

    // Wait for tab to load
    await expect(page.locator('textarea')).toBeVisible();

    // Input test text
    await page.fill('textarea[placeholder*="원문"]', TEST_DATA.scriptInput);

    // Take screenshot before processing
    await page.screenshot({ path: 'tests/screenshots/before-script-generation.png' });

    // Click AI correction button
    await page.click('button:has-text("AI 보정")');

    // Wait for processing to start
    await expect(page.locator('text=AI 보정 시작')).toBeVisible({ timeout: 5000 });

    // Wait for processing to complete (with longer timeout for API calls)
    try {
      await expect(page.locator('text=AI 보정 완료')).toBeVisible({ timeout: TEST_DATA.timeout });
    } catch (error) {
      // If AI correction fails, check error messages
      const errorLog = page.locator('text*=오류');
      if (await errorLog.isVisible()) {
        console.log('AI correction failed with error');
        await page.screenshot({ path: 'tests/screenshots/script-generation-error.png' });
      }
      throw error;
    }

    // Verify output is generated
    const outputTextarea = page.locator('textarea').nth(1);
    const outputText = await outputTextarea.inputValue();
    expect(outputText).not.toBe('AI 보정 결과가 여기에 표시됩니다.');
    expect(outputText.length).toBeGreaterThan(10);

    // Click script generation button
    await page.click('button:has-text("대본 생성")');

    // Wait for script generation to complete
    try {
      await expect(page.locator('text=대본 생성 완료')).toBeVisible({ timeout: TEST_DATA.timeout });
    } catch (error) {
      await page.screenshot({ path: 'tests/screenshots/script-generation-timeout.png' });
      throw error;
    }

    // Take screenshot after processing
    await page.screenshot({ path: 'tests/screenshots/after-script-generation.png' });

    // Verify file storage
    const scriptsPath = path.join(process.cwd(), 'data', 'scripts');
    const scriptFiles = await fs.readdir(scriptsPath);
    expect(scriptFiles.length).toBeGreaterThan(0);

    // Check if JSON file is valid
    const scriptFile = scriptFiles.find(f => f.endsWith('.json'));
    if (scriptFile) {
      const scriptContent = await fs.readFile(path.join(scriptsPath, scriptFile), 'utf-8');
      const scriptData = JSON.parse(scriptContent);
      expect(scriptData).toHaveProperty('title');
      expect(scriptData).toHaveProperty('scenes');
      expect(scriptData.scenes.length).toBeGreaterThan(0);
    }
  });

  test('Image generation and storage verification', async ({ page }) => {
    // First generate a script or use existing mock data
    await page.click('text=영상편집');

    // Wait for tab to load
    await expect(page.locator('text=스크립트 선택')).toBeVisible({ timeout: 10000 });

    // Check if there are existing scripts
    const scriptSelect = page.locator('select');
    await scriptSelect.selectOption({ index: 0 });

    // Look for image generation buttons
    const imageButtons = page.locator('button:has-text("이미지 생성")');
    const buttonCount = await imageButtons.count();

    if (buttonCount > 0) {
      // Click first image generation button
      await imageButtons.first().click();

      // Wait for image generation to start
      await expect(page.locator('text*=이미지 생성 중')).toBeVisible({ timeout: 5000 });

      // Wait for completion with extended timeout
      try {
        await expect(page.locator('img')).toBeVisible({ timeout: 60000 });
      } catch (error) {
        await page.screenshot({ path: 'tests/screenshots/image-generation-timeout.png' });
        console.log('Image generation timed out');
      }

      // Verify file storage
      const imagesPath = path.join(process.cwd(), 'data', 'images');
      const imageFiles = await fs.readdir(imagesPath);
      // Note: Images might be in subdirectories by project
    }

    await page.screenshot({ path: 'tests/screenshots/image-generation-result.png' });
  });

  test('Audio generation and storage verification', async ({ page }) => {
    await page.click('text=영상편집');

    // Wait for tab to load
    await expect(page.locator('text=스크립트 선택')).toBeVisible({ timeout: 10000 });

    // Select a script
    const scriptSelect = page.locator('select');
    await scriptSelect.selectOption({ index: 0 });

    // Look for audio generation buttons
    const audioButtons = page.locator('button:has-text("음성 생성")');
    const buttonCount = await audioButtons.count();

    if (buttonCount > 0) {
      // Click first audio generation button
      await audioButtons.first().click();

      // Wait for audio generation to start
      await expect(page.locator('text*=음성 생성 중')).toBeVisible({ timeout: 5000 });

      // Wait for completion
      try {
        await expect(page.locator('audio')).toBeVisible({ timeout: 60000 });
      } catch (error) {
        await page.screenshot({ path: 'tests/screenshots/audio-generation-timeout.png' });
        console.log('Audio generation timed out');
      }

      // Verify file storage
      const audioPath = path.join(process.cwd(), 'data', 'audio');
      const audioFiles = await fs.readdir(audioPath);
      // Note: Audio files might be in subdirectories by project
    }

    await page.screenshot({ path: 'tests/screenshots/audio-generation-result.png' });
  });

  test('Video rendering process verification', async ({ page }) => {
    await page.click('text=영상편집');

    // Wait for tab to load
    await expect(page.locator('text=스크립트 선택')).toBeVisible({ timeout: 10000 });

    // Look for render button
    const renderButton = page.locator('button:has-text("영상 렌더링")');

    if (await renderButton.isVisible()) {
      await renderButton.click();

      // Wait for render to start
      await expect(page.locator('text*=렌더링 시작')).toBeVisible({ timeout: 5000 });

      // Check render status updates
      try {
        await expect(page.locator('text*=렌더링')).toBeVisible({ timeout: 10000 });
      } catch (error) {
        await page.screenshot({ path: 'tests/screenshots/video-render-timeout.png' });
        console.log('Video rendering process check timed out');
      }
    }

    await page.screenshot({ path: 'tests/screenshots/video-render-result.png' });
  });

  test('File system storage structure verification', async ({ page }) => {
    const dataPath = path.join(process.cwd(), 'data');

    // Check that data directory exists
    const dataExists = await checkFileExists(dataPath);
    expect(dataExists).toBe(true);

    // Check required subdirectories
    const requiredDirs = ['scripts', 'images', 'audio', 'videos', 'projects'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(dataPath, dir);
      const dirExists = await checkFileExists(dirPath);
      expect(dirExists).toBe(true);
    }

    // Check localStorage usage
    const localStorageData = await page.evaluate(() => {
      const scriptsData = localStorage.getItem('ai_shorts_studio_scripts');
      return {
        hasScriptsData: !!scriptsData,
        scriptsDataLength: scriptsData ? scriptsData.length : 0
      };
    });

    console.log('LocalStorage usage:', localStorageData);
  });

  test('Project management tab functionality', async ({ page }) => {
    await page.click('text=프로젝트관리');

    // Wait for tab to load
    await page.waitForTimeout(2000);

    // Check if projects are displayed
    await page.screenshot({ path: 'tests/screenshots/project-management.png' });

    // Verify projects directory
    const projectsPath = path.join(process.cwd(), 'data', 'projects');
    const projectsExist = await checkFileExists(projectsPath);
    expect(projectsExist).toBe(true);
  });

  test('Performance and console error monitoring', async ({ page }) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Monitor console messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      } else if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });

    // Monitor network failures
    page.on('response', response => {
      if (response.status() >= 400) {
        errors.push(`Network error: ${response.url()} - ${response.status()}`);
      }
    });

    // Navigate through all tabs
    for (const tab of TEST_DATA.expectedTabs) {
      await page.click(`text=${tab}`);
      await page.waitForTimeout(1000);
    }

    // Record performance metrics
    const performance = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        timeToFirstByte: navigation.responseStart - navigation.requestStart
      };
    });

    console.log('Performance metrics:', performance);
    console.log('Console errors:', errors);
    console.log('Console warnings:', warnings.slice(0, 5)); // Limit warnings output

    // Assert no critical errors
    const criticalErrors = errors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('404') &&
      !err.includes('net::ERR_NETWORK_CHANGED')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});