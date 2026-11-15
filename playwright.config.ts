import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts$/,
  timeout: 120000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:8088',
    locale: 'nl-NL',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1194, height: 834 },
        hasTouch: true,
      },
      testIgnore: /.*visual-regression\.spec\.ts$/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testIgnore: /.*visual-regression\.spec\.ts$/,
    },
  ],
  webServer: {
    command: 'npx next dev --webpack -p 8088 -H 127.0.0.1',
    url: 'http://127.0.0.1:8088',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
