import {expect, test} from '@playwright/test'

import {buyVip} from '../support/checkout'

// The scenarios that need the owner (a silent server marked done in admin, the owner alert mail)
// live in admin.spec.ts: its serial group is the only place that signs the owner in, because a new
// email code replaces the previous one and the API refuses a reused TOTP step.

test.use({viewport: {width: 1600, height: 900}})
test.skip(({browserName}) => browserName !== 'chromium', 'one browser is enough for payments')

test('a paid order reaches "delivered" on the order page without a reload', async ({page}) => {
  // The worker sends the demo grant command to the fake RCON server, which answers it.
  await buyVip(page, {nick: 'E2e_Player', email: `player-${String(Date.now())}@shop.localhost`})
  // A flag on the window survives only if the page is never reloaded.
  await page.evaluate(() => {
    ;(window as Window & {e2eNoReload?: boolean}).e2eNoReload = true
  })
  await expect(page.getByText('Delivered — your items are in the game.')).toBeVisible({
    timeout: 30_000
  })
  expect(await page.evaluate(() => (window as Window & {e2eNoReload?: boolean}).e2eNoReload)).toBe(
    true
  )
})
