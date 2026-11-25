import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

const installedChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const port = Number(process.env.BITLENS_TEST_PORT ?? 4174)
const baseURL = `http://127.0.0.1:${port}`
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  use: {
    baseURL,
    viewport: { width: 1440, height: 960 },
    launchOptions: existsSync(installedChrome)
      ? { executablePath: installedChrome }
      : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run preview:example -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})
