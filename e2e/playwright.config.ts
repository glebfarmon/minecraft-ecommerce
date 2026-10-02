import {defineConfig, devices} from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', {open: 'never'}], ['github']] : 'list',
  use: {trace: 'retain-on-failure', video: 'retain-on-failure'},
  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome']}},
    {name: 'webkit', use: {...devices['Desktop Safari']}}
  ]
})
