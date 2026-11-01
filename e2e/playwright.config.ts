import {defineConfig, devices} from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', {open: 'never'}], ['github']] : 'list',
  use: {trace: 'retain-on-failure', video: 'retain-on-failure'},
  // admin.spec.ts is the only file that signs the owner in (a new email code replaces the previous
  // one, a TOTP step is accepted once); refund.spec.ts needs the owner too, so it runs after it and
  // takes over the owner's TOTP secret (support/owner-totp.ts). Both are chromium only.
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
      testIgnore: [/admin\.spec\.ts/, /refund\.spec\.ts/]
    },
    {
      name: 'webkit',
      use: {...devices['Desktop Safari']},
      testIgnore: [/admin\.spec\.ts/, /refund\.spec\.ts/]
    },
    {name: 'admin', use: {...devices['Desktop Chrome']}, testMatch: /admin\.spec\.ts/},
    {
      name: 'refund',
      use: {...devices['Desktop Chrome']},
      testMatch: /refund\.spec\.ts/,
      // Last: after admin.spec.ts (the owner) and after the specs that read or edit VIP.
      dependencies: ['admin', 'chromium', 'webkit']
    }
  ]
})
