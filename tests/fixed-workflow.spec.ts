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
async function clearDataDirectory() {
  const dataPath = path.join(process.cwd(), 'data');
  try {
    const subdirs = ['scripts', 'images', 'audio', 'videos', 'projects'];
    for (const subdir of subdirs) {
      const dirPath = path.join(dataPath, subdir);
      try {
        const files = await fs.readdir(dirPath);
        for (const file of files) {
          await fs.unlink(path.join(dirPath, file));
        }
      } catch (error) {
        // Directory might not exist, which is fine
      }
    }
  } catch (error) {
    console.warn('Failed to clear data directory:', error);
  }
}

async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

test.describe('AI Shorts Studio - Fixed Workflow Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Clear data directory before each test
    await clearDataDirectory();

    // Navigate to the app
    await page.goto('/');

    // Wait for app to load - using more flexible selectors
    await page.waitForTimeout(3000);

    // Check that React root is loaded
    await expect(page.locator('#root')).toBeVisible();

    // Check that tabs are visible
    await expect(page.locator('text=대본입력')).toBeVisible();
  });

  test('App initialization and UI verification', async ({ page }) => {
    // Verify all tabs are present
    for (const tab of TEST_DATA.expectedTabs) {
      await expect(page.locator(`text=${tab}`)).toBeVisible();
    }

    // Take screenshot of initial state
    await page.screenshot({ path: 'tests/screenshots/app-initialization.png' });

    // Test tab navigation
    await page.click('text=영상편집');
    await page.waitForTimeout(1000);

    await page.click('text=내정보');
    await page.waitForTimeout(1000);

    // Return to script input tab
    await page.click('text=대본입력');
    await page.waitForTimeout(1000);

    // Verify we're on the correct tab
    const activeTab = page.locator('button:has-text("대본입력")');
    await expect(activeTab).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/tab-navigation-complete.png' });
  });

  test('Script input and text processing', async ({ page }) => {
    // Navigate to script input tab
    await page.click('text=대본입력');

    // Find and fill the input textarea
    const inputTextarea = page.locator('textarea').first();
    await expect(inputTextarea).toBeVisible();

    await inputTextarea.fill(TEST_DATA.scriptInput);

    // Take screenshot before processing
    await page.screenshot({ path: 'tests/screenshots/before-script-input.png' });

    // Verify the text was entered
    const enteredText = await inputTextarea.inputValue();
    expect(enteredText).toBe(TEST_DATA.scriptInput);

    // Look for AI correction button using data-testid
    const correctionButton = page.getByTestId('ai-correction-button');
    if (await correctionButton.isVisible()) {
      await correctionButton.click();

      // Wait for processing (with realistic timeout)
      await page.waitForTimeout(5000);

      // Check for output
      const outputTextarea = page.locator('textarea').nth(1);
      if (await outputTextarea.isVisible()) {
        const outputText = await outputTextarea.inputValue();
        console.log('AI correction output length:', outputText.length);
      }
    }

    await page.screenshot({ path: 'tests/screenshots/after-script-processing.png' });
  });

  test('Media generation workflow simulation', async ({ page }) => {
    // Navigate to video editing tab
    await page.click('text=영상편집');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/video-editing-tab.png' });

    // Look for script selection
    const scriptSelect = page.locator('select');
    if (await scriptSelect.isVisible()) {
      // Try to select an option
      const options = await scriptSelect.locator('option').count();
      console.log('Available script options:', options);

      if (options > 1) {
        await scriptSelect.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
      }
    }

    // Look for media generation buttons
    const imageButtons = page.locator('button:has-text("이미지")');
    const audioButtons = page.locator('button:has-text("음성")');
    const renderButtons = page.locator('button:has-text("렌더링")');

    console.log('Media generation buttons found:');
    console.log('- Image buttons:', await imageButtons.count());
    console.log('- Audio buttons:', await audioButtons.count());
    console.log('- Render buttons:', await renderButtons.count());

    // Test one image generation button if available
    if (await imageButtons.first().isVisible()) {
      await imageButtons.first().click();
      await page.waitForTimeout(2000);

      // Check for any loading indicators or results
      await page.screenshot({ path: 'tests/screenshots/image-generation-attempt.png' });
    }

    // Test one audio generation button if available
    if (await audioButtons.first().isVisible()) {
      await audioButtons.first().click();
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'tests/screenshots/audio-generation-attempt.png' });
    }
  });

  test('File system storage verification', async ({ page }) => {
    const dataPath = path.join(process.cwd(), 'data');

    // Check that data directory exists
    const dataExists = await checkFileExists(dataPath);
    expect(dataExists).toBe(true);

    // Check required subdirectories
    const requiredDirs = ['scripts', 'images', 'audio', 'videos', 'projects'];
    const dirStatus: { [key: string]: boolean } = {};

    for (const dir of requiredDirs) {
      const dirPath = path.join(dataPath, dir);
      dirStatus[dir] = await checkFileExists(dirPath);
      expect(dirStatus[dir]).toBe(true);
    }

    console.log('Data directory structure:', dirStatus);

    // Check for any existing files
    for (const dir of requiredDirs) {
      const dirPath = path.join(dataPath, dir);
      try {
        const files = await fs.readdir(dirPath);
        console.log(`Files in ${dir}:`, files.length);
      } catch (error) {
        console.log(`Could not read ${dir}:`, error);
      }
    }

    // Test localStorage functionality
    const localStorageTest = await page.evaluate(() => {
      // Test localStorage write/read
      const testKey = 'test_key';
      const testValue = JSON.stringify({ test: 'data', timestamp: Date.now() });

      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      return {
        canWrite: retrieved === testValue,
        currentKeys: Object.keys(localStorage)
      };
    });

    console.log('LocalStorage test:', localStorageTest);
    expect(localStorageTest.canWrite).toBe(true);
  });

  test('Project management functionality', async ({ page }) => {
    await page.click('text=프로젝트관리');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/project-management.png' });

    // Check for project-related elements
    const projectElements = page.locator('div, section, card').filter({ hasText: /프로젝트|project/i });
    const elementCount = await projectElements.count();
    console.log('Project-related elements found:', elementCount);

    // Check projects directory
    const projectsPath = path.join(process.cwd(), 'data', 'projects');
    const projectsExist = await checkFileExists(projectsPath);
    expect(projectsExist).toBe(true);

    // List any existing project files
    try {
      const projectFiles = await fs.readdir(projectsPath);
      console.log('Project files:', projectFiles);
    } catch (error) {
      console.log('No project files or directory access issue');
    }
  });

  test('Settings and configuration', async ({ page }) => {
    await page.click('text=내정보');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/settings-tab.png' });

    // Look for configuration inputs
    const inputs = page.locator('input');
    const textareas = page.locator('textarea');
    const selects = page.locator('select');

    console.log('Configuration elements found:');
    console.log('- Input fields:', await inputs.count());
    console.log('- Text areas:', await textareas.count());
    console.log('- Select dropdowns:', await selects.count());

    // Check for API key fields
    const apiKeyFields = page.locator('input[type="password"], input[placeholder*="API"], input[placeholder*="키"]');
    const apiKeyCount = await apiKeyFields.count();
    console.log('API key fields found:', apiKeyCount);

    // Test settings persistence if possible
    if (apiKeyCount > 0) {
      const firstApiField = apiKeyFields.first();
      if (await firstApiField.isVisible() && await firstApiField.isEnabled()) {
        await firstApiField.fill('test-api-key-value');
        await page.waitForTimeout(500);

        const enteredValue = await firstApiField.inputValue();
        expect(enteredValue).toBe('test-api-key-value');

        // Clear the test value
        await firstApiField.fill('');
      }
    }
  });

  test('Performance and error monitoring', async ({ page }) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const networkErrors: string[] = [];

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
        networkErrors.push(`${response.status()}: ${response.url()}`);
      }
    });

    // Navigate through all tabs to trigger any potential errors
    for (const tab of TEST_DATA.expectedTabs) {
      console.log(`Testing tab: ${tab}`);
      await page.click(`text=${tab}`);
      await page.waitForTimeout(1500);
    }

    // Measure performance
    const performance = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadTime: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
        domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
        timeToFirstByte: Math.round(navigation.responseStart - navigation.requestStart)
      };
    });

    // Report findings
    console.log('=== Performance Metrics ===');
    console.log('Load time:', performance.loadTime, 'ms');
    console.log('DOM content loaded:', performance.domContentLoaded, 'ms');
    console.log('Time to first byte:', performance.timeToFirstByte, 'ms');

    console.log('=== Error Analysis ===');
    console.log('Console errors:', errors.length);
    console.log('Console warnings:', warnings.length);
    console.log('Network errors:', networkErrors.length);

    if (errors.length > 0) {
      console.log('First 3 errors:', errors.slice(0, 3));
    }

    if (networkErrors.length > 0) {
      console.log('Network errors:', networkErrors);
    }

    // Take final screenshot
    await page.screenshot({ path: 'tests/screenshots/performance-test-complete.png' });

    // Assert reasonable performance
    expect(performance.loadTime).toBeLessThan(5000); // Less than 5 seconds

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('404') &&
      !err.includes('net::ERR_NETWORK_CHANGED') &&
      !err.includes('Extension')
    );

    expect(criticalErrors.length).toBeLessThan(5); // Allow some minor errors
  });
});