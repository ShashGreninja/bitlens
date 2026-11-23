import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

const installedChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    viewport: { width: 1440, height: 960 },
    launchOptions: existsSync(installedChrome)
      ? { executablePath: installedChrome }
      : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview:example -- --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
  },
})
