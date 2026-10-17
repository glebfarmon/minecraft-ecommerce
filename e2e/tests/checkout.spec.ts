import {type Page, expect, test} from '@playwright/test'

import {latestMail, newestMailId} from '../support/mailpit'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'
const EMAIL = `buyer-${String(Date.now())}@shop.localhost`

test.use({viewport: {width: 1600, height: 900}})
test.skip(({browserName}) => browserName !== 'chromium', 'one browser is enough for payments')

// Buttons are in the server HTML before React attaches handlers; the navbar marks hydration.
const hydrated = (page: Page) =>
  expect(page.getByRole('navigation', {name: 'Main'})).toHaveAttribute('data-animate')

/** Adds VIP, opens the cart and the checkout form, fills it and waits for Pay to be enabled. */
async function fillCheckout(page: Page) {
  await page.goto(`${WEB}/`)
  await hydrated(page)
  await page.getByRole('button', {name: 'Add VIP to cart'}).click()
  await page.getByRole('button', {name: /^Cart, 1 item$/}).click()
  await page.getByRole('button', {name: 'Checkout'}).click()
  await page.getByLabel('Minecraft nickname').fill('E2e_Buyer')
  await page.getByLabel('Email', {exact: true}).fill(EMAIL)
  for (const box of await page.getByRole('checkbox').all()) await box.check()
  // The Turnstile test site key always passes; Pay enables once the widget hands over a token.
  await expect(page.getByRole('button', {name: /^Pay/})).toBeEnabled({timeout: 30_000})
}

test('a player pays with the fake gateway and sees the paid order', async ({page}) => {
  await fillCheckout(page)
  const before = await newestMailId(EMAIL)
  await page.getByRole('button', {name: /^Pay/}).click()
  await expect(page).toHaveURL(/\/api\/payments\/fake\/cs_fake_/)
  await page.getByRole('button', {name: 'Pay', exact: true}).click()
  await expect(page).toHaveURL(/\/order\/[A-Za-z0-9_-]{22}$/)
  await expect(page.getByRole('heading', {name: 'Paid — thank you!'})).toBeVisible({
    timeout: 30_000
  })
  await expect(page.getByText('VIP × 1')).toBeVisible()
  // The status page clears the cart for the order this browser just paid.
  await expect(page.getByRole('button', {name: /^Cart, empty$/})).toBeVisible()
  const mail = await latestMail(EMAIL, {after: before})
  expect(mail.subject).toMatch(/^Your order [A-Za-z0-9_-]{22} is paid$/)
})

test('cancel on the payment page returns to an intact cart', async ({page}) => {
  await fillCheckout(page)
  await page.getByRole('button', {name: /^Pay/}).click()
  await expect(page).toHaveURL(/\/api\/payments\/fake\/cs_fake_/)
  await page.getByRole('button', {name: 'Cancel'}).click()
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/)
  await expect(page.getByRole('button', {name: /^Cart, 1 item$/})).toBeVisible()
})

test('an unknown order number shows the not-found page', async ({page}) => {
  const res = await page.goto(`${WEB}/order/AAAAAAAAAAAAAAAAAAAAAA`)
  expect(res?.status()).toBe(404)
})
