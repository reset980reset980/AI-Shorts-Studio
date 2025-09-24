import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

test.describe('Storage System Verification', () => {
  test('Check actual storage locations', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Check console for file system status
    page.on('console', msg => {
      if (msg.text().includes('Electron modules') || msg.text().includes('File system')) {
        console.log('Console:', msg.text());
      }
    });

    // Wait a bit and reload to trigger initialization logs
    await page.waitForTimeout(2000);
    await page.reload();
    await page.waitForTimeout(2000);

    // Check localStorage for any saved data
    const localStorageData = await page.evaluate(() => {
      const items: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          items[key] = localStorage.getItem(key);
        }
      }
      return items;
    });

    console.log('\n=== localStorage Contents ===');
    Object.keys(localStorageData).forEach(key => {
      if (key.includes('script') || key.includes('audio') || key.includes('image')) {
        console.log(`${key}: ${localStorageData[key]?.substring(0, 100)}...`);
      }
    });

    // Check multiple possible data locations
    const possiblePaths = [
      path.join('D:', 'ai-shorts-studio', 'AI-Shorts-Studio', 'data'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'ai-shorts-studio', 'data'),
      path.join(process.cwd(), 'data')
    ];

    console.log('\n=== Checking File System Locations ===');
    for (const dataPath of possiblePaths) {
      console.log(`\nChecking: ${dataPath}`);

      if (fs.existsSync(dataPath)) {
        console.log('✅ Directory exists');

        const folders = ['scripts', 'images', 'audio', 'videos', 'projects'];
        for (const folder of folders) {
          const folderPath = path.join(dataPath, folder);
          if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath);
            console.log(`  ${folder}/: ${files.length} files`);

            // List files with details
            files.forEach(file => {
              const filePath = path.join(folderPath, file);
              const stats = fs.statSync(filePath);
              if (stats.isFile()) {
                console.log(`    - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
              }
            });
          }
        }
      } else {
        console.log('❌ Directory does not exist');
      }
    }

    // Check Electron userData path
    const userDataPath = await page.evaluate(() => {
      const win = window as any;
      if (win.require) {
        try {
          const remote = win.require('@electron/remote');
          return remote?.app?.getPath('userData');
        } catch (e) {
          return null;
        }
      }
      return null;
    });

    if (userDataPath) {
      console.log(`\n=== Electron userData Path ===`);
      console.log(`Path: ${userDataPath}`);

      const electronDataPath = path.join(userDataPath, 'data');
      if (fs.existsSync(electronDataPath)) {
        console.log('✅ Electron data directory exists');

        const folders = ['scripts', 'images', 'audio'];
        folders.forEach(folder => {
          const folderPath = path.join(electronDataPath, folder);
          if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath);
            console.log(`  ${folder}/: ${files.length} files`);
          }
        });
      }
    }

    // Check window.require availability
    const hasRequire = await page.evaluate(() => {
      return !!(window as any).require;
    });

    console.log(`\n=== Environment Status ===`);
    console.log(`window.require available: ${hasRequire}`);
    console.log(`Running in Electron: ${hasRequire ? 'Yes' : 'No (Browser mode)'}`);
  });
});