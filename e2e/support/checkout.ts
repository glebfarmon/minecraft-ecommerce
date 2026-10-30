import {type Page, expect} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'

/**
 * Buys one VIP as `nick` through the fake gateway, as checkout.spec.ts does, and returns the order's
 * public id once the order page says it is paid. The page stays on the order page.
 */
export async function buyVip(page: Page, {nick, email}: {nick: string; email: string}) {
  await page.goto(`${WEB}/`)
  // Buttons are in the server HTML before React attaches handlers; the navbar marks hydration.
  await expect(page.getByRole('navigation', {name: 'Main'})).toHaveAttribute('data-animate')
  await page.getByRole('button', {name: 'Add VIP to cart'}).click()
  await page.getByRole('button', {name: /^Cart, 1 item$/}).click()
  await page.getByRole('button', {name: 'Checkout'}).click()
  await page.getByLabel('Minecraft nickname').fill(nick)
  await page.getByLabel('Email', {exact: true}).fill(email)
  const dialog = page.getByRole('dialog', {name: 'Checkout', exact: true})
  await dialog.getByText('I agree to immediate delivery').click({position: {x: 4, y: 4}})
  await dialog.getByText('I accept the').click({position: {x: 4, y: 4}})
  for (const box of await dialog.getByRole('checkbox').all()) await expect(box).toBeChecked()
  await expect(page.getByRole('button', {name: /^Pay/})).toBeEnabled({timeout: 30_000})
  await page.getByRole('button', {name: /^Pay/}).click()
  await expect(page).toHaveURL(/\/api\/payments\/fake\/cs_fake_/)
  await page.getByRole('button', {name: 'Pay', exact: true}).click()
  await expect(page).toHaveURL(/\/order\/[A-Za-z0-9_-]{22}$/)
  await expect(page.getByRole('heading', {name: 'Paid — thank you!'})).toBeVisible({
    timeout: 30_000
  })
  return new URL(page.url()).pathname.split('/').at(-1) ?? ''
}
