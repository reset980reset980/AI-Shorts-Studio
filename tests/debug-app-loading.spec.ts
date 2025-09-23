import { test, expect } from '@playwright/test';

test.describe('Debug App Loading', () => {

  test('Basic app loading and DOM inspection', async ({ page }) => {
    console.log('🔍 Starting app loading test...');

    // Go to the app
    await page.goto('/');

    // Wait a moment for initial load
    await page.waitForTimeout(3000);

    // Take screenshot to see what we have
    await page.screenshot({ path: 'tests/screenshots/debug-initial-load.png' });

    // Get page title
    const title = await page.title();
    console.log('📄 Page title:', title);

    // Get body content
    const bodyText = await page.locator('body').textContent();
    console.log('📝 Body text (first 200 chars):', bodyText?.substring(0, 200));

    // Check for React root
    const reactRoot = page.locator('#root');
    const hasReactRoot = await reactRoot.count();
    console.log('⚛️ React root found:', hasReactRoot > 0);

    if (hasReactRoot > 0) {
      const rootContent = await reactRoot.textContent();
      console.log('🎯 Root content (first 300 chars):', rootContent?.substring(0, 300));
    }

    // Check for specific elements
    const tabs = await page.locator('button, a').allTextContents();
    console.log('🔖 Available tabs/buttons:', tabs.slice(0, 10));

    // Check for Korean text
    const koreanElements = await page.locator('text=/[가-힣]+/').count();
    console.log('🇰🇷 Korean text elements found:', koreanElements);

    // Check console for errors
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    await page.waitForTimeout(2000);
    console.log('🖥️ Console messages:', consoleMessages.slice(0, 5));

    // Check for specific log message patterns
    const logViewerExists = await page.locator('.log-viewer, [class*="log"]').count();
    console.log('📋 Log viewer elements found:', logViewerExists);

    // Look for the specific Korean text we're expecting
    const startupMessage = await page.locator('text*=AI Shorts Studio').count();
    const settingsMessage = await page.locator('text*=설정').count();

    console.log('🚀 Startup message elements:', startupMessage);
    console.log('⚙️ Settings message elements:', settingsMessage);

    // Check if the app is actually working
    const isAppLoaded = hasReactRoot > 0 && (startupMessage > 0 || settingsMessage > 0 || koreanElements > 0);

    if (!isAppLoaded) {
      console.log('❌ App does not appear to be loaded correctly');

      // Additional debugging
      const allText = await page.locator('*').allTextContents();
      console.log('🔍 All text content:', allText.join(' ').substring(0, 500));
    } else {
      console.log('✅ App appears to be loaded successfully');
    }

    // Basic assertion that something loaded
    expect(hasReactRoot).toBeGreaterThan(0);
  });

  test('Check environment and API configuration', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    // Check localStorage
    const localStorageInfo = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      return {
        keyCount: keys.length,
        keys: keys,
        hasScripts: localStorage.getItem('ai_shorts_studio_scripts') !== null
      };
    });

    console.log('💾 LocalStorage info:', localStorageInfo);

    // Check if environment variables or API configuration is accessible
    const envCheck = await page.evaluate(() => {
      return {
        hasViteEnv: typeof (window as any).VITE_GEMINI_API_KEY !== 'undefined',
        userAgent: navigator.userAgent,
        location: window.location.href
      };
    });

    console.log('🌍 Environment info:', envCheck);

    await page.screenshot({ path: 'tests/screenshots/debug-environment.png' });
  });

  test('Manual tab navigation test', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    // Try to find and click tabs manually
    const buttonElements = await page.locator('button').all();
    console.log('🔘 Found buttons:', buttonElements.length);

    for (let i = 0; i < Math.min(3, buttonElements.length); i++) {
      const button = buttonElements[i];
      const text = await button.textContent();
      console.log(`Button ${i}: "${text}"`);

      if (text && text.includes('대본') || text.includes('입력')) {
        console.log('🎯 Found script input button, clicking...');
        await button.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `tests/screenshots/debug-tab-${i}.png` });
        break;
      }
    }
  });
});