import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './src/tests/e2e',
  use: {baseURL: 'http://127.0.0.1:4173/furniture-builder/'},
  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome']}},
    {name: 'android-viewport', use: {...devices['Pixel 7']}}
  ],
  webServer: {command:'npm run preview -- --host 127.0.0.1',url:'http://127.0.0.1:4173/furniture-builder/',reuseExistingServer:!process.env.CI},
  timeout:30000
})
